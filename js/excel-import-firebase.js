/**
 * EXCEL IMPORT MODULE - FIREBASE VERSION
 * Parses Excel files (Tableau_suivi_journalier_camions) and saves to Firebase
 *
 * Excel structure per daily sheet (DD-MM-YY):
 *   Row 0: Title
 *   Row 2: Date (serial col 2), Prix gasoil (col 5)
 *   Row 5: Headers (N°, Matricule, Chauffeur, Type, Destination, Km, KmGlobal,
 *           Gasoil, PrixGasoil, MontantGasoil, ChargesFixes, Assurance, Taxe,
 *           Maintenance, ChargePersonnel, CoutTotal, PrixLivraison, Resultat, Remarques)
 *   Rows 6-20: 15 truck entries
 *   Last row: TOTAL
 */

import { db, collection, doc, getDocs, setDoc, COLLECTIONS } from './firebase.js';
import { DataModule } from './data-firebase.js';

let selectedFile = null;
let parsedData = null;

// ==================== KNOWN TRUCKS & DRIVERS ====================
// Maps matricule → id (matching DEFAULT_TRUCKS in data-firebase.js)
const TRUCK_MAP = {
    '8565 TU 257': { id: 't1', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
    '8563 TU 257': { id: 't2', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
    '5305 TU 236': { id: 't3', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '924 TU 98':   { id: 't4', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '6980 TU 101': { id: 't5', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '7775 TU 252': { id: 't6', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '4176 TU 250': { id: 't7', type: 'PLATEAU', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
    '3380 TU 104': { id: 't8', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '446 TU 228':  { id: 't9', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '7243 TU 75':  { id: 't10', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '4188 TU 80':  { id: 't11', type: 'PLATEAU', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '2318 TU 155': { id: 't12', type: 'BENNE', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '788 TU 99':   { id: 't13', type: 'BENNE', chargesFixes: 80, montantAssurance: 20, montantTaxe: 20, chargePersonnel: 80 },
    '8564 TU 257': { id: 't14', type: 'BENNE', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 },
    '8566 TU 257': { id: 't15', type: 'BENNE', chargesFixes: 400, montantAssurance: 32, montantTaxe: 20, chargePersonnel: 80 }
};

// Maps driver name (uppercase trimmed) → id
const DRIVER_MAP = {
    'CHOKAIRI':       { id: 'd1', camionId: 't1' },
    'LASSAD CHATAOUI':{ id: 'd2', camionId: 't2' },
    'HAMZA':          { id: 'd3', camionId: 't3' },
    'IKRAMI':         { id: 'd4', camionId: 't4' },
    'ABDELBARI':      { id: 'd5', camionId: 't5' },
    'JAMIL':          { id: 'd6', camionId: 't6' },
    'HEDI':           { id: 'd7', camionId: 't7' },
    'MALEK':          { id: 'd8', camionId: 't8' },
    'LASSAD AMRI':    { id: 'd9', camionId: 't10' },
    'SAMI':           { id: 'd10', camionId: 't11' },
    'KAMEL CH':       { id: 'd11', camionId: 't12' },
    'KAMEL ZAY':      { id: 'd12', camionId: 't13' },
    'CHOKRI THAMER':  { id: 'd13', camionId: 't14' },
    'HSAN REBII':     { id: 'd14', camionId: 't15' }
};

function resolveTruckId(matricule) {
    const known = TRUCK_MAP[matricule];
    return known ? known.id : `truck_${matricule.replace(/\s+/g, '_')}`;
}

function resolveDriverId(chauffeurName) {
    const known = DRIVER_MAP[chauffeurName];
    return known ? known.id : (chauffeurName ? `driver_${chauffeurName.replace(/\s+/g, '_')}` : null);
}

// ==================== INIT ====================
function init() {
    setupDropZone();
    setupImportButton();
    console.log('📊 ExcelImportModule initialized');
}

function setupDropZone() {
    const dropZone = document.getElementById('excelDropZone');
    const fileInput = document.getElementById('excelFileInput');

    if (!dropZone || !fileInput) return;

    // Click to select file
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#8b5cf6';
        dropZone.style.background = 'rgba(139, 92, 246, 0.1)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(139, 92, 246, 0.5)';
        dropZone.style.background = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(139, 92, 246, 0.5)';
        dropZone.style.background = 'transparent';

        const files = e.dataTransfer.files;
        if (files.length > 0 && (files[0].name.endsWith('.xlsx') || files[0].name.endsWith('.xls'))) {
            handleFile(files[0]);
        } else {
            alert('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
        }
    });
}

function setupImportButton() {
    const importBtn = document.getElementById('importExcelBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => importToFirebase());
    }
}

// ==================== FILE PARSING ====================
async function handleFile(file) {
    selectedFile = file;
    const dropZone = document.getElementById('excelDropZone');
    const importBtn = document.getElementById('importExcelBtn');

    dropZone.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
        <p style="color: #10b981; font-weight: 500;">${file.name}</p>
        <p style="color: #64748b; font-size: 0.875rem;">${(file.size / 1024).toFixed(1)} KB - Prêt à importer</p>
    `;

    try {
        parsedData = await parseExcelFile(file);
        console.log('📊 Parsed data:', parsedData);

        if (importBtn) {
            importBtn.disabled = false;
            importBtn.textContent = `📥 Importer ${parsedData.entries?.length || 0} saisies, ${parsedData.trucks?.length || 0} camions, ${parsedData.drivers?.length || 0} chauffeurs`;
        }
    } catch (error) {
        console.error('Error parsing Excel:', error);
        dropZone.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">❌</div>
            <p style="color: #ef4444; font-weight: 500;">Erreur de lecture</p>
            <p style="color: #64748b; font-size: 0.875rem;">${error.message}</p>
        `;
    }
}

async function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                const result = { trucks: [], drivers: [], entries: [] };

                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    const entries = parseEntriesSheet(jsonData, sheetName);
                    result.entries.push(...entries);
                });

                // Extract unique trucks and drivers from parsed entries
                result.trucks = extractTrucks(result.entries);
                result.drivers = extractDrivers(result.entries);

                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsArrayBuffer(file);
    });
}

function parseEntriesSheet(data, sheetName) {
    const entries = [];
    const trimmedName = sheetName.trim();

    // Skip summary/recap sheets
    if (trimmedName.toLowerCase().includes('recap') || trimmedName.toLowerCase().includes('récap')) {
        console.log(`⏭️ Sheet "${sheetName}": Récap sheet, skipping`);
        return entries;
    }

    // Find header row (look for "Matricule" in first 10 rows)
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        if (row && row.some(cell => String(cell).toLowerCase().includes('matricule'))) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        console.log(`⏭️ Sheet "${sheetName}": No header found, skipping`);
        return entries;
    }

    // Get date from sheet name (format: DD-MM-YY, may have trailing spaces)
    let dateStr = '';
    const dateMatch = trimmedName.match(/(\d{2})-(\d{2})-(\d{2})/);
    if (dateMatch) {
        const [, day, month, year] = dateMatch;
        dateStr = `20${year}-${month}-${day}`;
    } else {
        // Fallback: Excel serial date in row 2, column 2
        const dateVal = data[2]?.[2];
        if (typeof dateVal === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + dateVal * 86400000);
            dateStr = date.toISOString().split('T')[0];
        }
    }

    if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
    }

    console.log(`📅 Sheet "${trimmedName}": Date=${dateStr}, Header at row ${headerIndex}`);

    // Column layout (0-indexed):
    // 0:N° 1:Matricule 2:Chauffeur 3:Type 4:Destination 5:KmJour 6:KmGlobal
    // 7:Gasoil(L) 8:PrixGasoil 9:MontantGasoil 10:ChargesFixes 11:Assurance
    // 12:Taxe 13:Maintenance 14:ChargePersonnel 15:CoutTotal 16:PrixLivraison
    // 17:Resultat 18:Remarques

    for (let i = headerIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;

        // Skip TOTAL row
        if (String(row[0] || '').toLowerCase().includes('total')) continue;

        const matricule = String(row[1] || '').trim();
        if (!matricule) continue;

        const chauffeur = String(row[2] || '').trim();
        const typeTransport = String(row[3] || '').trim();
        const destination = String(row[4] || '').trim();

        // Resolve IDs using known truck/driver maps
        const camionId = resolveTruckId(matricule);
        const chauffeurId = resolveDriverId(chauffeur);

        const entry = {
            id: `entry_${dateStr}_${camionId}`.replace(/\s+/g, '_'),
            date: dateStr,
            matricule: matricule,
            chauffeur: chauffeur,
            camionId: camionId,
            chauffeurId: chauffeurId,
            typeTransport: typeTransport,
            destination: destination,
            origine: 'GABES',
            origineGouvernorat: 'Gabès',
            gouvernorat: destination.split('/')[0]?.trim() || destination,
            delegation: destination.split('/')[1]?.trim() || '',
            kilometrage: parseFloat(row[5]) || 0,
            kmGlobal: parseFloat(row[6]) || 0,
            quantiteGasoil: parseFloat(row[7]) || 0,
            prixGasoilLitre: parseFloat(row[8]) || 2,
            montantGasoil: parseFloat(row[9]) || 0,
            chargesFixes: parseFloat(row[10]) || 0,
            montantAssurance: parseFloat(row[11]) || 0,
            montantTaxe: parseFloat(row[12]) || 0,
            maintenance: parseFloat(row[13]) || 0,
            chargePersonnel: parseFloat(row[14]) || 0,
            coutTotal: parseFloat(row[15]) || 0,
            prixLivraison: parseFloat(row[16]) || 0,
            resultat: parseFloat(row[17]) || 0,
            remarques: String(row[18] || '').trim(),
            importedAt: new Date().toISOString(),
            source: 'excel_import'
        };

        // Auto-calculate montantGasoil if missing
        if (!entry.montantGasoil && entry.quantiteGasoil > 0) {
            entry.montantGasoil = entry.quantiteGasoil * entry.prixGasoilLitre;
        }

        entries.push(entry);
    }

    console.log(`✅ Sheet "${trimmedName}": ${entries.length} entries parsed`);
    return entries;
}

// ==================== EXTRACT TRUCKS & DRIVERS ====================
function extractTrucks(entries) {
    const trucksMap = new Map();
    entries.forEach(e => {
        if (e.matricule && !trucksMap.has(e.matricule)) {
            const known = TRUCK_MAP[e.matricule];
            trucksMap.set(e.matricule, {
                id: e.camionId,
                matricule: e.matricule,
                type: known?.type || e.typeTransport || 'PLATEAU',
                chargesFixes: known?.chargesFixes || 80,
                montantAssurance: known?.montantAssurance || 20,
                montantTaxe: known?.montantTaxe || 20,
                chargePersonnel: known?.chargePersonnel || 80,
                createdAt: new Date().toISOString()
            });
        }
    });
    return Array.from(trucksMap.values());
}

function extractDrivers(entries) {
    const driversMap = new Map();
    entries.forEach(e => {
        if (e.chauffeur && !driversMap.has(e.chauffeur)) {
            const known = DRIVER_MAP[e.chauffeur];
            driversMap.set(e.chauffeur, {
                id: e.chauffeurId,
                nom: e.chauffeur,
                camionId: known?.camionId || e.camionId,
                telephone: '',
                createdAt: new Date().toISOString()
            });
        }
    });
    return Array.from(driversMap.values());
}

// ==================== IMPORT TO FIREBASE ====================
async function importToFirebase() {
    if (!parsedData) {
        alert('Aucun fichier à importer');
        return;
    }

    const statusDiv = document.getElementById('excelImportStatus');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    const importBtn = document.getElementById('importExcelBtn');

    statusDiv.style.display = 'block';
    importBtn.disabled = true;

    try {
        progressText.textContent = 'Vérification des doublons...';
        progressBar.style.width = '5%';

        const existingEntries = await DataModule.getEntries();
        const existingTrucks = await DataModule.getTrucks();
        const existingDrivers = await DataModule.getDrivers();

        // Build lookup sets
        const existingEntryIds = new Set(existingEntries.map(e => e.id));
        const existingTruckIds = new Set(existingTrucks.map(t => t.id));
        const existingDriverIds = new Set(existingDrivers.map(d => d.id));

        // Check by date+camionId for entries
        const existingEntryKeys = new Set(existingEntries.map(e => `${e.date}_${e.camionId}`));

        // Also check by date+matricule (format-independent — catches old & new ID formats)
        const existingEntryByMatricule = new Set(existingEntries.map(e => {
            const mat = e.matricule || '';
            // If no matricule stored, reverse-resolve from camionId
            if (!mat && e.camionId) {
                const truck = existingTrucks.find(t => t.id === e.camionId);
                return `${e.date}_${truck?.matricule || ''}`;
            }
            return `${e.date}_${mat}`;
        }).filter(k => !k.endsWith('_')));

        function isDuplicateEntry(e) {
            if (existingEntryIds.has(e.id)) return true;
            if (existingEntryKeys.has(`${e.date}_${e.camionId}`)) return true;
            if (e.matricule && existingEntryByMatricule.has(`${e.date}_${e.matricule}`)) return true;
            return false;
        }

        const duplicateEntries = parsedData.entries.filter(e => isDuplicateEntry(e));
        const duplicateTrucks = parsedData.trucks.filter(t => existingTruckIds.has(t.id));
        const duplicateDrivers = parsedData.drivers.filter(d => existingDriverIds.has(d.id));

        let newEntries = parsedData.entries.filter(e => !isDuplicateEntry(e));
        let newTrucks = parsedData.trucks.filter(t => !existingTruckIds.has(t.id));
        let newDrivers = parsedData.drivers.filter(d => !existingDriverIds.has(d.id));

        progressBar.style.width = '10%';

        // If duplicates found, ask user
        if (duplicateEntries.length > 0 || duplicateTrucks.length > 0 || duplicateDrivers.length > 0) {
            const message = `⚠️ Données existantes détectées!\n\n` +
                `Doublons trouvés:\n` +
                `- ${duplicateEntries.length} saisies existantes\n` +
                `- ${duplicateTrucks.length} camions existants\n` +
                `- ${duplicateDrivers.length} chauffeurs existants\n\n` +
                `Nouvelles données à importer:\n` +
                `- ${newEntries.length} nouvelles saisies\n` +
                `- ${newTrucks.length} nouveaux camions\n` +
                `- ${newDrivers.length} nouveaux chauffeurs\n\n` +
                `OK = Importer uniquement les nouvelles données\n` +
                `Annuler = Ne rien importer`;

            if (!confirm(message)) {
                progressText.innerHTML = `<span style="color: #f59e0b;">⚠️ Import annulé</span>`;
                importBtn.disabled = false;
                return;
            }
        }

        // Update parsedData with only new items
        parsedData.entries = newEntries;
        parsedData.trucks = newTrucks;
        parsedData.drivers = newDrivers;

        if (newEntries.length === 0 && newTrucks.length === 0 && newDrivers.length === 0) {
            progressText.innerHTML = `<span style="color: #f59e0b;">⚠️ Aucune nouvelle donnée — tout existe déjà!</span>`;
            importBtn.disabled = false;
            return;
        }

        const total = newTrucks.length + newDrivers.length + newEntries.length;
        let current = 0;

        // 1. Import trucks
        progressText.textContent = `Importation de ${newTrucks.length} camions...`;
        for (const truck of newTrucks) {
            await setDoc(doc(db, COLLECTIONS.trucks, truck.id), truck);
            current++;
            progressBar.style.width = `${10 + (current / total) * 90}%`;
        }

        // 2. Import drivers
        progressText.textContent = `Importation de ${newDrivers.length} chauffeurs...`;
        for (const driver of newDrivers) {
            await setDoc(doc(db, COLLECTIONS.drivers, driver.id), driver);
            current++;
            progressBar.style.width = `${10 + (current / total) * 90}%`;
        }

        // 3. Import entries
        progressText.textContent = `Importation de ${newEntries.length} saisies...`;
        for (const entry of newEntries) {
            await setDoc(doc(db, COLLECTIONS.entries, entry.id), entry);
            current++;
            progressBar.style.width = `${10 + (current / total) * 90}%`;
        }

        progressBar.style.width = '100%';
        progressText.innerHTML = `<span style="color: #10b981;">✅ Import terminé! ${newTrucks.length} camions, ${newDrivers.length} chauffeurs, ${newEntries.length} saisies</span>`;

        // Refresh data caches
        await DataModule.init();

        alert(`✅ Import réussi!\n\n${newTrucks.length} camions\n${newDrivers.length} chauffeurs\n${newEntries.length} saisies`);

    } catch (error) {
        console.error('Import error:', error);
        progressText.innerHTML = `<span style="color: #ef4444;">❌ Erreur: ${error.message}</span>`;
        alert('Erreur: ' + error.message);
    }

    importBtn.disabled = false;
}

export const ExcelImportModule = {
    init,
    handleFile,
    importToFirebase
};

window.ExcelImportModule = ExcelImportModule;
