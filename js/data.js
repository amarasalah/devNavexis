/**
 * DATA MODULE
 * Handles localStorage persistence and CRUD operations
 * Pre-populated with data from the Excel sheet
 */

const DataModule = (() => {
    const STORAGE_KEYS = {
        trucks: 'fleettrack_trucks',
        drivers: 'fleettrack_drivers',
        entries: 'fleettrack_entries',
        settings: 'fleettrack_settings'
    };

    // Default settings
    const DEFAULT_SETTINGS = {
        defaultFuelPrice: 2,
        currency: 'TND'
    };

    // Pre-loaded trucks from Excel
    const DEFAULT_TRUCKS = [
        { id: 't1', matricule: '8565 TU 257', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't2', matricule: '8563 TU 257', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't3', matricule: '5305 TU 236', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't4', matricule: '924 TU 98', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't5', matricule: '6980 TU 101', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't6', matricule: '7775 TU 252', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't7', matricule: '4176 TU 250', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't8', matricule: '3380 TU 104', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't9', matricule: '446 TU 228', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't10', matricule: '7243 TU 75', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't11', matricule: '4188 TU 80', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't12', matricule: '2318 TU 155', type: 'BENNE', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't13', matricule: '788 TU 99', type: 'BENNE', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't14', matricule: '8564 TU 257', type: 'BENNE', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
        { id: 't15', matricule: '8566 TU 257', type: 'BENNE', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 }
    ];

    // Pre-loaded drivers from Excel
    const DEFAULT_DRIVERS = [
        { id: 'd1', nom: 'CHOKAIRI', camionId: 't1' },
        { id: 'd2', nom: 'LASSAD CHATAOUI', camionId: 't2' },
        { id: 'd3', nom: 'HAMZA', camionId: 't3' },
        { id: 'd4', nom: 'IKRAMI', camionId: 't4' },
        { id: 'd5', nom: 'ABDELBARI', camionId: 't5' },
        { id: 'd6', nom: 'JAMIL', camionId: 't6' },
        { id: 'd7', nom: 'HEDI', camionId: 't7' },
        { id: 'd8', nom: 'MALEK', camionId: 't8' },
        { id: 'd9', nom: 'LASSAD AMRI', camionId: 't10' },
        { id: 'd10', nom: 'SAMI', camionId: 't11' },
        { id: 'd11', nom: 'KAMEL CH', camionId: 't12' },
        { id: 'd12', nom: 'KAMEL ZAY', camionId: 't13' },
        { id: 'd13', nom: 'CHOKRI THAMER', camionId: 't14' },
        { id: 'd14', nom: 'HSAN REBII', camionId: 't15' }
    ];

    // Sample entries from Excel (02-02-26)
    const DEFAULT_ENTRIES = [
        { id: 'e1', date: '2026-02-02', camionId: 't1', chauffeurId: 'd1', destination: 'TUNIS', kilometrage: 800, quantiteGasoil: 240, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 500, remarques: '' },
        { id: 'e2', date: '2026-02-02', camionId: 't2', chauffeurId: 'd2', destination: 'TUNIS', kilometrage: 800, quantiteGasoil: 240, prixGasoilLitre: 2, maintenance: 1070, prixLivraison: 500, remarques: 'VIDANGE' },
        { id: 'e3', date: '2026-02-02', camionId: 't3', chauffeurId: 'd3', destination: 'SOUSSE', kilometrage: 300, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 590, remarques: '' },
        { id: 'e4', date: '2026-02-02', camionId: 't4', chauffeurId: 'd4', destination: 'DJERBA', kilometrage: 340, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 590, remarques: '' },
        { id: 'e5', date: '2026-02-02', camionId: 't5', chauffeurId: 'd5', destination: 'KEBILI/GABES', kilometrage: 434, quantiteGasoil: 125, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 650, remarques: '' },
        { id: 'e6', date: '2026-02-02', camionId: 't6', chauffeurId: 'd6', destination: 'MEHDIA/TUNIS', kilometrage: 1220, quantiteGasoil: 360, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 1090, remarques: '' },
        { id: 'e7', date: '2026-02-02', camionId: 't7', chauffeurId: 'd7', destination: 'TUNIS', kilometrage: 800, quantiteGasoil: 240, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 500, remarques: '' },
        { id: 'e8', date: '2026-02-02', camionId: 't10', chauffeurId: 'd9', destination: 'OUDHREF', kilometrage: 80, quantiteGasoil: 30, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 200, remarques: '' },
        { id: 'e9', date: '2026-02-02', camionId: 't12', chauffeurId: 'd11', destination: 'CHAGRA/CHAGRA', kilometrage: 200, quantiteGasoil: 65, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 500, remarques: '' },
        { id: 'e10', date: '2026-02-02', camionId: 't14', chauffeurId: 'd13', destination: 'FAIEDH/SP/2SB', kilometrage: 400, quantiteGasoil: 135, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 980, remarques: '' },
        { id: 'e11', date: '2026-02-02', camionId: 't15', chauffeurId: 'd14', destination: 'FAIEDH/SP/2SB', kilometrage: 400, quantiteGasoil: 135, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 980, remarques: '' },
        // 03-02-26 entries
        { id: 'e12', date: '2026-02-03', camionId: 't2', chauffeurId: 'd2', destination: 'GAFSSA', kilometrage: 300, quantiteGasoil: 90, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 600, remarques: '' },
        { id: 'e13', date: '2026-02-03', camionId: 't3', chauffeurId: 'd3', destination: 'ZARZIS', kilometrage: 414, quantiteGasoil: 145, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 524, remarques: '' },
        { id: 'e14', date: '2026-02-03', camionId: 't4', chauffeurId: 'd4', destination: 'DJERBA', kilometrage: 380, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 553, remarques: '' },
        { id: 'e15', date: '2026-02-03', camionId: 't5', chauffeurId: 'd5', destination: 'ELHAMMA', kilometrage: 180, quantiteGasoil: 40, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 234, remarques: '' },
        { id: 'e16', date: '2026-02-03', camionId: 't10', chauffeurId: 'd9', destination: 'OUDHREF', kilometrage: 80, quantiteGasoil: 30, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 200, remarques: '' },
        { id: 'e17', date: '2026-02-03', camionId: 't12', chauffeurId: 'd11', destination: 'CHAGRA/SB', kilometrage: 320, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 800, remarques: '' },
        { id: 'e18', date: '2026-02-03', camionId: 't14', chauffeurId: 'd13', destination: 'FAIEDH/SP/2SB', kilometrage: 300, quantiteGasoil: 100, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 960, remarques: '' },
        { id: 'e19', date: '2026-02-03', camionId: 't15', chauffeurId: 'd14', destination: 'FAIEDH/SP/2SB', kilometrage: 300, quantiteGasoil: 100, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 960, remarques: '' },
        // 04-02-26 entries
        { id: 'e20', date: '2026-02-04', camionId: 't1', chauffeurId: 'd1', destination: 'ZARZIS', kilometrage: 414, quantiteGasoil: 125, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 524, remarques: '' },
        { id: 'e21', date: '2026-02-04', camionId: 't2', chauffeurId: 'd2', destination: 'TUNIS', kilometrage: 414, quantiteGasoil: 125, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 524, remarques: '' },
        { id: 'e22', date: '2026-02-04', camionId: 't4', chauffeurId: 'd4', destination: 'DJERBA', kilometrage: 380, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 553, remarques: '' },
        { id: 'e23', date: '2026-02-04', camionId: 't5', chauffeurId: 'd5', destination: 'GABES', kilometrage: 140, quantiteGasoil: 40, prixGasoilLitre: 2, maintenance: 420, prixLivraison: 234, remarques: '' },
        { id: 'e24', date: '2026-02-04', camionId: 't7', chauffeurId: 'd7', destination: 'BENGUERDENE', kilometrage: 440, quantiteGasoil: 140, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 670, remarques: '' },
        { id: 'e25', date: '2026-02-04', camionId: 't12', chauffeurId: 'd11', destination: 'CHAGRA/SB', kilometrage: 320, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 800, remarques: '' },
        { id: 'e26', date: '2026-02-04', camionId: 't14', chauffeurId: 'd13', destination: 'FAIEDH/SP/2SB', kilometrage: 400, quantiteGasoil: 135, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 980, remarques: '' },
        { id: 'e27', date: '2026-02-04', camionId: 't15', chauffeurId: 'd14', destination: 'FAIEDH/SP/2SB', kilometrage: 400, quantiteGasoil: 135, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 980, remarques: '' },
        // 05-02-26 entries
        { id: 'e28', date: '2026-02-05', camionId: 't1', chauffeurId: 'd1', destination: 'GHANOUCH', kilometrage: 130, quantiteGasoil: 40, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 234, remarques: '' },
        { id: 'e29', date: '2026-02-05', camionId: 't2', chauffeurId: 'd2', destination: 'DJERBA', kilometrage: 380, quantiteGasoil: 110, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 591, remarques: '' },
        { id: 'e30', date: '2026-02-05', camionId: 't4', chauffeurId: 'd4', destination: 'DJERBA', kilometrage: 380, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 591, remarques: '' },
        { id: 'e31', date: '2026-02-05', camionId: 't6', chauffeurId: 'd6', destination: 'GABES/DJERBA', kilometrage: 520, quantiteGasoil: 160, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 841, remarques: '' },
        { id: 'e32', date: '2026-02-05', camionId: 't7', chauffeurId: 'd7', destination: 'MAHDIA', kilometrage: 450, quantiteGasoil: 140, prixGasoilLitre: 2, maintenance: 1546, prixLivraison: 590, remarques: 'VIDANGE' },
        { id: 'e33', date: '2026-02-05', camionId: 't12', chauffeurId: 'd11', destination: 'CHAGRA/SB', kilometrage: 320, quantiteGasoil: 120, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 800, remarques: '' },
        { id: 'e34', date: '2026-02-05', camionId: 't14', chauffeurId: 'd13', destination: 'SUDB/SB/HICHA/SP', kilometrage: 200, quantiteGasoil: 60, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 800, remarques: '' },
        { id: 'e35', date: '2026-02-05', camionId: 't15', chauffeurId: 'd14', destination: 'FAYEDH/FAYEDH', kilometrage: 300, quantiteGasoil: 100, prixGasoilLitre: 2, maintenance: 0, prixLivraison: 960, remarques: '' }
    ];

    // Generate UUID
    function generateId() {
        return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Storage helpers
    function getFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading from storage:', e);
            return null;
        }
    }

    function saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to storage:', e);
            return false;
        }
    }

    // Initialize data with defaults if empty
    function init() {
        if (!getFromStorage(STORAGE_KEYS.trucks)) {
            saveToStorage(STORAGE_KEYS.trucks, DEFAULT_TRUCKS);
        }
        if (!getFromStorage(STORAGE_KEYS.drivers)) {
            saveToStorage(STORAGE_KEYS.drivers, DEFAULT_DRIVERS);
        }
        if (!getFromStorage(STORAGE_KEYS.entries)) {
            saveToStorage(STORAGE_KEYS.entries, DEFAULT_ENTRIES);
        }
        if (!getFromStorage(STORAGE_KEYS.settings)) {
            saveToStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
        }
    }

    // CRUD for Trucks
    function getTrucks() {
        return getFromStorage(STORAGE_KEYS.trucks) || [];
    }

    function getTruckById(id) {
        return getTrucks().find(t => t.id === id);
    }

    function saveTruck(truck) {
        const trucks = getTrucks();
        if (truck.id) {
            const idx = trucks.findIndex(t => t.id === truck.id);
            if (idx >= 0) trucks[idx] = truck;
            else trucks.push(truck);
        } else {
            truck.id = generateId();
            trucks.push(truck);
        }
        saveToStorage(STORAGE_KEYS.trucks, trucks);
        return truck;
    }

    function deleteTruck(id) {
        const trucks = getTrucks().filter(t => t.id !== id);
        saveToStorage(STORAGE_KEYS.trucks, trucks);
    }

    // CRUD for Drivers
    function getDrivers() {
        return getFromStorage(STORAGE_KEYS.drivers) || [];
    }

    function getDriverById(id) {
        return getDrivers().find(d => d.id === id);
    }

    function saveDriver(driver) {
        const drivers = getDrivers();
        if (driver.id) {
            const idx = drivers.findIndex(d => d.id === driver.id);
            if (idx >= 0) drivers[idx] = driver;
            else drivers.push(driver);
        } else {
            driver.id = generateId();
            drivers.push(driver);
        }
        saveToStorage(STORAGE_KEYS.drivers, drivers);
        return driver;
    }

    function deleteDriver(id) {
        const drivers = getDrivers().filter(d => d.id !== id);
        saveToStorage(STORAGE_KEYS.drivers, drivers);
    }

    // CRUD for Entries
    function getEntries() {
        return getFromStorage(STORAGE_KEYS.entries) || [];
    }

    function getEntriesByDate(date) {
        return getEntries().filter(e => e.date === date);
    }

    function getEntriesByMonth(year, month) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        return getEntries().filter(e => e.date.startsWith(prefix));
    }

    function saveEntry(entry) {
        const entries = getEntries();
        if (entry.id) {
            const idx = entries.findIndex(e => e.id === entry.id);
            if (idx >= 0) entries[idx] = entry;
            else entries.push(entry);
        } else {
            entry.id = generateId();
            entries.push(entry);
        }
        saveToStorage(STORAGE_KEYS.entries, entries);
        return entry;
    }

    function deleteEntry(id) {
        const entries = getEntries().filter(e => e.id !== id);
        saveToStorage(STORAGE_KEYS.entries, entries);
    }

    // Settings
    function getSettings() {
        return getFromStorage(STORAGE_KEYS.settings) || DEFAULT_SETTINGS;
    }

    function saveSettings(settings) {
        saveToStorage(STORAGE_KEYS.settings, settings);
    }

    // Calculate entry costs
    function calculateEntryCosts(entry, truck) {
        if (!truck) truck = getTruckById(entry.camionId);
        if (!truck) return { montantGasoil: 0, coutTotal: 0, resultat: 0 };

        const montantGasoil = entry.quantiteGasoil * entry.prixGasoilLitre;
        const coutTotal = montantGasoil +
            truck.chargesFixes +
            truck.montantAssurance +
            truck.montantTaxe +
            (entry.maintenance || 0) +
            truck.chargePersonnel;
        const resultat = entry.prixLivraison - coutTotal;

        return { montantGasoil, coutTotal, resultat };
    }

    // Export all data
    function exportData() {
        return {
            trucks: getTrucks(),
            drivers: getDrivers(),
            entries: getEntries(),
            settings: getSettings(),
            exportDate: new Date().toISOString()
        };
    }

    // Import data
    function importData(data) {
        if (data.trucks) saveToStorage(STORAGE_KEYS.trucks, data.trucks);
        if (data.drivers) saveToStorage(STORAGE_KEYS.drivers, data.drivers);
        if (data.entries) saveToStorage(STORAGE_KEYS.entries, data.entries);
        if (data.settings) saveToStorage(STORAGE_KEYS.settings, data.settings);
    }

    // Reset to defaults
    function resetData() {
        saveToStorage(STORAGE_KEYS.trucks, DEFAULT_TRUCKS);
        saveToStorage(STORAGE_KEYS.drivers, DEFAULT_DRIVERS);
        saveToStorage(STORAGE_KEYS.entries, DEFAULT_ENTRIES);
        saveToStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    }

    return {
        init,
        getTrucks,
        getTruckById,
        saveTruck,
        deleteTruck,
        getDrivers,
        getDriverById,
        saveDriver,
        deleteDriver,
        getEntries,
        getEntriesByDate,
        getEntriesByMonth,
        saveEntry,
        deleteEntry,
        getSettings,
        saveSettings,
        calculateEntryCosts,
        exportData,
        importData,
        resetData
    };
})();
