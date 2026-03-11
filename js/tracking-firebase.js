/**
 * TRACKING MODULE - FIREBASE VERSION
 * GPS Map Tracking using Leaflet.js + OpenStreetMap (Free)
 */

import { db, rtdb, collection, getDocs, dbRef, dbSet, dbGet, onValue, COLLECTIONS } from './firebase.js';
import { DataModule } from './data-firebase.js';

console.log('[GPS] ✅ tracking-firebase.js loaded successfully');

let map = null;
let markers = {};
let autoRefreshInterval = null;
let firestoreUnsubscribe = null;
let rtdbUnsubscribe = null;
let cachedTrucks = []; // Cache truck metadata from Firestore
let trajectoryLayers = {}; // Polyline layers for trajectory history
let activeHistoryTruckId = null; // Currently displayed trajectory

// Tunisia center coordinates
const TUNISIA_CENTER = [36.8065, 10.1815];
const DEFAULT_ZOOM = 7;

// Truck type colors
const TYPE_COLORS = {
    PLATEAU: '#3b82f6',
    BENNE: '#f59e0b',
    CITERNE: '#10b981'
};

function init() {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.warn('⚠️ Leaflet not loaded yet, GPS tracking unavailable');
    }
}

async function refresh() {
    console.log('[GPS] refresh() called');
    if (typeof L === 'undefined') {
        const container = document.getElementById('trackingMap');
        if (container) container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:16px">⚠️ Carte non disponible — vérifiez votre connexion internet</div>';
        return;
    }

    // Destroy old map if it exists (handles page switching)
    if (map) {
        try { map.remove(); } catch(e) {}
        map = null;
        markers = {};
    }

    initMap();

    if (map) {
        // Give DOM time to render, then fix map size
        setTimeout(() => {
            map.invalidateSize();
            console.log('[GPS] Map size invalidated');
        }, 400);
        // Load truck metadata from Firestore
        const trucksSnap = await getDocs(collection(db, COLLECTIONS.trucks));
        cachedTrucks = trucksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const withLoc = cachedTrucks.filter(t => t.lastLocation?.lat);
        console.log(`[GPS] Loaded ${cachedTrucks.length} trucks from Firestore (${withLoc.length} with GPS from Firestore)`);
        withLoc.forEach(t => console.log(`[GPS]   Firestore: ${t.matricule} → ${t.lastLocation.lat}, ${t.lastLocation.lng}`));

        // Initial load with Firestore data
        await loadTruckPositions();

        // Start RTDB real-time listener
        console.log('[GPS] Connecting to RTDB...');
        startRtdbListener();

        // Test RTDB write to verify connection
        try {
            const testRef = dbRef(rtdb, '_connection_test');
            await dbSet(testRef, { ts: new Date().toISOString() });
            console.log('[GPS] ✅ RTDB connection OK (write test passed)');
        } catch (err) {
            console.error('[GPS] ❌ RTDB connection FAILED:', err.message || err);
            console.error('[GPS] ⚠️ Check RTDB security rules at Firebase Console → Realtime Database → Rules');
        }
        // Fallback polling every 60s
        startAutoRefresh();
    } else {
        console.error('[GPS] ❌ Map failed to initialize');
    }
}

function initMap() {
    const container = document.getElementById('trackingMap');
    if (!container) {
        console.error('[GPS] ❌ #trackingMap container not found in DOM');
        return;
    }
    // Clear container contents before initializing
    container.innerHTML = '';

    // Initialize Leaflet map
    map = L.map('trackingMap', {
        center: TUNISIA_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true
    });

    // OpenStreetMap tiles (free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Fix map rendering after page switch
    setTimeout(() => map.invalidateSize(), 200);
}

function createTruckIcon(type, speedKmh) {
    const color = TYPE_COLORS[type] || '#6366f1';
    const speedLabel = (typeof speedKmh === 'number' && speedKmh >= 0) ? `${speedKmh}` : '';
    const speedBadge = speedLabel ? `<div style="
        position:absolute;bottom:-8px;right:-8px;
        background:#1e293b;color:#10b981;font-size:9px;font-weight:700;
        padding:1px 4px;border-radius:6px;border:1px solid #10b981;
        white-space:nowrap;
    ">${speedLabel} km/h</div>` : '';

    return L.divIcon({
        className: 'truck-marker',
        html: `<div style="
            position:relative;
            width:40px;height:40px;border-radius:50%;
            background:${color};
            display:flex;align-items:center;justify-content:center;
            font-size:20px;color:#fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            border:3px solid #fff;
            transition:transform 0.3s;
            cursor:pointer;
        ">🚛${speedBadge}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -24]
    });
}

async function loadTruckPositions(trucksOverride) {
    try {
        let trucks;
        if (trucksOverride) {
            // Use data passed directly from onSnapshot (no extra fetch needed)
            trucks = trucksOverride;
            console.log('[GPS] loadTruckPositions: using snapshot data (' + trucks.length + ' trucks)');
        } else {
            // Fallback: fetch fresh from Firestore
            const trucksSnap = await getDocs(collection(db, COLLECTIONS.trucks));
            trucks = trucksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log('[GPS] loadTruckPositions: fetched ' + trucks.length + ' trucks from Firestore');
        }
        const drivers = await DataModule.getDrivers();

        // Log GPS data for each truck
        trucks.forEach(t => {
            if (t.lastLocation) {
                console.log(`[GPS] 🚛 ${t.matricule} → lat=${t.lastLocation.lat}, lng=${t.lastLocation.lng}, source=${t.lastLocation.source}, time=${t.lastLocation.timestamp}`);
            }
        });

        // Update info panel
        renderInfoPanel(trucks, drivers);

        // Clear old markers
        Object.values(markers).forEach(m => map?.removeLayer(m));
        markers = {};

        // ONLY show trucks with REAL GPS data (from phone/RTDB)
        const trucksWithGps = trucks.filter(truck => {
            const loc = truck.lastLocation;
            const lat = parseFloat(loc?.lat);
            const lng = parseFloat(loc?.lng);
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });

        console.log(`[GPS] Showing ${trucksWithGps.length} trucks with real GPS (skipping ${trucks.length - trucksWithGps.length} without GPS)`);

        trucksWithGps.forEach(truck => {
            const driver = drivers.find(d => d.camionId === truck.id);
            const loc = truck.lastLocation;
            const lat = parseFloat(loc.lat);
            const lng = parseFloat(loc.lng);

            // Speed: loc.speed is in m/s from device GPS, convert to km/h
            const speedMs = parseFloat(loc?.speed);
            const speedKmh = (!isNaN(speedMs) && speedMs > 0) ? Math.round(speedMs * 3.6) : (speedMs === 0 ? 0 : null);

            console.log(`[GPS] Marker: ${truck.matricule} → [${lat}, ${lng}] speed=${speedKmh !== null ? speedKmh + ' km/h' : 'N/A'} source=${loc.source}`);

            const icon = createTruckIcon(truck.type, speedKmh);
            const marker = L.marker([lat, lng], { icon }).addTo(map);

            // Popup content
            const lastUpdate = loc?.timestamp
                ? new Date(loc.timestamp).toLocaleString('fr-FR')
                : 'Jamais';

            // GPS source badge
            const sourceLabel = loc?.source === 'mobile_gps' ? '📱 GPS Mobile'
                : loc?.source === 'gps' ? '🌐 GPS Web'
                : loc?.source ? '📌 ' + loc.source : '';
            const sourceBadge = sourceLabel
                ? `<div style="margin-top:4px"><span style="display:inline-block;padding:2px 8px;background:rgba(139,92,246,0.1);border-radius:4px;font-size:11px;color:#8b5cf6;font-weight:600">${sourceLabel}</span></div>`
                : '';
            const speedColor = speedKmh === null ? '#64748b' : speedKmh > 80 ? '#ef4444' : speedKmh > 40 ? '#f59e0b' : '#10b981';
            const speedInfo = (speedKmh !== null)
                ? `<div><strong>Vitesse:</strong> <span style="color:${speedColor};font-weight:700">${speedKmh} km/h</span></div>` : '';

            marker.bindPopup(`
                <div style="min-width:220px;font-family:Inter,sans-serif">
                    <div style="font-weight:700;font-size:15px;margin-bottom:8px;color:#1e293b">
                        🚛 ${truck.matricule}
                    </div>
                    <div style="display:grid;gap:4px;font-size:13px;color:#475569">
                        <div><strong>Type:</strong> <span style="color:${TYPE_COLORS[truck.type] || '#6366f1'};font-weight:600">${truck.type}</span></div>
                        <div><strong>Chauffeur:</strong> ${driver?.nom || 'Non assigné'}</div>
                        <div><strong>Position:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                        ${speedInfo}
                        <div><strong>Dernière MAJ:</strong> ${lastUpdate}</div>
                        ${sourceBadge}
                        <div style="margin-top:6px"><button onclick="TrackingModule.showHistory('${truck.id}')" style="padding:4px 10px;background:#6366f1;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">📍 Historique trajet</button></div>
                    </div>
                </div>
            `);

            markers[truck.id] = marker;
        });

    } catch (err) {
        console.error('Error loading truck positions:', err);
    }
}

function renderInfoPanel(trucks, drivers) {
    const panel = document.getElementById('trackingInfoPanel');
    if (!panel) return;

    const withLoc = trucks.filter(t => t.lastLocation?.lat).length;
    const mobileGps = trucks.filter(t => t.lastLocation?.source === 'mobile_gps').length;
    const total = trucks.length;

    panel.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
            <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(15,23,42,0.4);border-radius:8px;border:1px solid rgba(148,163,184,0.1)">
                <span style="font-size:18px">🚛</span>
                <div>
                    <div style="font-size:18px;font-weight:700;color:#f1f5f9">${total}</div>
                    <div style="font-size:11px;color:#64748b">Camions</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(16,185,129,0.1);border-radius:8px;border:1px solid rgba(16,185,129,0.2)">
                <span style="font-size:18px">📍</span>
                <div>
                    <div style="font-size:18px;font-weight:700;color:#10b981">${withLoc}</div>
                    <div style="font-size:11px;color:#64748b">Localisés</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(139,92,246,0.1);border-radius:8px;border:1px solid rgba(139,92,246,0.2)">
                <span style="font-size:18px">📱</span>
                <div>
                    <div style="font-size:18px;font-weight:700;color:#8b5cf6">${mobileGps}</div>
                    <div style="font-size:11px;color:#64748b">GPS Mobile</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.2)">
                <span style="font-size:18px">❓</span>
                <div>
                    <div style="font-size:18px;font-weight:700;color:#ef4444">${total - withLoc}</div>
                    <div style="font-size:11px;color:#64748b">Non localisés</div>
                </div>
            </div>
            <!-- Legend -->
            <div style="display:flex;gap:12px;margin-left:auto;font-size:12px;color:#94a3b8">
                <span><span style="display:inline-block;width:12px;height:12px;background:#3b82f6;border-radius:50%;margin-right:4px"></span>Plateau</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#f59e0b;border-radius:50%;margin-right:4px"></span>Benne</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#10b981;border-radius:50%;margin-right:4px"></span>Citerne</span>
            </div>
            <button onclick="TrackingModule.refreshPositions()" style="padding:8px 16px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🔄 Actualiser</button>
        </div>
    `;
}

// Manual position editing REMOVED — positions come only from real phone GPS via RTDB

function centerOnTruck(truckId) {
    const marker = markers[truckId];
    if (marker) {
        map.setView(marker.getLatLng(), 14);
        marker.openPopup();
    }
}

function fitAllTrucks() {
    const markerList = Object.values(markers);
    if (markerList.length === 0) return;
    const group = L.featureGroup(markerList);
    map.fitBounds(group.getBounds().pad(0.1));
}

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        // Only reload Firestore truck metadata as fallback
        // Real-time GPS comes from RTDB listener
        loadTruckPositions();
    }, 5000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function refreshPositions() {
    console.log('[GPS] Manual refresh triggered');
    await loadTruckPositions();
}


// Real-time RTDB listener for GPS positions at /gps_positions
function startRtdbListener() {
    if (rtdbUnsubscribe) return; // already listening
    try {
        const gpsRef = dbRef(rtdb, 'gps_positions');
        rtdbUnsubscribe = onValue(gpsRef, (snapshot) => {
            const gpsData = snapshot.val();
            console.log('[GPS] 📡 RTDB onValue fired:', gpsData ? Object.keys(gpsData).length + ' trucks with GPS' : 'no data');

            if (!gpsData || !map) return;

            // Log each GPS position
            Object.entries(gpsData).forEach(([truckId, loc]) => {
                const truck = cachedTrucks.find(t => t.id === truckId);
                console.log(`[GPS]   🚛 ${truck?.matricule || truckId} → lat=${loc.lat}, lng=${loc.lng}, time=${loc.timestamp}`);
            });

            // Merge RTDB GPS data into cached trucks and update map
            const trucksWithGps = cachedTrucks.map(truck => {
                const rtdbLoc = gpsData[truck.id];
                if (rtdbLoc) {
                    return { ...truck, lastLocation: rtdbLoc };
                }
                return truck;
            });

            loadTruckPositions(trucksWithGps);
        }, (err) => {
            console.error('[GPS] ❌ RTDB onValue error:', err);
        });
        console.log('[GPS] 📡 RTDB real-time GPS listener started on /gps_positions');
    } catch (err) {
        console.error('[GPS] ❌ Could not start RTDB listener:', err);
    }
}

function stopRealtimeListener() {
    if (rtdbUnsubscribe) {
        // For RTDB, onValue returns an unsubscribe function
        rtdbUnsubscribe();
        rtdbUnsubscribe = null;
    }
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }
}

function destroy() {
    stopAutoRefresh();
    stopRealtimeListener();
    if (map) {
        map.remove();
        map = null;
    }
    markers = {};
}

// ==================== TRAJECTORY HISTORY ====================
async function showHistory(truckId) {
    // Clear previous trajectory
    clearHistory();
    activeHistoryTruckId = truckId;

    const truck = cachedTrucks.find(t => t.id === truckId);
    console.log(`[GPS] Loading trajectory history for ${truck?.matricule || truckId}`);

    try {
        // Load from RTDB /gps_history/{truckId}
        const histRef = dbRef(rtdb, `gps_history/${truckId}`);
        const snap = await dbGet(histRef);
        if (!snap.exists()) {
            alert('Aucun historique de trajet disponible pour ce camion');
            return;
        }

        const data = snap.val();
        const points = Object.values(data)
            .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        if (points.length < 2) {
            alert('Pas assez de points pour tracer le trajet');
            return;
        }

        // Draw polyline
        const latlngs = points.map(p => [parseFloat(p.lat), parseFloat(p.lng)]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
        const polyline = L.polyline(latlngs, {
            color: '#8b5cf6',
            weight: 4,
            opacity: 0.8,
            dashArray: '8, 4'
        }).addTo(map);
        trajectoryLayers[truckId] = [polyline];

        // Add speed markers at intervals
        const step = Math.max(1, Math.floor(points.length / 20)); // max ~20 markers
        for (let i = 0; i < points.length; i += step) {
            const p = points[i];
            const lat = parseFloat(p.lat);
            const lng = parseFloat(p.lng);
            if (isNaN(lat) || isNaN(lng)) continue;

            const spd = (p.speed !== null && p.speed !== undefined && p.speed >= 0) ? Math.round(p.speed * 3.6) : null;
            const spdColor = spd === null ? '#64748b' : spd > 80 ? '#ef4444' : spd > 40 ? '#f59e0b' : '#10b981';
            const time = p.timestamp ? new Date(p.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

            const icon = L.divIcon({
                className: 'history-dot',
                html: `<div style="width:12px;height:12px;border-radius:50%;background:${spdColor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });
            const m = L.marker([lat, lng], { icon }).addTo(map);
            m.bindPopup(`<div style="font-size:12px"><strong>${time}</strong><br>${spd !== null ? spd + ' km/h' : '-'}</div>`);
            trajectoryLayers[truckId].push(m);
        }

        // Fit map to trajectory
        map.fitBounds(polyline.getBounds().pad(0.1));

        console.log(`[GPS] Trajectory: ${points.length} points drawn for ${truck?.matricule}`);
    } catch (err) {
        console.error('[GPS] Error loading trajectory history:', err);
        alert('Erreur lors du chargement de l\'historique: ' + (err.message || err));
    }
}

function clearHistory() {
    Object.values(trajectoryLayers).forEach(layers => {
        layers.forEach(layer => map?.removeLayer(layer));
    });
    trajectoryLayers = {};
    activeHistoryTruckId = null;
}

export const TrackingModule = {
    init, refresh, destroy,
    centerOnTruck, fitAllTrucks,
    refreshPositions,
    showHistory, clearHistory
};
window.TrackingModule = TrackingModule;
