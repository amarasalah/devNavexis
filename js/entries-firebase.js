/**
 * ENTRIES MODULE - FIREBASE VERSION
 * With round-trip (aller-retour) distance calculation
 * And trajectory statistics for driver/truck performance
 */

import { DataModule } from './data-firebase.js';
import { TrajectoryStatsModule } from './trajectory-stats-firebase.js';
import { ClientsModule } from './clients-firebase.js';

function init() {
    document.getElementById('addEntryBtn')?.addEventListener('click', () => openModal());
    // Hide add button for chauffeur (read-only)
    if (window.currentUser?.driverId) {
        const addBtn = document.getElementById('addEntryBtn');
        if (addBtn) addBtn.style.display = 'none';
    }
}

async function refresh(selectedDate) {
    await renderEntries(selectedDate);
}

async function renderEntries(selectedDate) {
    let entries = DataModule.getEntriesByDate(selectedDate);
    // Chauffeur data scope: show only their entries
    const cu = window.currentUser;
    if (cu?.driverId) {
        entries = entries.filter(e => e.chauffeurId === cu.driverId);
    }
    const tbody = document.getElementById('entriesBody');
    if (!tbody) return;

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:#64748b;padding:40px;">Aucune saisie pour cette date.</td></tr>';
        return;
    }

    // Get clients for display
    const clients = await ClientsModule.getClients();

    // Pre-fetch Bons de Sortie + Livraisons + Commandes + Articles for dynamic maintenance cost
    let allSorties = [];
    try {
        const SM = window.SuppliersModule;
        const AM = window.ArticlesModule;
        // Ensure all caches loaded (needed for BL→BC→prixUnitaire price chain)
        if (AM) await AM.getArticles();
        if (SM) {
            await SM.getLivraisons();
            await SM.getCommandes();
            allSorties = await SM.getSorties();
        }
    } catch (e) { /* ignore */ }

    // Track first trip per truck per day (fixed charges only once)
    const truckDaySeen = new Set();

    tbody.innerHTML = entries.map(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        const driver = DataModule.getDriverById(entry.chauffeurId);
        const client = entry.clientId ? clients.find(c => c.id === entry.clientId) : null;
        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);
        // Compute maintenance from Bons de Sortie (dynamic, not static entry field)
        const bsMaintenance = DataModule.getMaintenanceCostFromBSSync(allSorties, entry.camionId, entry.date);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip, bsMaintenance > 0 ? bsMaintenance : null);
        const resultClass = costs.resultat >= 0 ? 'result-positive' : 'result-negative';
        const isIdle = entry.source === 'idle_day';
        const hasPhotos = !!(entry.startPhotos || entry.endPhotos);

        const origineShort = entry.origineDelegation || entry.origineGouvernorat || '-';
        const destShort = client
            ? `${client.nom} (${entry.delegation || entry.gouvernorat || ''})`
            : (entry.delegation || entry.gouvernorat || entry.destination || '-');
        const trajetDisplay = isIdle ? '🚫 Journée sans voyage' : `${origineShort} ↔ ${destShort}`;
        const trajetFull = isIdle ? (entry.remarques || 'Charges fixes uniquement') : `Aller: ${origineShort} → ${destShort}\nRetour: ${destShort} → ${origineShort}`;

        const rowStyle = isIdle
            ? 'style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(251, 191, 36, 0.08)); border-left: 4px solid #f59e0b;"'
            : '';

        return `<tr ${rowStyle}>
            <td>${formatDate(entry.date)}</td>
            <td><strong>${client?.nom || (isIdle ? '-' : '-')}</strong></td>
            <td>${truck?.matricule || entry.matricule || '-'}</td>
            <td>${driver?.nom || entry.chauffeur || (isIdle ? '<span style="color:#f59e0b;font-size:0.8rem">Aucun</span>' : '-')}</td>
            <td title="${trajetFull}" ${isIdle ? 'style="color:#f59e0b;font-weight:600"' : ''}>${trajetDisplay}</td>
            <td>${entry.kilometrage || 0} km</td>
            <td>${entry.quantiteGasoil || 0} L</td>
            <td style="${bsMaintenance > 0 ? 'color:#f59e0b;font-weight:600' : 'color:#64748b'}">${bsMaintenance > 0 ? bsMaintenance.toLocaleString('fr-FR') + ' TND' : (entry.maintenance ? (entry.maintenance).toLocaleString('fr-FR') + ' TND' : '-')}</td>
            <td>${costs.coutTotal.toLocaleString('fr-FR')} TND</td>
            <td>${(entry.prixLivraison || 0).toLocaleString('fr-FR')} TND</td>
            <td>${entry.tauxTVA ? entry.tauxTVA + '%' : '0%'}</td>
            <td class="${resultClass}">${costs.resultat.toLocaleString('fr-FR')} TND</td>
            <td>
                ${hasPhotos ? `
                <button class="btn btn-sm btn-outline" onclick="EntriesModule.showEntryPhotos('${entry.id}')" title="Voir photos du voyage"
                    style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3)">
                    📷
                </button>
                ` : ''}
                ${!window.currentUser?.driverId ? `
                <button class="btn btn-sm btn-outline" onclick="EntriesModule.edit('${entry.id}')">✏️</button>
                <button class="btn btn-sm btn-outline" onclick="EntriesModule.remove('${entry.id}')">🗑️</button>
                ` : ''}
            </td>
        </tr>`;
    }).join('');
}

function formatDate(dateStr) {
    // Parse as local date to avoid UTC timezone shift
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function openModal(entryId = null) {
    const entries = await DataModule.getEntries();
    const entry = entryId ? entries.find(e => e.id === entryId) : null;
    const trucks = await DataModule.getTrucks();
    const drivers = await DataModule.getDrivers();
    const clients = await ClientsModule.getClients();
    const settings = await DataModule.getSettings();
    const title = entry ? 'Modifier Saisie' : 'Nouvelle Saisie Journalière';

    const selectedDate = document.getElementById('selectedDate')?.value || new Date().toISOString().split('T')[0];

    const truckOptions = trucks.map(t =>
        `<option value="${t.id}" ${entry?.camionId === t.id ? 'selected' : ''}>${t.matricule} (${t.type})</option>`
    ).join('');

    const driverOptions = drivers.map(d =>
        `<option value="${d.id}" ${entry?.chauffeurId === d.id ? 'selected' : ''}>${d.nom}</option>`
    ).join('');

    const clientOptions = clients.map(c =>
        `<option value="${c.id}" ${entry?.clientId === c.id ? 'selected' : ''}>${c.nom}</option>`
    ).join('');

    const gouvernorats = getGouvernorats();

    const origineGouvernoratOptions = gouvernorats.map(g =>
        `<option value="${g}" ${entry?.origineGouvernorat === g ? 'selected' : ''}>${g}</option>`
    ).join('');
    const origineDelegations = entry?.origineGouvernorat ? getDelegations(entry.origineGouvernorat) : [];
    const origineDelegationOptions = origineDelegations.map(d =>
        `<option value="${d}" ${entry?.origineDelegation === d ? 'selected' : ''}>${d}</option>`
    ).join('');

    const destGouvernoratOptions = gouvernorats.map(g =>
        `<option value="${g}" ${entry?.gouvernorat === g ? 'selected' : ''}>${g}</option>`
    ).join('');
    const destDelegations = entry?.gouvernorat ? getDelegations(entry.gouvernorat) : [];
    const destDelegationOptions = destDelegations.map(d =>
        `<option value="${d}" ${entry?.delegation === d ? 'selected' : ''}>${d}</option>`
    ).join('');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <form id="entryForm">
            <input type="hidden" id="entryId" value="${entry?.id || ''}">
            
            <div class="form-row">
                <div class="form-group">
                    <label for="entryDate">📅 Date</label>
                    <input type="date" id="entryDate" value="${entry?.date || selectedDate}" required>
                </div>
            </div>

            <!-- Origin Section -->
            <div style="background: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #10b981;">
                <h4 style="margin-bottom: 12px; color: #10b981;">🚀 Point de Départ</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="origineGouvernorat">Gouvernorat</label>
                        <select id="origineGouvernorat" required onchange="EntriesModule.onOrigineGouvernoratChange()">
                            <option value="">-- Sélectionner --</option>
                            ${origineGouvernoratOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="origineDelegation">Délégation</label>
                        <select id="origineDelegation" required onchange="EntriesModule.updateDistanceEstimate()">
                            <option value="">-- Sélectionner gouvernorat --</option>
                            ${origineDelegationOptions}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Destination Section -->
            <div style="background: rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #ef4444;">
                <h4 style="margin-bottom: 12px; color: #ef4444;">📍 Destination</h4>
                <div class="form-group" style="margin-bottom:12px">
                    <label for="entryClient">👥 Client</label>
                    <select id="entryClient" onchange="EntriesModule.onClientChangeDestination()">
                        <option value="">-- Aucun client --</option>
                        ${clientOptions}
                    </select>
                    <div id="entryClientLocInfo" style="font-size:12px;margin-top:6px"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="entryGouvernorat">Gouvernorat *</label>
                        <select id="entryGouvernorat" required onchange="EntriesModule.onGouvernoratChange()">
                            <option value="">-- Sélectionner --</option>
                            ${destGouvernoratOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="entryDelegation">Délégation *</label>
                        <select id="entryDelegation" required onchange="EntriesModule.updateDistanceEstimate()">
                            <option value="">-- Sélectionner gouvernorat --</option>
                            ${destDelegationOptions}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Trajectory & Distance Display -->
            <div style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="text-align: center; margin-bottom: 12px;">
                    <div id="trajectoryDisplay" style="color: #3b82f6; font-size: 1rem; margin-bottom: 8px;">
                        <span style="color: #10b981;">🚀 Départ</span> → 
                        <span style="color: #ef4444;">📍 Destination</span> → 
                        <span style="color: #10b981;">🚀 Retour</span>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center;">
                    <div>
                        <span style="color: #64748b; font-size: 0.75rem;">Distance Aller</span>
                        <div id="distanceAller" style="color: #10b981; font-size: 1.25rem; font-weight: bold;">0 km</div>
                    </div>
                    <div>
                        <span style="color: #64748b; font-size: 0.75rem;">Distance Retour</span>
                        <div id="distanceRetour" style="color: #ef4444; font-size: 1.25rem; font-weight: bold;">0 km</div>
                    </div>
                    <div>
                        <span style="color: #64748b; font-size: 0.75rem;">Total Aller-Retour</span>
                        <div id="distanceTotal" style="color: #3b82f6; font-size: 1.5rem; font-weight: bold;">0 km</div>
                    </div>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="entryCamion">🚛 Camion</label>
                    <select id="entryCamion" required onchange="EntriesModule.onTruckChange()">
                        <option value="">-- Sélectionner --</option>
                        ${truckOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="entryChauffeur">👤 Chauffeur</label>
                    <select id="entryChauffeur" required>
                        <option value="">-- Sélectionner --</option>
                        ${driverOptions}
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="entryKm">🛣️ Kilométrage Total (km)</label>
                    <input type="number" id="entryKm" value="${entry?.kilometrage || 0}" min="0" required>
                    <small style="color: #64748b;">Aller-retour calculé automatiquement</small>
                </div>
                <div class="form-group">
                    <label for="entryGasoil">⛽ Quantité Gasoil (L)</label>
                    <input type="number" id="entryGasoil" value="${entry?.quantiteGasoil || 0}" min="0" required onchange="EntriesModule.updateCalculations()">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="entryPrixGasoil">Prix Gasoil (TND/L)</label>
                    <input type="number" id="entryPrixGasoil" value="${entry?.prixGasoilLitre || settings.defaultFuelPrice}" min="0" step="0.1" required onchange="EntriesModule.updateCalculations()">
                </div>
                <div class="form-group">
                    <label for="entryMaintenance">🔧 Maintenance (TND) ${entry?.camionId ? '<small style="color:#f59e0b" id="bsMaintenanceHint"></small>' : ''}</label>
                    <input type="number" id="entryMaintenance" value="${entry?.maintenance || 0}" min="0" onchange="EntriesModule.updateCalculations()">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="entryPrixLivraison">💵 Prix Livraison (TND)</label>
                    <input type="number" id="entryPrixLivraison" value="${entry?.prixLivraison || 0}" min="0" required onchange="EntriesModule.updateCalculations()">
                </div>
                <div class="form-group">
                    <label for="entryTauxTVA">📊 Taux TVA</label>
                    <select id="entryTauxTVA" onchange="EntriesModule.updateCalculations()">
                        <option value="0" ${(!entry?.tauxTVA || entry?.tauxTVA === 0) ? 'selected' : ''}>0%</option>
                        <option value="7" ${entry?.tauxTVA === 7 ? 'selected' : ''}>7%</option>
                        <option value="19" ${entry?.tauxTVA === 19 ? 'selected' : ''}>19%</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="entryRemarques">📝 Remarques</label>
                    <input type="text" id="entryRemarques" value="${entry?.remarques || ''}" placeholder="Ex: VIDANGE">
                </div>
            </div>

            <div style="background: rgba(139, 92, 246, 0.1); border-radius: 8px; padding: 16px; margin-top: 16px;">
                <h4 style="margin-bottom: 12px; color: #8b5cf6;">💰 Calculs Automatiques</h4>
                <div class="form-row">
                    <div class="form-group readonly">
                        <label>Montant Gasoil</label>
                        <input type="text" id="calcGasoil" value="0 TND" readonly>
                    </div>
                    <div class="form-group readonly">
                        <label>Coût Total</label>
                        <input type="text" id="calcCout" value="0 TND" readonly>
                    </div>
                </div>
                <div class="form-group readonly">
                    <label>Résultat (Livraison - Coût)</label>
                    <input type="text" id="calcResultat" value="0 TND" readonly style="font-weight: bold; font-size: 1.1rem;">
                </div>
            </div>

            <!-- Trajectory Statistics Panel -->
            <div id="trajectoryStatsContainer"></div>
        </form>
    `;

    document.getElementById('modalSave').onclick = saveEntry;
    App.showModal();
    setTimeout(async () => {
        // Auto-populate maintenance from Bons de Sortie
        if (entry?.camionId && entry?.date) {
            try {
                const bsM = await DataModule.getMaintenanceCostFromBS(entry.camionId, entry.date);
                if (bsM > 0) {
                    const maintInput = document.getElementById('entryMaintenance');
                    if (maintInput) maintInput.value = bsM;
                    const hint = document.getElementById('bsMaintenanceHint');
                    if (hint) hint.textContent = `(${bsM.toFixed(3)} TND depuis BS Achat)`;
                }
            } catch (e) { /* ignore */ }
        }
        updateCalculations();
        updateTrajectoryStats();
    }, 100);
}

function onOrigineGouvernoratChange() {
    const gouvernorat = document.getElementById('origineGouvernorat').value;
    const delegationSelect = document.getElementById('origineDelegation');

    if (!gouvernorat) {
        delegationSelect.innerHTML = '<option value="">-- Sélectionner gouvernorat --</option>';
        return;
    }

    const delegations = getDelegations(gouvernorat);
    delegationSelect.innerHTML = '<option value="">-- Sélectionner --</option>' +
        delegations.map(d => `<option value="${d}">${d}</option>`).join('');

    updateDistanceEstimate();
}

function onGouvernoratChange() {
    const gouvernorat = document.getElementById('entryGouvernorat').value;
    const delegationSelect = document.getElementById('entryDelegation');

    if (!gouvernorat) {
        delegationSelect.innerHTML = '<option value="">-- Sélectionner gouvernorat --</option>';
        return;
    }

    const delegations = getDelegations(gouvernorat);
    delegationSelect.innerHTML = '<option value="">-- Sélectionner --</option>' +
        delegations.map(d => `<option value="${d}">${d}</option>`).join('');

    updateDistanceEstimate();
}

async function onClientChangeDestination() {
    const clientId = document.getElementById('entryClient')?.value;
    const infoDiv = document.getElementById('entryClientLocInfo');
    if (!clientId) {
        if (infoDiv) infoDiv.innerHTML = '';
        return;
    }
    const client = ClientsModule.getClientById(clientId);
    if (!client) return;

    // Show client info + button to use client's default location
    if (infoDiv) {
        const hasLoc = client.gouvernorat;
        const loc = client.delegation ? `${client.delegation}, ${client.gouvernorat}` : (client.gouvernorat || 'Non d\u00e9finie');
        infoDiv.innerHTML = hasLoc
            ? `<span style="color:#64748b">\ud83d\udccd Localisation: <strong>${loc}</strong></span>
               <button type="button" onclick="EntriesModule.useClientLocation()" style="margin-left:8px;padding:3px 10px;border-radius:4px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-size:12px;cursor:pointer">Utiliser cette localisation</button>`
            : `<span style="color:#94a3b8">\ud83d\udccd Aucune localisation par d\u00e9faut pour ce client</span>`;
    }
}

function useClientLocation() {
    const clientId = document.getElementById('entryClient')?.value;
    if (!clientId) return;
    const client = ClientsModule.getClientById(clientId);
    if (!client?.gouvernorat) return;

    const gouvSel = document.getElementById('entryGouvernorat');
    if (gouvSel) { gouvSel.value = client.gouvernorat; onGouvernoratChange(); }
    setTimeout(() => {
        if (client.delegation) {
            const delSel = document.getElementById('entryDelegation');
            if (delSel) delSel.value = client.delegation;
        }
        updateDistanceEstimate();
        const infoDiv = document.getElementById('entryClientLocInfo');
        if (infoDiv) {
            const loc = client.delegation ? `${client.delegation}, ${client.gouvernorat}` : client.gouvernorat;
            infoDiv.innerHTML = `<span style="color:#10b981">\u2705 Localisation appliqu\u00e9e: <strong>${loc}</strong></span>`;
        }
    }, 50);
}

function updateDistanceEstimate() {
    const origineGouv = document.getElementById('origineGouvernorat')?.value;
    const origineDel = document.getElementById('origineDelegation')?.value;
    const destGouv = document.getElementById('entryGouvernorat')?.value || '';
    const destDel = document.getElementById('entryDelegation')?.value || '';

    const destName = destDel || destGouv;

    if (origineGouv && destGouv) {
        const distanceAller = getDistanceEstimate(origineGouv, origineDel, destGouv, destDel);
        const distanceRetour = distanceAller;
        const distanceTotal = distanceAller * 2;

        const origName = origineDel || origineGouv;
        const trajDisplay = document.getElementById('trajectoryDisplay');
        if (trajDisplay) {
            trajDisplay.innerHTML = `
                <span style="color: #10b981;">\ud83d\ude80 ${origName}</span> \u2192 
                <span style="color: #ef4444;">\ud83d\udccd ${destName}</span> \u2192 
                <span style="color: #10b981;">\ud83c\udfe0 ${origName}</span>
            `;
        }

        const allerDisplay = document.getElementById('distanceAller');
        const retourDisplay = document.getElementById('distanceRetour');
        const totalDisplay = document.getElementById('distanceTotal');

        if (allerDisplay) allerDisplay.textContent = `${distanceAller} km`;
        if (retourDisplay) retourDisplay.textContent = `${distanceRetour} km`;
        if (totalDisplay) totalDisplay.textContent = `${distanceTotal} km`;

        const kmField = document.getElementById('entryKm');
        if (kmField) kmField.value = distanceTotal;

        // Update trajectory statistics for the new route
        updateTrajectoryStats();
    }
}

async function onTruckChange() {
    const truckId = document.getElementById('entryCamion').value;
    if (truckId) {
        const drivers = await DataModule.getDrivers();
        const driver = drivers.find(d => d.camionId === truckId);
        if (driver) {
            document.getElementById('entryChauffeur').value = driver.id;
        }
    }
    updateCalculations();
    updateTrajectoryStats(); // Update stats when truck changes
}

function updateCalculations() {
    const truckId = document.getElementById('entryCamion')?.value;
    const truck = truckId ? DataModule.getTruckById(truckId) : null;

    const gasoil = parseFloat(document.getElementById('entryGasoil')?.value) || 0;
    const prixGasoil = parseFloat(document.getElementById('entryPrixGasoil')?.value) || 0;
    const maintenance = parseFloat(document.getElementById('entryMaintenance')?.value) || 0;
    const prixLivraison = parseFloat(document.getElementById('entryPrixLivraison')?.value) || 0;
    const tauxTVA = parseInt(document.getElementById('entryTauxTVA')?.value) || 0;

    const montantGasoil = gasoil * prixGasoil;
    let coutTotal = montantGasoil + maintenance;

    if (truck) {
        coutTotal += truck.chargesFixes + truck.montantAssurance + truck.montantTaxe + truck.chargePersonnel + (truck.fraisLeasing || 0);
    }

    const montantTVA = prixLivraison * tauxTVA / 100;
    const prixLivraisonTTC = prixLivraison + montantTVA;
    const resultat = prixLivraisonTTC - coutTotal;

    const calcGasoil = document.getElementById('calcGasoil');
    const calcCout = document.getElementById('calcCout');
    const calcResultat = document.getElementById('calcResultat');

    if (calcGasoil) calcGasoil.value = `${montantGasoil.toLocaleString('fr-FR')} TND`;
    if (calcCout) calcCout.value = `${coutTotal.toLocaleString('fr-FR')} TND`;
    if (calcResultat) {
        calcResultat.value = `${resultat.toLocaleString('fr-FR')} TND` + (tauxTVA > 0 ? ` (TTC: ${prixLivraisonTTC.toLocaleString('fr-FR')})` : '');
        calcResultat.style.color = resultat >= 0 ? '#10b981' : '#ef4444';
    }
}

async function saveEntry() {
    const origineGouvernorat = document.getElementById('origineGouvernorat').value;
    const origineDelegation = document.getElementById('origineDelegation').value;
    const gouvernorat = document.getElementById('entryGouvernorat').value;
    const delegation = document.getElementById('entryDelegation').value;
    const clientId = document.getElementById('entryClient')?.value || null;

    // Calculate distance from gouvernorat/delegation
    const distanceAller = getDistanceEstimate(origineGouvernorat, origineDelegation, gouvernorat, delegation);
    const destLabel = delegation ? `${delegation}, ${gouvernorat}` : gouvernorat;

    // When editing, preserve existing fields (source, createdAt, photos, etc.)
    const entryId = document.getElementById('entryId').value || null;
    const existingEntry = entryId ? DataModule.getCachedEntries().find(e => e.id === entryId) : null;

    const entry = {
        ...(existingEntry || {}),
        id: entryId,
        date: document.getElementById('entryDate').value,
        camionId: document.getElementById('entryCamion').value,
        chauffeurId: document.getElementById('entryChauffeur').value,
        clientId: clientId,
        origineGouvernorat,
        origineDelegation,
        origine: origineDelegation ? `${origineDelegation}, ${origineGouvernorat}` : origineGouvernorat,
        gouvernorat,
        delegation,
        destination: destLabel,
        distanceAller,
        distanceRetour: distanceAller,
        kilometrage: parseFloat(document.getElementById('entryKm').value) || 0,
        quantiteGasoil: parseFloat(document.getElementById('entryGasoil').value) || 0,
        prixGasoilLitre: parseFloat(document.getElementById('entryPrixGasoil').value) || 2,
        maintenance: parseFloat(document.getElementById('entryMaintenance').value) || 0,
        prixLivraison: parseFloat(document.getElementById('entryPrixLivraison').value) || 0,
        tauxTVA: parseInt(document.getElementById('entryTauxTVA').value) || 0,
        remarques: document.getElementById('entryRemarques').value
    };

    if (!entry.date || !entry.camionId || !entry.chauffeurId || !entry.origineGouvernorat || !gouvernorat) {
        alert('Veuillez remplir la date, l\'origine, la destination, le camion et le chauffeur');
        return;
    }

    await DataModule.saveEntry(entry);
    App.hideModal();
    App.refreshCurrentPage();
}

function edit(id) { openModal(id); }

async function remove(id) {
    if (confirm('Supprimer cette saisie ?')) {
        await DataModule.deleteEntry(id);
        App.refreshCurrentPage();
    }
}

/**
 * Update trajectory statistics panel when driver/truck/route changes
 */
async function updateTrajectoryStats() {
    const container = document.getElementById('trajectoryStatsContainer');
    if (!container) return;

    const driverId = document.getElementById('entryChauffeur')?.value;
    const truckId = document.getElementById('entryCamion')?.value;
    const fromGouv = document.getElementById('origineGouvernorat')?.value;
    const fromDeleg = document.getElementById('origineDelegation')?.value;
    const toGouv = document.getElementById('entryGouvernorat')?.value;
    const toDeleg = document.getElementById('entryDelegation')?.value;

    // Need both origin and destination to show stats
    if (!fromGouv || !toGouv) {
        container.innerHTML = '';
        return;
    }

    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: 12px; color: #64748b;">
            <span>⏳ Chargement des statistiques...</span>
        </div>
    `;

    try {
        const driverStats = driverId ?
            await TrajectoryStatsModule.getDriverTrajectoryStats(driverId, fromGouv, fromDeleg, toGouv, toDeleg) :
            { tripCount: 0 };

        const truckStats = truckId ?
            await TrajectoryStatsModule.getTruckTrajectoryStats(truckId, fromGouv, fromDeleg, toGouv, toDeleg) :
            { tripCount: 0 };

        container.innerHTML = TrajectoryStatsModule.renderTrajectoryStatsPanel(driverStats, truckStats);
    } catch (error) {
        console.error('Error loading trajectory stats:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 12px; color: #ef4444;">
                ❌ Erreur lors du chargement des statistiques
            </div>
        `;
    }
}

// ==================== ENTRY TRIP PHOTOS ====================
function showEntryPhotos(entryId) {
    const entries = DataModule.getCachedEntries() || [];
    const entry = entries.find(e => e.id === entryId);
    if (!entry) { alert('Saisie introuvable'); return; }

    const photoLabels = {
        dashboard: '🎛️ Tableau de bord',
        fullTruck: '🚛 Camion complet',
        document: '📋 Document BC/BL',
        cargo: '📦 Cargaison'
    };

    const sections = [];

    if (entry.startPhotos) {
        const items = Object.entries(entry.startPhotos)
            .filter(([k, v]) => v && k !== 'timestamp' && typeof v === 'string' && v.startsWith('http'))
            .map(([k, v]) => `
                <div style="background:rgba(0,0,0,0.3);border-radius:10px;overflow:hidden;border:1px solid rgba(148,163,184,0.1)">
                    <div style="padding:8px 12px;border-bottom:1px solid rgba(148,163,184,0.1);color:#10b981;font-size:0.8rem;font-weight:600">${photoLabels[k] || k}</div>
                    <img src="${v}" style="width:100%;display:block;cursor:pointer" onclick="window.open('${v}','_blank')" title="Cliquer pour agrandir">
                </div>
            `).join('');
        if (items) sections.push({ title: '🟢 Photos Départ', html: items });
    }

    if (entry.endPhotos) {
        const items = Object.entries(entry.endPhotos)
            .filter(([k, v]) => v && k !== 'timestamp' && typeof v === 'string' && v.startsWith('http'))
            .map(([k, v]) => `
                <div style="background:rgba(0,0,0,0.3);border-radius:10px;overflow:hidden;border:1px solid rgba(148,163,184,0.1)">
                    <div style="padding:8px 12px;border-bottom:1px solid rgba(148,163,184,0.1);color:#f97316;font-size:0.8rem;font-weight:600">${photoLabels[k] || k}</div>
                    <img src="${v}" style="width:100%;display:block;cursor:pointer" onclick="window.open('${v}','_blank')" title="Cliquer pour agrandir">
                </div>
            `).join('');
        if (items) sections.push({ title: '🔴 Photos Arrivée', html: items });
    }

    if (sections.length === 0) {
        alert('Aucune photo disponible pour cette saisie.');
        return;
    }

    const truck = DataModule.getTruckById(entry.camionId);
    const driver = DataModule.getDriverById(entry.chauffeurId);

    const modal = document.createElement('div');
    modal.id = 'entryPhotosModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:flex-start;padding:20px;overflow-y:auto';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:16px;max-width:900px;width:100%;border:1px solid rgba(148,163,184,0.1);overflow:hidden;margin:20px auto">
            <div style="padding:20px;border-bottom:1px solid rgba(148,163,184,0.1);display:flex;justify-content:space-between;align-items:center">
                <div>
                    <h3 style="color:#f1f5f9;font-size:1.1rem;margin:0">📷 Photos du voyage</h3>
                    <div style="color:#94a3b8;font-size:0.8rem;margin-top:4px">
                        ${truck?.matricule || '-'} • ${driver?.nom || '-'} • ${entry.date} • ${entry.destination || entry.gouvernorat || '-'}
                    </div>
                </div>
                <button onclick="document.getElementById('entryPhotosModal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer">✕</button>
            </div>
            ${sections.map(s => `
                <div style="padding:16px 20px;border-bottom:1px solid rgba(148,163,184,0.05)">
                    <h4 style="color:#a78bfa;font-size:0.9rem;margin:0 0 12px 0">${s.title}</h4>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
                        ${s.html}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    document.body.appendChild(modal);
}

export const EntriesModule = {
    init,
    refresh,
    edit,
    remove,
    onTruckChange,
    onOrigineGouvernoratChange,
    onGouvernoratChange,
    updateCalculations,
    updateDistanceEstimate,
    updateTrajectoryStats,
    onClientChangeDestination,
    useClientLocation,
    showEntryPhotos
};

window.EntriesModule = EntriesModule;
