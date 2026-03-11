/**
 * TRUCKS MODULE - FIREBASE VERSION
 * With performance statistics
 */

import { DataModule } from './data-firebase.js';

function init() {
    document.getElementById('addTruckBtn')?.addEventListener('click', () => openModal());
    // Hide add button for chauffeur (read-only)
    if (window.currentUser?.driverId) {
        const addBtn = document.getElementById('addTruckBtn');
        if (addBtn) addBtn.style.display = 'none';
    }
}

async function refresh() {
    await renderTrucks();
}

function calculateTruckStats(truckId) {
    const allEntries = DataModule.getCachedEntries();
    const truck = DataModule.getTruckById(truckId);
    // Match entries by ID directly, or by old-format ID containing matricule
    const matNorm = truck?.matricule?.replace(/\s+/g, '_') || '';
    const truckEntries = allEntries.filter(e =>
        e.camionId === truckId || (matNorm && e.camionId === `truck_${matNorm}`)
    );

    if (truckEntries.length === 0) {
        return {
            totalKm: 0, totalGasoil: 0, totalCout: 0, totalRevenue: 0,
            resultat: 0, coutParKm: 0, consommation: 0, nbTrajets: 0, performance: 0
        };
    }

    let totalKm = 0, totalGasoil = 0, totalCout = 0, totalRevenue = 0;

    // Track first trip per day (fixed charges only once per day)
    const daySeen = new Set();

    truckEntries.forEach(entry => {
        totalKm += entry.kilometrage || 0;
        totalGasoil += entry.quantiteGasoil || 0;
        totalRevenue += entry.prixLivraison || 0;
        const isFirstTrip = !daySeen.has(entry.date);
        daySeen.add(entry.date);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip);
        totalCout += costs.coutTotal;
    });

    const resultat = totalRevenue - totalCout;
    const coutParKm = totalKm > 0 ? totalCout / totalKm : 0;
    const consommation = totalKm > 0 ? (totalGasoil / totalKm) * 100 : 0;
    const performance = totalRevenue > 0 ? (resultat / totalRevenue) * 100 : 0;

    return { totalKm, totalGasoil, totalCout, totalRevenue, resultat, coutParKm, consommation, nbTrajets: truckEntries.length, performance };
}

async function renderTrucks() {
    let trucks = await DataModule.getTrucks();
    // Chauffeur data scope: show only their assigned truck
    const cu = window.currentUser;
    if (cu?.camionId) {
        trucks = trucks.filter(t => t.id === cu.camionId);
    }
    const grid = document.getElementById('trucksGrid');
    if (!grid) return;

    grid.innerHTML = trucks.map(truck => {
        const stats = calculateTruckStats(truck.id);
        const performanceClass = stats.performance >= 20 ? 'perf-excellent' : stats.performance >= 10 ? 'perf-good' : stats.performance >= 0 ? 'perf-average' : 'perf-bad';
        const resultatClass = stats.resultat >= 0 ? 'result-positive' : 'result-negative';

        return `
        <div class="entity-card truck-card">
            <div class="entity-header">
                <div class="entity-icon" style="${truck.photoUrl ? 'padding:0;overflow:hidden;border-radius:12px' : ''}">
                    ${truck.photoUrl ? `<img src="${truck.photoUrl}" style="width:100%;height:100%;object-fit:cover" alt="${truck.matricule}">` : '🚛'}
                </div>
                <div class="entity-info">
                    <h3>${truck.matricule}</h3>
                    <span class="entity-badge">${truck.type}</span>
                </div>
                <div class="entity-actions">
                    <button class="btn btn-sm btn-profile" onclick="ProfileModule.openTruckProfile('${truck.id}')" title="Voir Profil">📊</button>
                    ${!window.currentUser?.driverId ? `
                    <button class="btn btn-sm btn-outline" onclick="TrucksModule.edit('${truck.id}')">✏️</button>
                    <button class="btn btn-sm btn-outline" onclick="TrucksModule.remove('${truck.id}')">🗑️</button>
                    ` : ''}
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
            
            <div class="costs-details">
                <span class="cost-tag">Fixes: ${truck.chargesFixes} TND</span>
                <span class="cost-tag">Assurance: ${truck.montantAssurance} TND</span>
                <span class="cost-tag">Taxe: ${truck.montantTaxe} TND</span>
                <span class="cost-tag">Personnel: ${truck.chargePersonnel} TND</span>
                ${truck.fraisLeasing ? `<span class="cost-tag">💳 Leasing: ${truck.fraisLeasing} TND/j</span>` : ''}
            </div>
            <div class="entity-footer"><span class="trajet-count">📍 ${stats.nbTrajets} trajet(s)</span></div>
        </div>`;
    }).join('');
}

async function openModal(truckId = null) {
    const truck = truckId ? DataModule.getTruckById(truckId) : null;
    document.getElementById('modalTitle').textContent = truck ? 'Modifier Camion' : 'Nouveau Camion';
    document.getElementById('modalBody').innerHTML = `
        <form id="truckForm">
            <input type="hidden" id="truckId" value="${truck?.id || ''}">
            <input type="hidden" id="truckPhotoUrl" value="${truck?.photoUrl || ''}">
            <div class="form-group">
                <label>📷 Photo du camion</label>
                <div style="display:flex;align-items:center;gap:12px">
                    ${truck?.photoUrl ? `<img id="truckPhotoPreview" src="${truck.photoUrl}" style="width:80px;height:60px;border-radius:8px;object-fit:cover;border:2px solid rgba(139,92,246,0.3)">` : `<div id="truckPhotoPreview" style="width:80px;height:60px;border-radius:8px;background:rgba(30,41,59,0.6);display:flex;align-items:center;justify-content:center;font-size:24px;border:2px dashed rgba(148,163,184,0.2)">🚛</div>`}
                    <input type="file" id="truckPhotoFile" accept="image/*" style="flex:1">
                </div>
            </div>
            <div class="form-group"><label>Matricule</label><input type="text" id="truckMatricule" value="${truck?.matricule || ''}" required></div>
            <div class="form-group"><label>Type</label>
                <select id="truckType">
                    <option value="PLATEAU" ${truck?.type === 'PLATEAU' ? 'selected' : ''}>PLATEAU</option>
                    <option value="BENNE" ${truck?.type === 'BENNE' ? 'selected' : ''}>BENNE</option>
                    <option value="CITERNE" ${truck?.type === 'CITERNE' ? 'selected' : ''}>CITERNE</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Charges Fixes (TND)</label><input type="number" id="truckChargesFixes" value="${truck?.chargesFixes || 80}"></div>
                <div class="form-group"><label>Assurance (TND)</label><input type="number" id="truckAssurance" value="${truck?.montantAssurance || 20}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Taxe (TND)</label><input type="number" id="truckTaxe" value="${truck?.montantTaxe || 20}"></div>
                <div class="form-group"><label>Personnel (TND)</label><input type="number" id="truckPersonnel" value="${truck?.chargePersonnel || 80}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>💳 Leasing (TND/jour)</label><input type="number" id="truckLeasing" value="${truck?.fraisLeasing || 0}" min="0" step="0.1"></div>
            </div>
        </form>`;
    document.getElementById('modalSave').onclick = saveTruck;
    App.showModal();
}

async function saveTruck() {
    const truck = {
        id: document.getElementById('truckId').value || null,
        matricule: document.getElementById('truckMatricule').value,
        type: document.getElementById('truckType').value,
        chargesFixes: parseFloat(document.getElementById('truckChargesFixes').value) || 0,
        montantAssurance: parseFloat(document.getElementById('truckAssurance').value) || 0,
        montantTaxe: parseFloat(document.getElementById('truckTaxe').value) || 0,
        chargePersonnel: parseFloat(document.getElementById('truckPersonnel').value) || 0,
        fraisLeasing: parseFloat(document.getElementById('truckLeasing').value) || 0,
        photoUrl: document.getElementById('truckPhotoUrl').value || null
    };
    if (!truck.matricule) { alert('Matricule requis'); return; }

    // Upload photo if a new file was selected
    const photoFile = document.getElementById('truckPhotoFile')?.files[0];
    if (photoFile) {
        try {
            const result = await CloudinaryHelper.uploadToCloudinary(photoFile, 'profiles/trucks');
            truck.photoUrl = result.url;
        } catch (err) {
            console.error('Photo upload error:', err);
            alert('Erreur upload photo: ' + err.message);
            return;
        }
    }

    await DataModule.saveTruck(truck);
    App.hideModal();
    refresh();
}

function edit(id) { openModal(id); }

async function remove(id) {
    if (confirm('Supprimer ce camion ?')) {
        await DataModule.deleteTruck(id);
        refresh();
    }
}

export const TrucksModule = { init, refresh, edit, remove };
window.TrucksModule = TrucksModule;
