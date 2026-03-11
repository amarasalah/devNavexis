/**
 * DATA IMPORTER MODULE
 * Imports data from complete_excel_data.json into the app's storage
 * Supports both localStorage and Firebase
 */

const DataImporter = (() => {
    // Source data URL - the JSON file with complete data
    const DATA_SOURCE = 'complete_excel_data.json';

    async function importFromJSON() {
        try {
            console.log('📥 Loading data from database...');
            
            // Fetch the data file
            const response = await fetch(DATA_SOURCE);
            if (!response.ok) {
                throw new Error(`Failed to load ${DATA_SOURCE}: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Data loaded:', data);
            
            // Check which storage system to use
            const isFirebase = typeof db !== 'undefined';
            
            if (isFirebase) {
                await importToFirebase(data);
            } else {
                importToLocalStorage(data);
            }
            
            return {
                success: true,
                trucks: data.trucks?.length || 0,
                drivers: data.drivers?.length || 0,
                entries: data.entries?.length || 0
            };
            
        } catch (error) {
            console.error('❌ Import failed:', error);
            return { success: false, error: error.message };
        }
    }

    function importToLocalStorage(data) {
        console.log('💾 Saving to localStorage...');
        
        if (data.trucks && data.trucks.length > 0) {
            localStorage.setItem('fleettrack_trucks', JSON.stringify(data.trucks));
            console.log(`  ✓ ${data.trucks.length} trucks imported`);
        }
        
        if (data.drivers && data.drivers.length > 0) {
            localStorage.setItem('fleettrack_drivers', JSON.stringify(data.drivers));
            console.log(`  ✓ ${data.drivers.length} drivers imported`);
        }
        
        if (data.entries && data.entries.length > 0) {
            localStorage.setItem('fleettrack_entries', JSON.stringify(data.entries));
            console.log(`  ✓ ${data.entries.length} entries imported`);
        }
        
        if (data.settings) {
            localStorage.setItem('fleettrack_settings', JSON.stringify(data.settings));
            console.log('  ✓ Settings imported');
        }
        
        console.log('✅ Import to localStorage complete!');
    }

    async function importToFirebase(data) {
        console.log('🔥 Saving to Firebase...');
        
        // Import trucks
        if (data.trucks && data.trucks.length > 0) {
            for (const truck of data.trucks) {
                await setDoc(doc(db, 'trucks', truck.id), truck);
            }
            console.log(`  ✓ ${data.trucks.length} trucks imported`);
        }
        
        // Import drivers
        if (data.drivers && data.drivers.length > 0) {
            for (const driver of data.drivers) {
                await setDoc(doc(db, 'drivers', driver.id), driver);
            }
            console.log(`  ✓ ${data.drivers.length} drivers imported`);
        }
        
        // Import entries
        if (data.entries && data.entries.length > 0) {
            for (const entry of data.entries) {
                await setDoc(doc(db, 'entries', entry.id), entry);
            }
            console.log(`  ✓ ${data.entries.length} entries imported`);
        }
        
        // Import settings
        if (data.settings) {
            await setDoc(doc(db, 'settings', 'default'), data.settings);
            console.log('  ✓ Settings imported');
        }
        
        console.log('✅ Import to Firebase complete!');
    }

    async function mergeWithExisting() {
        try {
            console.log('🔄 Merging data with existing...');
            
            const response = await fetch(DATA_SOURCE);
            const newData = await response.json();
            
            const isFirebase = typeof db !== 'undefined';
            
            if (isFirebase) {
                // Get existing data from Firebase
                const existingEntries = await DataModule.getEntries();
                const existingIds = new Set(existingEntries.map(e => e.id));
                
                // Add only new entries
                let added = 0;
                for (const entry of newData.entries || []) {
                    if (!existingIds.has(entry.id)) {
                        await setDoc(doc(db, 'entries', entry.id), entry);
                        added++;
                    }
                }
                console.log(`✅ Merged: ${added} new entries added`);
            } else {
                // Get existing data from localStorage
                const existing = JSON.parse(localStorage.getItem('fleettrack_entries') || '[]');
                const existingIds = new Set(existing.map(e => e.id));
                
                // Add only new entries
                let added = 0;
                for (const entry of newData.entries || []) {
                    if (!existingIds.has(entry.id)) {
                        existing.push(entry);
                        added++;
                    }
                }
                
                localStorage.setItem('fleettrack_entries', JSON.stringify(existing));
                console.log(`✅ Merged: ${added} new entries added`);
            }
            
            return { success: true, added };
            
        } catch (error) {
            console.error('❌ Merge failed:', error);
            return { success: false, error: error.message };
        }
    }

    function getImportStatus() {
        return {
            source: DATA_SOURCE,
            hasData: !!localStorage.getItem('fleettrack_entries')
        };
    }

    // Export for use
    if (typeof window !== 'undefined') {
        window.DataImporter = {
            importFromJSON,
            mergeWithExisting,
            getImportStatus
        };
    }

    return {
        importFromJSON,
        mergeWithExisting,
        getImportStatus
    };
})();
