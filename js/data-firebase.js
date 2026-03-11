/**
 * DATA MODULE - FIREBASE FIRESTORE VERSION
 * Handles Firestore persistence and CRUD operations
 * With activity logging for all operations
 */

import {
    db,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    COLLECTIONS
} from './firebase.js';

// Local cache for faster access
let cache = {
    trucks: null,
    drivers: null,
    entries: null,
    settings: null,
    logs: null
};

// Default settings
const DEFAULT_SETTINGS = {
    id: 'default',
    defaultFuelPrice: 2,
    currency: 'TND'
};

// Pre-loaded trucks from Excel
const DEFAULT_TRUCKS = [

];

// Pre-loaded drivers from Excel
const DEFAULT_DRIVERS = [

];

// Generate UUID
function generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ==================== ACTIVITY LOGGING ====================
async function logActivity(action, entityType, entityId, details = {}) {
    try {
        const logEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            action: action, // CREATE, UPDATE, DELETE, READ, EXPORT, IMPORT, RESET
            entityType: entityType, // truck, driver, entry, settings
            entityId: entityId,
            details: details,
            date: new Date().toISOString().split('T')[0]
        };

        await setDoc(doc(db, COLLECTIONS.logs, logEntry.id), logEntry);

        // Update cache
        if (cache.logs) {
            cache.logs.push(logEntry);
        }

        console.log(`📝 Log: ${action} ${entityType} ${entityId}`);
        return logEntry;
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - logging should not block main operations
    }
}

async function getLogs() {
    if (cache.logs) return cache.logs;

    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.logs));
        cache.logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by timestamp descending
        cache.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return cache.logs;
    } catch (error) {
        console.error('Error getting logs:', error);
        return [];
    }
}

async function getLogsByDate(date) {
    const logs = await getLogs();
    return logs.filter(l => l.date === date);
}

async function getLogsByEntity(entityType, entityId) {
    const logs = await getLogs();
    return logs.filter(l => l.entityType === entityType && l.entityId === entityId);
}

// Initialize - populate Firestore with default data if empty
async function init() {
    try {
        console.log('🔥 Initializing Firebase connection...');

        // Check if trucks collection exists
        const trucksSnapshot = await getDocs(collection(db, COLLECTIONS.trucks));
        if (trucksSnapshot.empty) {
            console.log('📦 Populating trucks...');
            for (const truck of DEFAULT_TRUCKS) {
                await setDoc(doc(db, COLLECTIONS.trucks, truck.id), truck);
            }
            await logActivity('INIT', 'trucks', 'all', { count: DEFAULT_TRUCKS.length });
        }

        // Check if drivers collection exists
        const driversSnapshot = await getDocs(collection(db, COLLECTIONS.drivers));
        if (driversSnapshot.empty) {
            console.log('👤 Populating drivers...');
            for (const driver of DEFAULT_DRIVERS) {
                await setDoc(doc(db, COLLECTIONS.drivers, driver.id), driver);
            }
            await logActivity('INIT', 'drivers', 'all', { count: DEFAULT_DRIVERS.length });
        }

        // Check settings
        const settingsDoc = await getDoc(doc(db, COLLECTIONS.settings, 'default'));
        if (!settingsDoc.exists()) {
            console.log('⚙️ Creating default settings...');
            await setDoc(doc(db, COLLECTIONS.settings, 'default'), DEFAULT_SETTINGS);
            await logActivity('INIT', 'settings', 'default', DEFAULT_SETTINGS);
        }

        console.log('✅ Firebase initialized successfully!');

        // Preload cache
        await refreshCache();

        // Auto-repair entries with old-format IDs
        await repairEntryIds();

    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        console.log('⚠️ Falling back to localStorage...');
    }
}

// Refresh local cache from Firestore
async function refreshCache() {
    try {
        const [trucksSnap, driversSnap, entriesSnap, logsSnap] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.trucks)),
            getDocs(collection(db, COLLECTIONS.drivers)),
            getDocs(collection(db, COLLECTIONS.entries)),
            getDocs(collection(db, COLLECTIONS.logs))
        ]);

        cache.trucks = trucksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cache.drivers = driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cache.entries = entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cache.logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cache.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const settingsDoc = await getDoc(doc(db, COLLECTIONS.settings, 'default'));
        cache.settings = settingsDoc.exists() ? settingsDoc.data() : DEFAULT_SETTINGS;

    } catch (error) {
        console.error('Cache refresh error:', error);
    }
}

// Synchronous accessor for cached entries (for modules that need sync access)
function getCachedEntries() {
    return cache.entries || [];
}

function getCachedTrucks() {
    return cache.trucks || [];
}

function getCachedDrivers() {
    return cache.drivers || [];
}

// Lightweight refresh: trucks only (for GPS real-time updates)
async function refreshTrucksOnly() {
    try {
        const trucksSnap = await getDocs(collection(db, COLLECTIONS.trucks));
        cache.trucks = trucksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Trucks cache refresh error:', error);
    }
}

// ==================== TRUCKS ====================
async function getTrucks() {
    if (cache.trucks) return cache.trucks;

    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.trucks));
        cache.trucks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cache.trucks;
    } catch (error) {
        console.error('Error getting trucks:', error);
        return [];
    }
}

function getTruckById(id) {
    if (!cache.trucks) return null;
    // Direct ID match
    let truck = cache.trucks.find(t => t.id === id);
    if (truck) return truck;
    // Fallback: old import format 'truck_8565_TU_257' → match by matricule
    if (id && id.startsWith('truck_')) {
        const mat = id.replace('truck_', '').replace(/_/g, ' ');
        truck = cache.trucks.find(t => t.matricule === mat);
    }
    return truck || null;
}

async function saveTruck(truck) {
    try {
        const isNew = !truck.id;
        if (!truck.id) {
            truck.id = generateId();
        }
        truck.updatedAt = new Date().toISOString();

        await setDoc(doc(db, COLLECTIONS.trucks, truck.id), truck);
        await logActivity(isNew ? 'CREATE' : 'UPDATE', 'truck', truck.id, { matricule: truck.matricule, type: truck.type });

        // Update cache
        if (cache.trucks) {
            const idx = cache.trucks.findIndex(t => t.id === truck.id);
            if (idx >= 0) cache.trucks[idx] = truck;
            else cache.trucks.push(truck);
        }

        return truck;
    } catch (error) {
        console.error('Error saving truck:', error);
        throw error;
    }
}

async function deleteTruck(id) {
    try {
        const truck = getTruckById(id);
        await deleteDoc(doc(db, COLLECTIONS.trucks, id));
        await logActivity('DELETE', 'truck', id, { matricule: truck?.matricule });

        if (cache.trucks) {
            cache.trucks = cache.trucks.filter(t => t.id !== id);
        }
    } catch (error) {
        console.error('Error deleting truck:', error);
        throw error;
    }
}

// ==================== DRIVERS ====================
async function getDrivers() {
    if (cache.drivers) return cache.drivers;

    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.drivers));
        cache.drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cache.drivers;
    } catch (error) {
        console.error('Error getting drivers:', error);
        return [];
    }
}

function getDriverById(id) {
    if (!cache.drivers) return null;
    // Direct ID match
    let driver = cache.drivers.find(d => d.id === id);
    if (driver) return driver;
    // Fallback: old import format 'driver_CHOKAIRI' → match by nom
    if (id && id.startsWith('driver_')) {
        const nom = id.replace('driver_', '').replace(/_/g, ' ');
        driver = cache.drivers.find(d => d.nom === nom);
    }
    return driver || null;
}

async function saveDriver(driver) {
    try {
        const isNew = !driver.id;
        if (!driver.id) {
            driver.id = generateId();
        }
        driver.updatedAt = new Date().toISOString();

        await setDoc(doc(db, COLLECTIONS.drivers, driver.id), driver);
        await logActivity(isNew ? 'CREATE' : 'UPDATE', 'driver', driver.id, { nom: driver.nom, camionId: driver.camionId });

        if (cache.drivers) {
            const idx = cache.drivers.findIndex(d => d.id === driver.id);
            if (idx >= 0) cache.drivers[idx] = driver;
            else cache.drivers.push(driver);
        }

        return driver;
    } catch (error) {
        console.error('Error saving driver:', error);
        throw error;
    }
}

async function deleteDriver(id) {
    try {
        const driver = getDriverById(id);
        await deleteDoc(doc(db, COLLECTIONS.drivers, id));
        await logActivity('DELETE', 'driver', id, { nom: driver?.nom });

        if (cache.drivers) {
            cache.drivers = cache.drivers.filter(d => d.id !== id);
        }
    } catch (error) {
        console.error('Error deleting driver:', error);
        throw error;
    }
}

// ==================== ENTRIES ====================
async function getEntries() {
    if (cache.entries) return cache.entries;

    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.entries));
        cache.entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cache.entries;
    } catch (error) {
        console.error('Error getting entries:', error);
        return [];
    }
}

function getEntriesByDate(date) {
    if (cache.entries) {
        return cache.entries.filter(e => e.date === date);
    }
    return [];
}

function getEntriesByMonth(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    if (cache.entries) {
        return cache.entries.filter(e => e.date && e.date.startsWith(prefix));
    }
    return [];
}

async function saveEntry(entry) {
    try {
        const isNew = !entry.id;
        if (!entry.id) {
            entry.id = generateId();
        }
        entry.updatedAt = new Date().toISOString();
        if (!entry.createdAt) {
            entry.createdAt = entry.updatedAt;
        }

        // Sanitize: Firestore does not accept undefined values
        const cleanEntry = {};
        for (const [key, value] of Object.entries(entry)) {
            cleanEntry[key] = value === undefined ? null : value;
        }

        await setDoc(doc(db, COLLECTIONS.entries, cleanEntry.id), cleanEntry);
        console.log(`💾 Entry saved to Firestore: ${cleanEntry.id} (date: ${cleanEntry.date})`);

        // Log with detailed entry info
        await logActivity(isNew ? 'CREATE' : 'UPDATE', 'entry', cleanEntry.id, {
            date: cleanEntry.date,
            camionId: cleanEntry.camionId,
            chauffeurId: cleanEntry.chauffeurId,
            origine: cleanEntry.origine,
            destination: cleanEntry.destination,
            kilometrage: cleanEntry.kilometrage,
            distanceAller: cleanEntry.distanceAller,
            distanceRetour: cleanEntry.distanceRetour,
            quantiteGasoil: cleanEntry.quantiteGasoil,
            prixGasoilLitre: cleanEntry.prixGasoilLitre,
            maintenance: cleanEntry.maintenance,
            prixLivraison: cleanEntry.prixLivraison,
            remarques: cleanEntry.remarques
        });

        if (cache.entries) {
            const idx = cache.entries.findIndex(e => e.id === cleanEntry.id);
            if (idx >= 0) cache.entries[idx] = cleanEntry;
            else cache.entries.push(cleanEntry);
        }

        return cleanEntry;
    } catch (error) {
        console.error('Error saving entry:', error);
        throw error;
    }
}

async function deleteEntry(id) {
    try {
        const entry = cache.entries?.find(e => e.id === id);
        await deleteDoc(doc(db, COLLECTIONS.entries, id));
        await logActivity('DELETE', 'entry', id, {
            date: entry?.date,
            destination: entry?.destination,
            origine: entry?.origine
        });

        if (cache.entries) {
            cache.entries = cache.entries.filter(e => e.id !== id);
        }
    } catch (error) {
        console.error('Error deleting entry:', error);
        throw error;
    }
}

// ==================== SETTINGS ====================
async function getSettings() {
    if (cache.settings) return cache.settings;

    try {
        const settingsDoc = await getDoc(doc(db, COLLECTIONS.settings, 'default'));
        cache.settings = settingsDoc.exists() ? settingsDoc.data() : DEFAULT_SETTINGS;
        return cache.settings;
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_SETTINGS;
    }
}

async function saveSettings(settings) {
    try {
        await setDoc(doc(db, COLLECTIONS.settings, 'default'), settings);
        await logActivity('UPDATE', 'settings', 'default', settings);
        cache.settings = settings;
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

// ==================== AUTO-REPAIR & DEDUPLICATE ENTRIES ====================
async function repairEntryIds() {
    if (!cache.entries || !cache.trucks || !cache.drivers) return;
    let repaired = 0;
    let deleted = 0;

    // Phase 1: Fix old-format camionId/chauffeurId
    for (const entry of cache.entries) {
        let needsUpdate = false;
        const updated = { ...entry };

        // Fix camionId: truck_8565_TU_257 → t1
        if (entry.camionId && entry.camionId.startsWith('truck_')) {
            const mat = entry.camionId.replace('truck_', '').replace(/_/g, ' ');
            const truck = cache.trucks.find(t => t.matricule === mat);
            if (truck && truck.id !== entry.camionId) {
                updated.camionId = truck.id;
                updated.matricule = updated.matricule || mat;
                needsUpdate = true;
            }
        }

        // Fix chauffeurId: driver_CHOKAIRI → d1
        if (entry.chauffeurId && entry.chauffeurId.startsWith('driver_')) {
            const nom = entry.chauffeurId.replace('driver_', '').replace(/_/g, ' ');
            const driver = cache.drivers.find(d => d.nom === nom);
            if (driver && driver.id !== entry.chauffeurId) {
                updated.chauffeurId = driver.id;
                updated.chauffeur = updated.chauffeur || nom;
                needsUpdate = true;
            }
        }

        // Ensure matricule/chauffeur fields are populated
        if (!updated.matricule && updated.camionId) {
            const truck = cache.trucks.find(t => t.id === updated.camionId);
            if (truck) { updated.matricule = truck.matricule; needsUpdate = true; }
        }
        if (!updated.chauffeur && updated.chauffeurId) {
            const driver = cache.drivers.find(d => d.id === updated.chauffeurId);
            if (driver) { updated.chauffeur = driver.nom; needsUpdate = true; }
        }

        if (needsUpdate) {
            try {
                await setDoc(doc(db, COLLECTIONS.entries, entry.id), updated);
                Object.assign(entry, updated);
                repaired++;
            } catch (err) {
                console.error('Repair failed for entry', entry.id, err);
            }
        }
    }

    // Phase 2: Deduplicate (remove old-format entries if new-format exists for same date+truck)
    // IMPORTANT: Never delete entries from planification or idle_day sources
    // Multiple trips per truck per day are legitimate (e.g., planification entries)
    const seen = new Map(); // key: date_camionId → best entry
    const toDelete = [];

    for (const entry of cache.entries) {
        // Skip planification-sourced and idle_day entries from dedup — they are always legitimate
        if (entry.source === 'planification' || entry.source === 'idle_day') continue;

        const key = `${entry.date}_${entry.camionId}`;
        if (seen.has(key)) {
            // Keep the newer/better entry (prefer entry_date_tX format, then by createdAt)
            const existing = seen.get(key);
            const existingIsNew = existing.id.match(/^entry_\d{4}-\d{2}-\d{2}_t\d+$/);
            const currentIsNew = entry.id.match(/^entry_\d{4}-\d{2}-\d{2}_t\d+$/);
            if (currentIsNew && !existingIsNew) {
                toDelete.push(existing.id);
                seen.set(key, entry);
            } else if (!currentIsNew && existingIsNew) {
                toDelete.push(entry.id);
            } else {
                // Both same format — keep the one with later createdAt
                const existingTime = new Date(existing.createdAt || 0).getTime();
                const currentTime = new Date(entry.createdAt || 0).getTime();
                if (currentTime > existingTime) {
                    toDelete.push(existing.id);
                    seen.set(key, entry);
                } else {
                    toDelete.push(entry.id);
                }
            }
        } else {
            seen.set(key, entry);
        }
    }

    // Also check: if an idle_day entry exists AND a real trip entry exists for same date+truck,
    // remove the idle_day entry (it was created before the trip happened)
    for (const entry of cache.entries) {
        if (entry.source === 'idle_day') {
            const key = `${entry.date}_${entry.camionId}`;
            const hasTripEntry = cache.entries.some(e =>
                e.id !== entry.id &&
                e.date === entry.date &&
                e.camionId === entry.camionId &&
                e.source !== 'idle_day'
            );
            if (hasTripEntry) {
                toDelete.push(entry.id);
            }
        }
    }

    for (const id of toDelete) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.entries, id));
            deleted++;
        } catch (err) {
            console.error('Dedup delete failed for', id, err);
        }
    }

    if (deleted > 0) {
        cache.entries = cache.entries.filter(e => !toDelete.includes(e.id));
        console.log(`🧹 Removed ${deleted} duplicate entries`);
    }
    if (repaired > 0) {
        console.log(`🔧 Auto-repaired ${repaired} entries (old-format IDs → standard IDs)`);
    }
}

// ==================== MAINTENANCE FROM BON DE SORTIE ====================
/**
 * Compute total maintenance cost for a truck on a given date from Bons de Sortie.
 * Priority: bs.totalCoutBS > sum(ligne.prixUnitaire * ligne.quantiteSortie)
 * @param {string} camionId
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {Promise<number>} total maintenance cost from BS
 */
async function getMaintenanceCostFromBS(camionId, date) {
    try {
        const SM = window.SuppliersModule;
        if (!SM) return 0;
        const allSorties = await SM.getSorties();
        return getMaintenanceCostFromBSSync(allSorties, camionId, date);
    } catch (err) {
        console.error('Error computing BS maintenance:', err);
        return 0;
    }
}

/**
 * Synchronous version: compute BS maintenance from pre-fetched sorties array.
 * Fallback chain: bs.totalCoutBS → ligne.prixUnitaire → article.prixAchat
 * @param {Array} sorties - pre-fetched bons de sortie
 * @param {string} camionId
 * @param {string} date
 * @returns {number}
 */
function getMaintenanceCostFromBSSync(sorties, camionId, date) {
    const matchedBS = sorties.filter(s => s.camionId === camionId && s.date === date);
    if (matchedBS.length === 0) return 0;
    const SM = window.SuppliersModule;
    let total = 0;
    for (const bs of matchedBS) {
        // Priority 1: stored totalCoutBS (computed at save time)
        if (bs.totalCoutBS != null && bs.totalCoutBS > 0) {
            total += bs.totalCoutBS;
        } else {
            // Compute from line items with multi-tier price lookup
            let bsTotal = 0;
            // Pre-fetch BC for this BS (via BL → BC chain)
            let bcLignes = null;
            if (SM && bs.livraisonId) {
                const bl = SM.getLivraisonById(bs.livraisonId);
                if (bl?.commandeId) {
                    const bc = SM.getCommandeById(bl.commandeId);
                    if (bc) bcLignes = bc.lignes || [];
                }
            }
            for (const ligne of (bs.lignes || [])) {
                const qte = ligne.quantiteSortie || 0;
                if (qte <= 0) continue;
                let prix = 0;
                // Priority 2: stored prixUnitaire on BS line
                if (ligne.prixUnitaire && ligne.prixUnitaire > 0) {
                    prix = ligne.prixUnitaire;
                }
                // Priority 3: look up from BC (Bon de Commande) lignes
                if (!prix && bcLignes) {
                    const bcLine = bcLignes.find(cl => cl.nom === ligne.nom || (cl.articleId && cl.articleId === ligne.articleId));
                    if (bcLine) prix = bcLine.prixUnitaire || 0;
                }
                // Priority 4: article prixAchat fallback
                if (!prix && ligne.articleId) {
                    const AM = window.ArticlesModule;
                    if (AM) {
                        const article = AM.getArticleById(ligne.articleId);
                        if (article) prix = article.prixAchat || 0;
                    }
                }
                bsTotal += prix * qte;
            }
            total += bsTotal;
        }
    }
    return total;
}

// ==================== CALCULATIONS ====================
/**
 * @param {object} entry
 * @param {object} truck
 * @param {boolean} isFirstTripOfDay
 * @param {number|null} bsMaintenance - pre-computed BS maintenance; if null, falls back to entry.maintenance
 */
function calculateEntryCosts(entry, truck, isFirstTripOfDay = true, bsMaintenance = null) {
    if (!truck) truck = getTruckById(entry.camionId);

    // Gasoil is ALWAYS per-trip
    const montantGasoil = entry.montantGasoil || ((entry.quantiteGasoil || 0) * (entry.prixGasoilLitre || 2));
    // Maintenance: prefer BS-derived value if available, otherwise fall back to entry field
    const maintenance = bsMaintenance != null ? bsMaintenance : (entry.maintenance || 0);

    // Fixed charges apply ONLY for the first trip of the day per truck
    let chargesFixes = 0, montantAssurance = 0, montantTaxe = 0, chargePersonnel = 0, fraisLeasing = 0;
    if (isFirstTripOfDay) {
        chargesFixes = entry.chargesFixes != null ? entry.chargesFixes : (truck?.chargesFixes || 0);
        montantAssurance = entry.montantAssurance != null ? entry.montantAssurance : (truck?.montantAssurance || 0);
        montantTaxe = entry.montantTaxe != null ? entry.montantTaxe : (truck?.montantTaxe || 0);
        chargePersonnel = entry.chargePersonnel != null ? entry.chargePersonnel : (truck?.chargePersonnel || 0);
        fraisLeasing = entry.fraisLeasing != null ? entry.fraisLeasing : (truck?.fraisLeasing || 0);
    }

    const coutTotal = montantGasoil + chargesFixes + montantAssurance + montantTaxe + maintenance + chargePersonnel + fraisLeasing;
    const tauxTVA = entry.tauxTVA || 0;
    const prixLivraisonTTC = (entry.prixLivraison || 0) + ((entry.prixLivraison || 0) * tauxTVA / 100);
    const resultat = prixLivraisonTTC - coutTotal;

    return { montantGasoil, coutTotal, resultat };
}

// ==================== IDLE DAY ENTRIES ====================
/**
 * Generate idle-day entries for trucks with no trips on given dates.
 * These entries carry only fixed charges (assurance, taxe, etc.) with 0 km/gasoil/revenue.
 * Idempotent: skips dates/trucks that already have entries or idle_day entries.
 * @param {string} fromDate - Start date 'YYYY-MM-DD'
 * @param {string} toDate   - End date 'YYYY-MM-DD' (inclusive)
 */
async function generateIdleDayEntries(fromDate, toDate) {
    const trucks = await getTrucks();
    const entries = await getEntries();
    if (!trucks.length) return;

    // Build a set of existing (camionId + date) combos for quick lookup
    const existingSet = new Set();
    entries.forEach(e => {
        if (e.camionId && e.date) existingSet.add(`${e.camionId}_${e.date}`);
    });

    // Enumerate each date in range (all in LOCAL time to avoid UTC timezone shift!)
    const start = new Date(fromDate + 'T12:00:00'); // Use noon to completely avoid any timezone-day-boundary issues
    const end = new Date(toDate + 'T12:00:00');
    let created = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // IMPORTANT: Use local date parts, NOT toISOString() which converts to UTC!
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        // Skip Sundays — idle entries should NOT be auto-generated on Sundays
        // Belt-and-suspenders: check BOTH the Date object AND the parsed string
        if (d.getDay() === 0) continue;
        const [py, pm, pd] = dateStr.split('-').map(Number);
        if (new Date(py, pm - 1, pd).getDay() === 0) continue;

        for (const truck of trucks) {
            const key = `${truck.id}_${dateStr}`;
            if (existingSet.has(key)) continue; // truck already has an entry (trip or idle)

            // Create idle_day entry with fixed charges from truck
            const idleEntry = {
                date: dateStr,
                camionId: truck.id,
                chauffeurId: '',
                clientId: '',
                origineGouvernorat: '',
                origineDelegation: '',
                origine: '',
                gouvernorat: '',
                delegation: '',
                destination: '',
                distanceAller: 0,
                distanceRetour: 0,
                kilometrage: 0,
                quantiteGasoil: 0,
                prixGasoilLitre: 0,
                montantGasoil: 0,
                maintenance: 0,
                prixLivraison: 0,
                remarques: '🚫 Journée sans voyage - Charges fixes uniquement',
                source: 'idle_day'
            };

            try {
                await saveEntry(idleEntry);
                existingSet.add(key); // Prevent duplicates within this run
                created++;
            } catch (err) {
                console.error(`Error creating idle entry for ${truck.matricule} on ${dateStr}:`, err);
            }
        }
    }

    if (created > 0) {
        console.log(`🚫 ${created} entrées idle_day créées (${fromDate} → ${toDate})`);
    }
    return created;
}

// ==================== SUNDAY IDLE CLEANUP ====================
/**
 * Delete all existing idle_day entries that fall on Sundays.
 * Sundays should only have entries from planification.
 */
async function cleanupSundayIdleEntries() {
    // Force fresh fetch from Firestore, not cache
    if (cache.entries) cache.entries = null;
    const entries = await getEntries();
    const sundayIdles = entries.filter(e => {
        if (e.source !== 'idle_day' || !e.date) return false;
        const [y, m, d] = e.date.split('-').map(Number);
        return new Date(y, m - 1, d).getDay() === 0;
    });
    if (sundayIdles.length === 0) return 0;

    let deleted = 0;
    for (const entry of sundayIdles) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.entries, entry.id));
            if (cache.entries) {
                cache.entries = cache.entries.filter(e => e.id !== entry.id);
            }
            deleted++;
        } catch (err) {
            console.error(`Error deleting Sunday idle entry ${entry.id}:`, err);
        }
    }
    if (deleted > 0) {
        console.log(`🗑️ ${deleted} Sunday idle entries deleted`);
    }
    return deleted;
}

// ==================== EXPORT/IMPORT ====================
async function exportData() {
    await logActivity('EXPORT', 'all', 'backup', { timestamp: new Date().toISOString() });

    return {
        trucks: await getTrucks(),
        drivers: await getDrivers(),
        entries: await getEntries(),
        settings: await getSettings(),
        logs: await getLogs(),
        exportDate: new Date().toISOString()
    };
}

async function importData(data) {
    try {
        if (data.trucks) {
            for (const truck of data.trucks) {
                await setDoc(doc(db, COLLECTIONS.trucks, truck.id), truck);
            }
        }
        if (data.drivers) {
            for (const driver of data.drivers) {
                await setDoc(doc(db, COLLECTIONS.drivers, driver.id), driver);
            }
        }
        if (data.entries) {
            for (const entry of data.entries) {
                await setDoc(doc(db, COLLECTIONS.entries, entry.id), entry);
            }
        }
        if (data.settings) {
            await setDoc(doc(db, COLLECTIONS.settings, 'default'), data.settings);
        }

        await logActivity('IMPORT', 'all', 'restore', {
            trucksCount: data.trucks?.length || 0,
            driversCount: data.drivers?.length || 0,
            entriesCount: data.entries?.length || 0
        });

        await refreshCache();

    } catch (error) {
        console.error('Error importing data:', error);
        throw error;
    }
}

async function resetData() {
    try {
        // Log before reset
        await logActivity('RESET', 'all', 'reset', { timestamp: new Date().toISOString() });

        // Delete all entries
        const entriesSnap = await getDocs(collection(db, COLLECTIONS.entries));
        for (const entryDoc of entriesSnap.docs) {
            await deleteDoc(doc(db, COLLECTIONS.entries, entryDoc.id));
        }

        // Repopulate trucks
        for (const truck of DEFAULT_TRUCKS) {
            await setDoc(doc(db, COLLECTIONS.trucks, truck.id), truck);
        }

        // Repopulate drivers
        for (const driver of DEFAULT_DRIVERS) {
            await setDoc(doc(db, COLLECTIONS.drivers, driver.id), driver);
        }

        // Reset settings
        await setDoc(doc(db, COLLECTIONS.settings, 'default'), DEFAULT_SETTINGS);

        await refreshCache();

    } catch (error) {
        console.error('Error resetting data:', error);
        throw error;
    }
}

// Export module
export const DataModule = {
    init,
    refreshCache,
    // Trucks
    getTrucks,
    getTruckById,
    saveTruck,
    deleteTruck,
    // Drivers
    getDrivers,
    getDriverById,
    saveDriver,
    deleteDriver,
    // Entries
    getEntries,
    getEntriesByDate,
    getEntriesByMonth,
    saveEntry,
    deleteEntry,
    // Settings
    getSettings,
    saveSettings,
    // Calculations
    calculateEntryCosts,
    getMaintenanceCostFromBS,
    getMaintenanceCostFromBSSync,
    // Idle Day
    generateIdleDayEntries,
    cleanupSundayIdleEntries,
    // Export/Import
    exportData,
    importData,
    resetData,
    // Logs
    getLogs,
    getLogsByDate,
    getLogsByEntity,
    logActivity,
    // Cached accessors (sync)
    getCachedEntries,
    getCachedTrucks,
    getCachedDrivers,
    refreshTrucksOnly
};

// Make available globally
window.DataModule = DataModule;
