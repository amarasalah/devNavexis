/**
 * DRIVERS MODULE - FIREBASE VERSION
 * With performance statistics
 */

import { DataModule } from './data-firebase.js';
import { AuthModule } from './auth-firebase.js';

function init() {
    document.getElementById('addDriverBtn')?.addEventListener('click', () => openModal());
}

async function refresh() {
    await renderDrivers();
}

function calculateDriverStats(driverId) {
    const allEntries = DataModule.getCachedEntries();
    const driver = DataModule.getDriverById(driverId);
    // Match entries by ID directly, or by old-format ID containing driver name
    const nomNorm = driver?.nom?.replace(/\s+/g, '_') || '';
    const driverEntries = allEntries.filter(e =>
        e.chauffeurId === driverId || (nomNorm && e.chauffeurId === `driver_${nomNorm}`)
    );

    if (driverEntries.length === 0) {
        return {
            totalKm: 0, totalGasoil: 0, totalCout: 0, totalRevenue: 0,
            resultat: 0, coutParKm: 0, consommation: 0, nbTrajets: 0, performance: 0
        };
    }

    let totalKm = 0, totalGasoil = 0, totalCout = 0, totalRevenue = 0;

    // Track first trip per truck per day (fixed charges only once)
    const truckDaySeen = new Set();

    driverEntries.forEach(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        totalKm += entry.kilometrage || 0;
        totalGasoil += entry.quantiteGasoil || 0;
        totalRevenue += entry.prixLivraison || 0;
        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip);
        totalCout += costs.coutTotal;
    });

    const resultat = totalRevenue - totalCout;
    const coutParKm = totalKm > 0 ? totalCout / totalKm : 0;
    const consommation = totalKm > 0 ? (totalGasoil / totalKm) * 100 : 0;
    const performance = totalRevenue > 0 ? (resultat / totalRevenue) * 100 : 0;

    return { totalKm, totalGasoil, totalCout, totalRevenue, resultat, coutParKm, consommation, nbTrajets: driverEntries.length, performance };
}

async function renderDrivers() {
    const drivers = await DataModule.getDrivers();
    const trucks = await DataModule.getTrucks();
    // Fetch users to check which drivers have messenger accounts
    let linkedDriverIds = [];
    try {
        const allUsers = await AuthModule.getAllUsers();
        linkedDriverIds = allUsers.filter(u => u.driverId).map(u => u.driverId);
    } catch (e) { console.warn('Could not fetch users for messenger badges'); }
    const grid = document.getElementById('driversGrid');
    if (!grid) return;

    grid.innerHTML = drivers.map(driver => {
        const truck = trucks.find(t => t.id === driver.camionId);
        const hasAccount = linkedDriverIds.includes(driver.id);
        const stats = calculateDriverStats(driver.id);
        const performanceClass = stats.performance >= 20 ? 'perf-excellent' : stats.performance >= 10 ? 'perf-good' : stats.performance >= 0 ? 'perf-average' : 'perf-bad';
        const resultatClass = stats.resultat >= 0 ? 'result-positive' : 'result-negative';

        return `
        <div class="entity-card driver-card">
            <div class="entity-header">
                <div class="entity-icon" style="${driver.photoUrl ? 'padding:0;overflow:hidden;border-radius:50%' : ''}">
                    ${driver.photoUrl ? `<img src="${driver.photoUrl}" style="width:100%;height:100%;object-fit:cover" alt="${driver.nom}">` : '👤'}
                </div>
                <div class="entity-info">
                    <h3>${driver.nom}</h3>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <span class="entity-badge ${truck ? '' : 'badge-warning'}">${truck ? truck.matricule : 'Non assigné'}</span>
                        ${hasAccount ? '<span style="font-size:11px;padding:2px 8px;background:rgba(16,185,129,0.15);color:#10b981;border-radius:4px;font-weight:600">Compte ✅</span>' : '<span style="font-size:11px;padding:2px 8px;background:rgba(239,68,68,0.1);color:#ef4444;border-radius:4px">Sans compte</span>'}
                    </div>
                </div>
                <div class="entity-actions">
                    ${hasAccount ? `<button class="btn btn-sm" style="background:rgba(99,102,241,0.15);color:#6366f1;border:1px solid rgba(99,102,241,0.3)" onclick="window.openDriverChat('${driver.id}')" title="Envoyer un message">💬</button>` : ''}
                    <button class="btn btn-sm btn-profile" onclick="ProfileModule.openDriverProfile('${driver.id}')" title="Voir Profil">📊</button>
                    <button class="btn btn-sm btn-outline" onclick="DriversModule.edit('${driver.id}')">✏️</button>
                    <button class="btn btn-sm btn-outline" onclick="DriversModule.remove('${driver.id}')">🗑️</button>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">🛣️ Kilométrage</span><span class="stat-value">${stats.totalKm.toLocaleString('fr-FR')} km</span></div>
                <div class="stat-item"><span class="stat-label">⛽ Gasoil</span><span class="stat-value">${stats.totalGasoil.toLocaleString('fr-FR')} L</span></div>
                <div class="stat-item"><span class="stat-label">📊 Conso.</span><span class="stat-value">${stats.consommation.toFixed(1)} L/100km</span></div>
                <div class="stat-item"><span class="stat-label">💵 Coût/Km</span><span class="stat-value">${stats.coutParKm.toFixed(2)} TND</span></div>
            </div>
            
            <div class="financial-summary">
                <div class="fin-row"><span>📈 Revenus:</span><span class="result-positive">${stats.totalRevenue.toLocaleString('fr-FR')} TND</span></div>
                <div class="fin-row"><span>📉 Coûts:</span><span class="result-negative">${stats.totalCout.toLocaleString('fr-FR')} TND</span></div>
                <div class="fin-row fin-result"><span>💰 Résultat:</span><span class="${resultatClass}">${stats.resultat.toLocaleString('fr-FR')} TND</span></div>
            </div>
            
            <div class="performance-bar">
                <div class="perf-label"><span>Performance</span><span class="${performanceClass}">${stats.performance.toFixed(1)}%</span></div>
                <div class="perf-track"><div class="perf-fill ${performanceClass}" style="width: ${Math.max(0, Math.min(100, stats.performance + 50))}%"></div></div>
            </div>
            
            <div class="entity-footer">
                <span class="trajet-count">📍 ${stats.nbTrajets} trajet(s)</span>
                ${truck ? `<span class="truck-type">${truck.type}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

async function openModal(driverId = null) {
    const driver = driverId ? DataModule.getDriverById(driverId) : null;
    const trucks = await DataModule.getTrucks();
    const truckOptions = trucks.map(t => `<option value="${t.id}" ${driver?.camionId === t.id ? 'selected' : ''}>${t.matricule} (${t.type})</option>`).join('');

    document.getElementById('modalTitle').textContent = driver ? 'Modifier Chauffeur' : 'Nouveau Chauffeur';
    document.getElementById('modalBody').innerHTML = `
        <form id="driverForm">
            <input type="hidden" id="driverId" value="${driver?.id || ''}">
            <input type="hidden" id="driverPhotoUrl" value="${driver?.photoUrl || ''}">
            <div class="form-group">
                <label>📷 Photo du chauffeur</label>
                <div style="display:flex;align-items:center;gap:12px">
                    ${driver?.photoUrl ? `<img id="driverPhotoPreview" src="${driver.photoUrl}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid rgba(139,92,246,0.3)">` : `<div id="driverPhotoPreview" style="width:60px;height:60px;border-radius:50%;background:rgba(30,41,59,0.6);display:flex;align-items:center;justify-content:center;font-size:24px;border:2px dashed rgba(148,163,184,0.2)">👤</div>`}
                    <input type="file" id="driverPhotoFile" accept="image/*" style="flex:1">
                </div>
            </div>
            <div class="form-group"><label>Nom</label><input type="text" id="driverNom" value="${driver?.nom || ''}" required></div>
            <div class="form-group"><label>Camion Assigné</label><select id="driverCamion"><option value="">-- Non assigné --</option>${truckOptions}</select></div>
        </form>`;
    document.getElementById('modalSave').onclick = saveDriver;
    App.showModal();
}

async function saveDriver() {
    const driver = {
        id: document.getElementById('driverId').value || null,
        nom: document.getElementById('driverNom').value,
        camionId: document.getElementById('driverCamion').value || null,
        photoUrl: document.getElementById('driverPhotoUrl').value || null
    };
    if (!driver.nom) { alert('Nom requis'); return; }

    // Upload photo if a new file was selected
    const photoFile = document.getElementById('driverPhotoFile')?.files[0];
    if (photoFile) {
        try {
            const result = await CloudinaryHelper.uploadToCloudinary(photoFile, 'profiles/drivers');
            driver.photoUrl = result.url;
        } catch (err) {
            console.error('Photo upload error:', err);
            alert('Erreur upload photo: ' + err.message);
            return;
        }
    }

    await DataModule.saveDriver(driver);
    App.hideModal();
    refresh();
}

function edit(id) { openModal(id); }

async function remove(id) {
    if (confirm('Supprimer ce chauffeur ?')) {
        await DataModule.deleteDriver(id);
        refresh();
    }
}

export const DriversModule = { init, refresh, edit, remove };
window.DriversModule = DriversModule;
