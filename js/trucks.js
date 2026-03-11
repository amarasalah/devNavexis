/**
 * TRUCKS MODULE
 * Handles truck management with performance statistics
 */

const TrucksModule = (() => {
    function init() {
        document.getElementById('addTruckBtn')?.addEventListener('click', () => openModal());
    }

    function refresh() {
        renderTrucks();
    }

    function calculateTruckStats(truckId) {
        const entries = DataModule.getEntries().filter(e => e.camionId === truckId);
        const truck = DataModule.getTruckById(truckId);

        if (entries.length === 0) {
            return {
                totalKm: 0,
                totalGasoil: 0,
                totalCout: 0,
                totalRevenue: 0,
                resultat: 0,
                coutParKm: 0,
                consommation: 0, // L/100km
                nbTrajets: 0,
                performance: 0 // percentage
            };
        }

        let totalKm = 0;
        let totalGasoil = 0;
        let totalCout = 0;
        let totalRevenue = 0;

        entries.forEach(entry => {
            totalKm += entry.kilometrage || 0;
            totalGasoil += entry.quantiteGasoil || 0;
            totalRevenue += entry.prixLivraison || 0;

            const costs = DataModule.calculateEntryCosts(entry, truck);
            totalCout += costs.coutTotal;
        });

        const resultat = totalRevenue - totalCout;
        const coutParKm = totalKm > 0 ? totalCout / totalKm : 0;
        const consommation = totalKm > 0 ? (totalGasoil / totalKm) * 100 : 0; // L/100km

        // Performance = profit margin percentage
        const performance = totalRevenue > 0 ? (resultat / totalRevenue) * 100 : 0;

        return {
            totalKm,
            totalGasoil,
            totalCout,
            totalRevenue,
            resultat,
            coutParKm,
            consommation,
            nbTrajets: entries.length,
            performance
        };
    }

    function renderTrucks() {
        const trucks = DataModule.getTrucks();
        const grid = document.getElementById('trucksGrid');
        if (!grid) return;

        grid.innerHTML = trucks.map(truck => {
            const stats = calculateTruckStats(truck.id);
            const performanceClass = stats.performance >= 20 ? 'perf-excellent' :
                stats.performance >= 10 ? 'perf-good' :
                    stats.performance >= 0 ? 'perf-average' : 'perf-bad';
            const resultatClass = stats.resultat >= 0 ? 'result-positive' : 'result-negative';

            return `
            <div class="entity-card truck-card">
                <div class="entity-header">
                    <div class="entity-icon">🚛</div>
                    <div class="entity-info">
                        <h3>${truck.matricule}</h3>
                        <span class="entity-badge">${truck.type}</span>
                    </div>
                    <div class="entity-actions">
                        <button class="btn btn-sm btn-outline" onclick="TrucksModule.edit('${truck.id}')">✏️</button>
                        <button class="btn btn-sm btn-outline" onclick="TrucksModule.remove('${truck.id}')">🗑️</button>
                    </div>
                </div>
                
                <!-- Performance Stats -->
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">🛣️ Kilométrage</span>
                        <span class="stat-value">${stats.totalKm.toLocaleString('fr-FR')} km</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">⛽ Gasoil</span>
                        <span class="stat-value">${stats.totalGasoil.toLocaleString('fr-FR')} L</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">📊 Conso.</span>
                        <span class="stat-value">${stats.consommation.toFixed(1)} L/100km</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">💵 Coût/Km</span>
                        <span class="stat-value">${stats.coutParKm.toFixed(2)} TND</span>
                    </div>
                </div>
                
                <!-- Financial Summary -->
                <div class="financial-summary">
                    <div class="fin-row">
                        <span>📈 Revenus:</span>
                        <span class="result-positive">${stats.totalRevenue.toLocaleString('fr-FR')} TND</span>
                    </div>
                    <div class="fin-row">
                        <span>📉 Coûts:</span>
                        <span class="result-negative">${stats.totalCout.toLocaleString('fr-FR')} TND</span>
                    </div>
                    <div class="fin-row fin-result">
                        <span>💰 Résultat:</span>
                        <span class="${resultatClass}">${stats.resultat.toLocaleString('fr-FR')} TND</span>
                    </div>
                </div>
                
                <!-- Performance Bar -->
                <div class="performance-bar">
                    <div class="perf-label">
                        <span>Performance</span>
                        <span class="${performanceClass}">${stats.performance.toFixed(1)}%</span>
                    </div>
                    <div class="perf-track">
                        <div class="perf-fill ${performanceClass}" style="width: ${Math.max(0, Math.min(100, stats.performance + 50))}%"></div>
                    </div>
                </div>
                
                <!-- Fixed Costs -->
                <div class="costs-details">
                    <span class="cost-tag">Fixes: ${truck.chargesFixes} TND</span>
                    <span class="cost-tag">Assurance: ${truck.montantAssurance} TND</span>
                    <span class="cost-tag">Taxe: ${truck.montantTaxe} TND</span>
                    <span class="cost-tag">Personnel: ${truck.chargePersonnel} TND</span>
                </div>
                
                <div class="entity-footer">
                    <span class="trajet-count">📍 ${stats.nbTrajets} trajet(s)</span>
                </div>
            </div>`;
        }).join('');
    }

    function openModal(truckId = null) {
        const truck = truckId ? DataModule.getTruckById(truckId) : null;
        const title = truck ? 'Modifier Camion' : 'Nouveau Camion';

        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = `
            <form id="truckForm">
                <input type="hidden" id="truckId" value="${truck?.id || ''}">
                <div class="form-group">
                    <label for="truckMatricule">Matricule</label>
                    <input type="text" id="truckMatricule" value="${truck?.matricule || ''}" required placeholder="Ex: 8565 TU 257">
                </div>
                <div class="form-group">
                    <label for="truckType">Type</label>
                    <select id="truckType" required>
                        <option value="PLATEAU" ${truck?.type === 'PLATEAU' ? 'selected' : ''}>PLATEAU</option>
                        <option value="BENNE" ${truck?.type === 'BENNE' ? 'selected' : ''}>BENNE</option>
                        <option value="CITERNE" ${truck?.type === 'CITERNE' ? 'selected' : ''}>CITERNE</option>
                        <option value="FRIGORIFIQUE" ${truck?.type === 'FRIGORIFIQUE' ? 'selected' : ''}>FRIGORIFIQUE</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="truckChargesFixes">Charges Fixes (TND)</label>
                        <input type="number" id="truckChargesFixes" value="${truck?.chargesFixes || 80}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="truckAssurance">Assurance (TND)</label>
                        <input type="number" id="truckAssurance" value="${truck?.montantAssurance || 20}" min="0">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="truckTaxe">Taxe (TND)</label>
                        <input type="number" id="truckTaxe" value="${truck?.montantTaxe || 20}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="truckPersonnel">Charge Personnel (TND)</label>
                        <input type="number" id="truckPersonnel" value="${truck?.chargePersonnel || 80}" min="0">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="truckLeasing">💳 Leasing (TND/jour)</label>
                        <input type="number" id="truckLeasing" value="${truck?.fraisLeasing || 0}" min="0" step="0.1">
                    </div>
                </div>
            </form>
        `;

        document.getElementById('modalSave').onclick = saveTruck;
        App.showModal();
    }

    function saveTruck() {
        const truck = {
            id: document.getElementById('truckId').value || null,
            matricule: document.getElementById('truckMatricule').value,
            type: document.getElementById('truckType').value,
            chargesFixes: parseFloat(document.getElementById('truckChargesFixes').value) || 0,
            montantAssurance: parseFloat(document.getElementById('truckAssurance').value) || 0,
            montantTaxe: parseFloat(document.getElementById('truckTaxe').value) || 0,
            chargePersonnel: parseFloat(document.getElementById('truckPersonnel').value) || 0,
            fraisLeasing: parseFloat(document.getElementById('truckLeasing').value) || 0
        };

        if (!truck.matricule) {
            alert('Veuillez entrer le matricule');
            return;
        }

        DataModule.saveTruck(truck);
        App.hideModal();
        refresh();
    }

    function edit(id) {
        openModal(id);
    }

    function remove(id) {
        if (confirm('Supprimer ce camion ?')) {
            DataModule.deleteTruck(id);
            refresh();
        }
    }

    return { init, refresh, edit, remove };
})();
