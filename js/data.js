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

    ];

    // Pre-loaded drivers from Excel
    const DEFAULT_DRIVERS = [

    ];

    // Sample entries from Excel (02-02-26)
    const DEFAULT_ENTRIES = [

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
