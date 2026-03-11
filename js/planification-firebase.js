/**
 * PLANIFICATION MODULE - FIREBASE VERSION
 * With time, auto-status, terminé→entry conversion, and process type filters
 */

import { db, rtdb, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, COLLECTIONS, dbRef, dbPush, getNextNumber } from './firebase.js';
import { DataModule } from './data-firebase.js';
import { ClientsModule } from './clients-firebase.js';
import { notifyDriverTrip } from './push-notifications.js';

/**
 * Generate tracking URL for a plan
 */
function getTrackingUrl(planId) {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    return `${baseUrl}/tracking.html?id=${planId}`;
}

/**
 * Send tracking link to client via WhatsApp
 */
async function sendTrackingWhatsApp(plan) {
    if (!plan.clientId) return;
    const client = ClientsModule.getClientById(plan.clientId);
    if (!client?.telephone) {
        console.warn('⚠️ Client has no phone number for WhatsApp');
        return;
    }

    const trackingUrl = getTrackingUrl(plan.id);
    const destLabel = plan.destination || 'destination';
    const dateLabel = plan.date ? plan.date.split('-').reverse().join('/') : '';

    const message = `🚛 *FleetTrack - Suivi de Livraison*\n\n`
        + `Bonjour *${client.nom}*,\n\n`
        + `Votre livraison vers *${destLabel}* est planifiée pour le *${dateLabel}*.\n\n`
        + `📍 Suivez votre livraison en temps réel :\n${trackingUrl}\n\n`
        + `Merci de votre confiance !`;

    // Clean phone number (remove spaces, dashes, etc.)
    let phone = client.telephone.replace(/[\s\-\.\(\)]/g, '');
    // Add country code if not present (Tunisia: +216)
    if (!phone.startsWith('+') && !phone.startsWith('00')) {
        phone = '216' + phone;
    } else if (phone.startsWith('+')) {
        phone = phone.substring(1);
    } else if (phone.startsWith('00')) {
        phone = phone.substring(2);
    }

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    console.log('📱 WhatsApp tracking link sent to', client.nom, phone);
}


let cache = [];
let _loaded = false;
let _autoStatusInterval = null;

function init() {
    document.getElementById('addPlanBtn')?.addEventListener('click', () => openModal());
    document.getElementById('planFilterBtn')?.addEventListener('click', () => renderPlannings());
    console.log('📅 PlanificationModule initialized');
    // Hide add button for chauffeur (read-only)
    if (window.currentUser?.driverId) {
        const addBtn = document.getElementById('addPlanBtn');
        if (addBtn) addBtn.style.display = 'none';
    }
}

async function refresh(selectedDate) {
    await loadPlannings();
    await autoUpdateStatuses();
    await populateClientFilter();
    await renderPlannings(selectedDate);
    // Auto-check statuses every 60s
    if (_autoStatusInterval) clearInterval(_autoStatusInterval);
    _autoStatusInterval = setInterval(async () => {
        const changed = await autoUpdateStatuses();
        if (changed) await renderPlannings();
    }, 60000);
}

/** Populate client filter dropdown */
async function populateClientFilter() {
    const select = document.getElementById('planClientFilter');
    if (!select) return;
    const clients = await ClientsModule.getClients();
    select.innerHTML = '<option value="">Tous les clients</option>' +
        clients.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
}

/** Auto-update: planifié → en_cours_chargement when datetime has passed */
async function autoUpdateStatuses() {
    const now = new Date();
    let changed = false;
    for (const plan of cache) {
        if (plan.statut !== 'planifie') continue;
        const planDatetime = buildDatetime(plan.date, plan.heure);
        if (planDatetime && planDatetime <= now) {
            plan.statut = 'en_cours_chargement';
            plan.updatedAt = now.toISOString();
            try {
                await setDoc(doc(db, COLLECTIONS.planifications, plan.id), plan);
                console.log(`📅 Auto-status: ${plan.id} planifié → en_cours_chargement`);
                changed = true;

                // Push mobile notification
                if (plan.chauffeurId) {
                    try {
                        const notifRef = dbRef(rtdb, `notifications/${plan.chauffeurId}`);
                        await dbPush(notifRef, {
                            type: 'en_cours_chargement',
                            planId: plan.id,
                            destination: plan.destination || '',
                            date: plan.date || '',
                            truck: plan.camionId || '',
                            message: `Chargement en cours pour le voyage vers ${plan.destination || 'destination'}`,
                            timestamp: Date.now()
                        });
                    } catch (ne) { console.warn('Notif push error:', ne); }
                }
            } catch (err) {
                console.error('Auto-status update error:', err);
            }
        }
    }
    return changed;
}

/** Check if a date string (YYYY-MM-DD) is a Sunday */
function isSunday(dateStr) {
    if (!dateStr) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
}

function buildDatetime(dateStr, heureStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (heureStr) {
        const [h, min] = heureStr.split(':').map(Number);
        return new Date(y, m - 1, d, h, min);
    }
    return new Date(y, m - 1, d, 0, 0);
}

async function loadPlannings() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.planifications));
        cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _loaded = true;
        return cache;
    } catch (error) {
        console.error('Error loading planifications:', error);
        return [];
    }
}

/**
 * Check if this is the first trip for a given truck on a given day.
 * Non-gasoil charges (maintenance, truck fixed charges) should only be
 * counted on the first trip. Subsequent trips only carry gasoil.
 * @param {string} camionId - Truck ID
 * @param {string} date - Date string YYYY-MM-DD
 * @param {string} planId - Current plan ID (to identify self)
 * @returns {boolean} true if first trip (charges apply), false if subsequent trip
 */
function isFirstTripForTruckOnDay(camionId, date, planId) {
    if (!camionId || !date) return true;
    // Find all plans for same truck on same day, sorted by creation time
    const sameTruckSameDay = cache
        .filter(p => p.camionId === camionId && p.date === date && p.statut !== 'annule')
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    // If this plan is the first one (or the only one), charges apply
    return sameTruckSameDay.length === 0 || sameTruckSameDay[0].id === planId;
}

// ==================== ERP DOCUMENT CREATION ====================

/**
 * Create a Devis Client from a planification
 * @param {Object} plan - The plan object
 * @param {string} [finalStatut='Brouillon'] - Status to set ('Accepté' when called from terminé)
 */
async function createDevisFromPlan(plan, finalStatut = 'Brouillon') {
    if (!plan.clientId || !plan.prixLivraison || plan.prixLivraison <= 0) return null;
    const ts = Date.now();
    const dvNumero = await getNextNumber('DV');
    const tauxTVA = plan.tauxTVA || 0;
    const montantHT = plan.prixLivraison;
    const montantTVA = montantHT * tauxTVA / 100;
    const montantTTC = montantHT + montantTVA;
    const devis = {
        id: `dv_plan_${ts}`,
        numero: dvNumero,
        date: plan.date,
        clientId: plan.clientId,
        statut: finalStatut,
        lignes: [{
            articleId: null,
            designation: `Transport → ${plan.destination || 'N/A'}`,
            quantite: 1,
            prixUnitaire: plan.prixLivraison
        }],
        tauxTVA: tauxTVA,
        montantHT: montantHT,
        montantTVA: montantTVA,
        montantTotal: montantTTC,
        montantTTC: montantTTC,
        source: 'planification',
        planificationId: plan.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    try {
        await setDoc(doc(db, COLLECTIONS.devisClients, devis.id), devis);
        plan.devisId = devis.id;
        plan.devisNumero = devis.numero;
        console.log(`📋 Devis ${devis.numero} créé depuis planification ${plan.id}`);
        return devis;
    } catch (err) {
        console.error('Erreur création devis depuis planification:', err);
        return null;
    }
}

/**
 * Create a BC Client from the linked Devis
 * @param {Object} plan - The plan object
 * @param {string} [finalStatut='En cours'] - Status to set ('Livré' when called from terminé)
 */
async function createBCFromPlan(plan, finalStatut = 'En cours') {
    if (!plan.devisId || plan.bcId) return null; // Already has BC or no devis
    try {
        // Fetch the linked Devis
        const devisSnap = await getDoc(doc(db, COLLECTIONS.devisClients, plan.devisId));
        if (!devisSnap.exists()) { console.warn('Devis introuvable:', plan.devisId); return null; }
        const devis = { id: devisSnap.id, ...devisSnap.data() };

        const ts = Date.now();
        const lignes = (devis.lignes || []).map(l => ({
            designation: l.designation,
            nom: l.designation,
            quantite: l.quantite || 1,
            prixUnitaire: l.prixUnitaire || 0,
            articleId: l.articleId || null,
            prixTotal: (l.quantite || 1) * (l.prixUnitaire || 0)
        }));

        const bcNumero = await getNextNumber('BCV');
        const bcData = {
            id: `bcv_plan_${ts}`,
            numero: bcNumero,
            date: plan.date || new Date().toISOString().split('T')[0],
            clientId: plan.clientId,
            devisId: devis.id,
            devisNumero: devis.numero,
            lignes: lignes,
            montantTotal: lignes.reduce((s, l) => s + l.prixTotal, 0),
            statut: finalStatut,
            type: 'vente',
            source: 'planification',
            planificationId: plan.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, COLLECTIONS.bonCommandesVente, bcData.id), bcData);

        // Update Devis status to Accepté + add backlink
        devis.statut = 'Accepté';
        devis.bcId = bcData.id;
        devis.bcNumero = bcData.numero;
        await setDoc(doc(db, COLLECTIONS.devisClients, devis.id), devis);

        // Store BC reference on plan
        plan.bcId = bcData.id;
        plan.bcNumero = bcData.numero;
        console.log(`📦 BC ${bcData.numero} créé depuis planification ${plan.id}`);
        return bcData;
    } catch (err) {
        console.error('Erreur création BC depuis planification:', err);
        return null;
    }
}

/**
 * Create a BL Client from the linked BC when status becomes terminé
 */
async function createBLFromPlan(plan) {
    if (!plan.bcId || plan.blId) return null; // Already has BL or no BC
    try {
        // Fetch the linked BC
        const bcSnap = await getDoc(doc(db, COLLECTIONS.bonCommandesVente, plan.bcId));
        if (!bcSnap.exists()) { console.warn('BC introuvable:', plan.bcId); return null; }
        const bc = { id: bcSnap.id, ...bcSnap.data() };

        const ts = Date.now();
        const lignes = (bc.lignes || []).map(l => ({
            nom: l.designation || l.nom || '',
            articleId: l.articleId || null,
            prixUnitaire: l.prixUnitaire || 0,
            quantiteCommandee: l.quantite || 0,
            quantiteLivree: l.quantite || 0,
            prixTotal: (l.quantite || 0) * (l.prixUnitaire || 0)
        }));

        const blNumero = await getNextNumber('BLV');
        const blData = {
            id: `blv_plan_${ts}`,
            numero: blNumero,
            date: plan.date || new Date().toISOString().split('T')[0],
            commandeId: bc.id,
            commandeNumero: bc.numero,
            clientId: plan.clientId,
            camionId: plan.camionId || null,
            chauffeurId: plan.chauffeurId || null,
            lignes: lignes,
            montantTotal: lignes.reduce((s, l) => s + l.prixTotal, 0),
            statut: 'Livré',
            source: 'planification',
            planificationId: plan.id,
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, COLLECTIONS.bonLivraisonsVente, blData.id), blData);

        // Update BC status to Livré
        bc.statut = 'Livré';
        bc.updatedAt = new Date().toISOString();
        await setDoc(doc(db, COLLECTIONS.bonCommandesVente, bc.id), bc);

        // Store BL reference on plan
        plan.blId = blData.id;
        plan.blNumero = blData.numero;
        console.log(`🚚 BL ${blData.numero} créé depuis planification ${plan.id}`);
        return blData;
    } catch (err) {
        console.error('Erreur création BL depuis planification:', err);
        return null;
    }
}

async function getPlannings() {
    if (!_loaded) await loadPlannings();
    return cache;
}

function getPlanningById(id) {
    return cache.find(p => p.id === id);
}

function getPlanningsByDate(dateStr) {
    return cache.filter(p => p.date === dateStr);
}

async function renderPlannings(selectedDate) {
    const tbody = document.getElementById('planningBody');
    if (!tbody) return;

    // Apply filters
    const filterDateStart = document.getElementById('planDateStart')?.value;
    const filterDateEnd = document.getElementById('planDateEnd')?.value;
    const filterClient = document.getElementById('planClientFilter')?.value;
    const filterStatus = document.getElementById('planStatusFilter')?.value;

    let plannings = [...cache].sort((a, b) => {
        // Sort by date+time desc
        const dtA = (a.date || '') + (a.heure || '00:00');
        const dtB = (b.date || '') + (b.heure || '00:00');
        return dtB.localeCompare(dtA);
    });

    // Chauffeur data scope
    const cu = window.currentUser;
    if (cu?.driverId) {
        plannings = plannings.filter(p => p.chauffeurId === cu.driverId);
    }

    // Apply filters
    if (filterDateStart) plannings = plannings.filter(p => p.date >= filterDateStart);
    if (filterDateEnd) plannings = plannings.filter(p => p.date <= filterDateEnd);
    if (filterClient) plannings = plannings.filter(p => p.clientId === filterClient);
    if (filterStatus) plannings = plannings.filter(p => p.statut === filterStatus);

    // Stats
    const statsEl = document.getElementById('planningStats');
    if (statsEl) {
        const total = plannings.length;
        const planifie = plannings.filter(p => p.statut === 'planifie').length;
        const chargement = plannings.filter(p => p.statut === 'en_cours_chargement').length;
        const enRoute = plannings.filter(p => p.statut === 'en_route' || p.statut === 'en_cours').length;
        const attente = plannings.filter(p => p.statut === 'attente_confirmation').length;
        const termine = plannings.filter(p => p.statut === 'termine').length;
        statsEl.innerHTML = `<span>📊 ${total} total</span> <span style="color:#f59e0b">📅 ${planifie} planifié</span> ${chargement ? `<span style="color:#f97316">📦 ${chargement} chargement</span>` : ''} <span style="color:#3b82f6">🚛 ${enRoute} en route</span> ${attente ? `<span style="color:#f97316">⏳ ${attente} en attente</span>` : ''} <span style="color:#10b981">✅ ${termine} terminé</span>`;
    }

    if (plannings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#64748b;padding:40px;">Aucune planification trouvée.</td></tr>';
        return;
    }

    const clients = await ClientsModule.getClients();
    const trucks = await DataModule.getTrucks();
    const drivers = await DataModule.getDrivers();

    tbody.innerHTML = plannings.map(plan => {
        const client = plan.clientId ? clients.find(c => c.id === plan.clientId) : null;
        const truck = plan.camionId ? trucks.find(t => t.id === plan.camionId) : null;
        const driver = plan.chauffeurId ? drivers.find(d => d.id === plan.chauffeurId) : null;

        const origineShort = plan.origineDelegation || plan.origineGouvernorat || '-';
        const destShort = client
            ? `${client.nom} (${plan.delegation || plan.gouvernorat || ''})`
            : (plan.delegation || plan.gouvernorat || '-');
        const trajetDisplay = `${origineShort} ↔ ${destShort}`;

        const statusClass = {
            'planifie': 'status-warning',
            'en_cours_chargement': 'status-orange',
            'en_cours': 'status-info',
            'en_route': 'status-info',
            'attente_confirmation': 'status-orange',
            'termine': 'status-success',
            'annule': 'status-danger'
        }[plan.statut] || 'status-default';

        const statusLabel = {
            'planifie': 'Planifié',
            'en_cours_chargement': '📦 Chargement',
            'en_cours': '🚛 En route',
            'en_route': '🚛 En route',
            'attente_confirmation': '⏳ Attente confirmation',
            'termine': 'Terminé',
            'annule': 'Annulé'
        }[plan.statut] || plan.statut || 'Planifié';

        // Charges: truck fixed + maintenance only on FIRST trip of truck per day
        const isFirst = isFirstTripForTruckOnDay(plan.camionId, plan.date, plan.id);
        const truckCharges = (truck && isFirst) ? ((truck.chargesFixes || 0) + (truck.montantAssurance || 0) + (truck.montantTaxe || 0) + (truck.chargePersonnel || 0) + (truck.fraisLeasing || 0)) : 0;
        const maintenanceCost = isFirst ? (plan.maintenance || 0) : 0;
        const prixLivraisonTTC = plan.prixLivraisonTTC || plan.prixLivraison || 0;
        const coutTotal = (plan.montantGasoil || 0) + maintenanceCost + truckCharges;
        const resultat = prixLivraisonTTC - coutTotal;
        const resultClass = resultat >= 0 ? 'result-positive' : 'result-negative';

        const heureDisplay = plan.heure ? ` <span style="color:#8b5cf6;font-weight:600">${plan.heure}</span>` : '';

        return `<tr>
            <td>${formatDate(plan.date)}${heureDisplay}</td>
            <td><strong>${client?.nom || '-'}</strong></td>
            <td>${truck?.matricule || '-'}</td>
            <td>${driver?.nom || '-'}</td>
            <td>${trajetDisplay}</td>
            <td>${plan.kilometrage || 0} km</td>
            <td>${plan.quantiteGasoil || 0} L</td>
            <td>${coutTotal.toLocaleString('fr-FR')} TND</td>
            <td>${prixLivraisonTTC.toLocaleString('fr-FR')} TND${plan.tauxTVA ? ' <small style="color:#f59e0b">(' + plan.tauxTVA + '% TVA)</small>' : ''}</td>
            <td class="${resultClass}">${resultat.toLocaleString('fr-FR')} TND</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>
                ${plan.statut === 'en_cours_chargement' ? `
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;font-weight:600;padding:4px 10px;border-radius:6px" 
                    onclick="PlanificationModule.confirmStatusChange('${plan.id}','en_route')" title="Confirmer en route (photos requises)">
                    🚛 En route
                </button>
                ` : ''}
                ${plan.statut === 'en_cours' || plan.statut === 'en_route' ? `
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;font-weight:600;padding:4px 10px;border-radius:6px" 
                    onclick="PlanificationModule.confirmStatusChange('${plan.id}','attente_confirmation')" title="Marquer arrivé (photos requises)">
                    ⏳ Arrivé
                </button>
                ` : ''}
                ${plan.statut === 'attente_confirmation' ? `
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;font-weight:600;padding:4px 10px;border-radius:6px" 
                    onclick="PlanificationModule.confirmTermine('${plan.id}')" title="Confirmer terminé">
                    ✅ Confirmer
                </button>
                ` : ''}
                ${(plan.startPhotos || plan.endPhotos) ? `
                <button class="btn btn-sm btn-outline" onclick="TripPhotosModule.showTripPhotos('${plan.id}')" title="Voir photos"
                    style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3)">
                    📷 <span style="font-size:10px;color:#a78bfa">${plan.startPhotos && plan.endPhotos ? '2/2' : '1/2'}</span>
                </button>
                ` : ''}
                ${!window.currentUser?.driverId ? `
                ${plan.clientId ? `<button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText(PlanificationModule.getTrackingUrl('${plan.id}')).then(()=>alert('Lien copié!'))" title="Copier lien suivi" style="color:#8b5cf6">📍</button>
                <button class="btn btn-sm btn-outline" onclick="PlanificationModule.sendTrackingWhatsApp(PlanificationModule.getPlanningById('${plan.id}'))" title="Envoyer WhatsApp" style="color:#25d366">💬</button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="PlanificationModule.edit('${plan.id}')" title="Modifier">✏️</button>
                <button class="btn btn-sm btn-outline" onclick="PlanificationModule.remove('${plan.id}')" title="Supprimer">🗑️</button>
                ` : ''}
            </td>
        </tr>`;
    }).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(heure) {
    return heure || '';
}

// ==================== MODAL ====================
async function openModal(planId = null) {
    await loadPlannings();
    const plan = planId ? getPlanningById(planId) : null;
    const trucks = await DataModule.getTrucks();
    const drivers = await DataModule.getDrivers();
    const clients = await ClientsModule.getClients();
    const settings = await DataModule.getSettings();
    const title = plan ? 'Modifier Planification' : 'Nouvelle Planification';

    const selectedDate = document.getElementById('selectedDate')?.value || new Date().toISOString().split('T')[0];

    const truckOptions = trucks.map(t =>
        `<option value="${t.id}" ${plan?.camionId === t.id ? 'selected' : ''}>${t.matricule} (${t.type || ''})</option>`
    ).join('');

    const driverOptions = drivers.map(d =>
        `<option value="${d.id}" ${plan?.chauffeurId === d.id ? 'selected' : ''}>${d.nom}</option>`
    ).join('');

    const clientOptions = clients.map(c =>
        `<option value="${c.id}" ${plan?.clientId === c.id ? 'selected' : ''}>${c.nom}</option>`
    ).join('');

    const gouvernorats = getGouvernorats();

    const origineGouvernoratOptions = gouvernorats.map(g =>
        `<option value="${g}" ${plan?.origineGouvernorat === g ? 'selected' : ''}>${g}</option>`
    ).join('');
    const origineDelegations = plan?.origineGouvernorat ? getDelegations(plan.origineGouvernorat) : [];
    const origineDelegationOptions = origineDelegations.map(d =>
        `<option value="${d}" ${plan?.origineDelegation === d ? 'selected' : ''}>${d}</option>`
    ).join('');

    const destGouvernoratOptions = gouvernorats.map(g =>
        `<option value="${g}" ${plan?.gouvernorat === g ? 'selected' : ''}>${g}</option>`
    ).join('');
    const destDelegations = plan?.gouvernorat ? getDelegations(plan.gouvernorat) : [];
    const destDelegationOptions = destDelegations.map(d =>
        `<option value="${d}" ${plan?.delegation === d ? 'selected' : ''}>${d}</option>`
    ).join('');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <form id="planForm">
            <input type="hidden" id="planId" value="${plan?.id || ''}">
            
            <div class="form-row">
                <div class="form-group">
                    <label for="planDate">📅 Date</label>
                    <input type="date" id="planDate" value="${plan?.date || selectedDate}" required>
                </div>
                <div class="form-group">
                    <label for="planHeure">🕐 Heure</label>
                    <input type="time" id="planHeure" value="${plan?.heure || '08:00'}">
                </div>
                <div class="form-group">
                    <label for="planStatut">📊 Statut</label>
                    <select id="planStatut">
                        <option value="planifie" ${plan?.statut === 'planifie' ? 'selected' : ''}>📅 Planifié</option>
                        <option value="en_cours_chargement" ${plan?.statut === 'en_cours_chargement' ? 'selected' : ''}>📦 En cours de chargement</option>
                        <option value="en_route" ${(plan?.statut === 'en_route' || plan?.statut === 'en_cours') ? 'selected' : ''}>🚛 En route</option>
                        <option value="attente_confirmation" ${plan?.statut === 'attente_confirmation' ? 'selected' : ''}>⏳ Attente confirmation</option>
                        <option value="termine" ${plan?.statut === 'termine' ? 'selected' : ''}>✅ Terminé</option>
                        <option value="annule" ${plan?.statut === 'annule' ? 'selected' : ''}>❌ Annulé</option>
                    </select>
                </div>
            </div>

            <!-- Origin Section -->
            <div style="background: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #10b981;">
                <h4 style="margin-bottom: 12px; color: #10b981;">🚀 Point de Départ</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="planOrigineGouvernorat">Gouvernorat</label>
                        <select id="planOrigineGouvernorat" required onchange="PlanificationModule.onOrigineGouvernoratChange()">
                            <option value="">-- Sélectionner --</option>
                            ${origineGouvernoratOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="planOrigineDelegation">Délégation</label>
                        <select id="planOrigineDelegation" required onchange="PlanificationModule.updateDistanceEstimate()">
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
                    <label for="planClient">👥 Client</label>
                    <select id="planClient" onchange="PlanificationModule.onClientChangeDestination()">
                        <option value="">-- Aucun client --</option>
                        ${clientOptions}
                    </select>
                    <div id="planClientLocInfo" style="font-size:12px;margin-top:6px"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="planGouvernorat">Gouvernorat *</label>
                        <select id="planGouvernorat" required onchange="PlanificationModule.onGouvernoratChange()">
                            <option value="">-- Sélectionner --</option>
                            ${destGouvernoratOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="planDelegation">Délégation *</label>
                        <select id="planDelegation" required onchange="PlanificationModule.updateDistanceEstimate()">
                            <option value="">-- Sélectionner gouvernorat --</option>
                            ${destDelegationOptions}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Trajectory & Distance Display -->
            <div style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="text-align: center; margin-bottom: 12px;">
                    <div id="planTrajectoryDisplay" style="color: #3b82f6; font-size: 1rem; margin-bottom: 8px;">
                        <span style="color: #10b981;">🚀 Départ</span> → 
                        <span style="color: #ef4444;">📍 Destination</span> → 
                        <span style="color: #10b981;">🚀 Retour</span>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center;">
                    <div>
                        <span style="color: #64748b; font-size: 0.75rem;">Distance Aller</span>
                        <div id="planDistanceAller" style="color: #10b981; font-size: 1.25rem; font-weight: bold;">0 km</div>
                    </div>
                    <div>
                        <span style="color: #64748b; font-size: 0.75rem;">Distance Retour</span>
                        <div id="planDistanceRetour" style="color: #ef4444; font-size: 1.25rem; font-weight: bold;">0 km</div>
                    </div>
                    <div>
                        <span style="color: #64748b; font-size: 0.75rem;">Total Aller-Retour</span>
                        <div id="planDistanceTotal" style="color: #3b82f6; font-size: 1.5rem; font-weight: bold;">0 km</div>
                    </div>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="planCamion">🚛 Camion</label>
                    <select id="planCamion" onchange="PlanificationModule.onTruckChange()">
                        <option value="">-- Sélectionner --</option>
                        ${truckOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="planChauffeur">👤 Chauffeur</label>
                    <select id="planChauffeur">
                        <option value="">-- Sélectionner --</option>
                        ${driverOptions}
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="planKm">🛣️ Kilométrage Estimé (km)</label>
                    <input type="number" id="planKm" value="${plan?.kilometrage || 0}" min="0">
                    <small style="color: #64748b;">Aller-retour calculé automatiquement</small>
                </div>
                <div class="form-group">
                    <label for="planGasoil">⛽ Quantité Gasoil Estimée (L)</label>
                    <input type="number" id="planGasoil" value="${plan?.quantiteGasoil || 0}" min="0" onchange="PlanificationModule.updateCalculations()">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="planPrixGasoil">Prix Gasoil (TND/L)</label>
                    <input type="number" id="planPrixGasoil" value="${plan?.prixGasoilLitre || settings?.defaultFuelPrice || 2}" min="0" step="0.1" onchange="PlanificationModule.updateCalculations()">
                </div>
                <div class="form-group">
                    <label for="planMaintenance">🔧 Maintenance (TND)</label>
                    <input type="number" id="planMaintenance" value="${plan?.maintenance || 0}" min="0" onchange="PlanificationModule.updateCalculations()">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="planPrixLivraison">💵 Prix Livraison HT (TND)</label>
                    <input type="number" id="planPrixLivraison" value="${plan?.prixLivraison || 0}" min="0" onchange="PlanificationModule.updateCalculations()">
                </div>
                <div class="form-group">
                    <label for="planTVA">🏷️ Taux TVA</label>
                    <select id="planTVA" onchange="PlanificationModule.updateCalculations()">
                        <option value="0" ${(!plan?.tauxTVA || plan?.tauxTVA === 0) ? 'selected' : ''}>0%</option>
                        <option value="7" ${plan?.tauxTVA === 7 ? 'selected' : ''}>7%</option>
                        <option value="19" ${plan?.tauxTVA === 19 ? 'selected' : ''}>19%</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="planRemarques">📝 Remarques</label>
                    <input type="text" id="planRemarques" value="${plan?.remarques || ''}" placeholder="Notes, instructions...">
                </div>
            </div>

            <div style="background: rgba(139, 92, 246, 0.1); border-radius: 8px; padding: 16px; margin-top: 16px;">
                <h4 style="margin-bottom: 12px; color: #8b5cf6;">💰 Estimations Automatiques</h4>
                <div class="form-row">
                    <div class="form-group readonly">
                        <label>Montant Gasoil</label>
                        <input type="text" id="planCalcGasoil" value="0 TND" readonly>
                    </div>
                    <div class="form-group readonly">
                        <label>Coût Total Estimé</label>
                        <input type="text" id="planCalcCout" value="0 TND" readonly>
                    </div>
                </div>
                <div class="form-group readonly">
                    <label>Montant TVA</label>
                    <input type="text" id="planCalcTVA" value="0 TND" readonly>
                </div>
                <div class="form-group readonly">
                    <label>Total TTC (Livraison)</label>
                    <input type="text" id="planCalcTTC" value="0 TND" readonly style="font-weight: 600; color: #8b5cf6;">
                </div>
                <div class="form-group readonly">
                    <label>Résultat Estimé (TTC - Coût)</label>
                    <input type="text" id="planCalcResultat" value="0 TND" readonly style="font-weight: bold; font-size: 1.1rem;">
                </div>
            </div>
        </form>
    `;

    document.getElementById('modalSave').onclick = savePlan;
    App.showModal();

    // Initialize calculations
    updateDistanceEstimate();
    updateCalculations();

    // Re-sync after a short delay to ensure delegation selects have rendered with correct values
    setTimeout(() => {
        updateDistanceEstimate();
        updateCalculations();
    }, 100);
}

// ==================== DELEGATION CHANGES ====================
function onOrigineGouvernoratChange() {
    const gouvernorat = document.getElementById('planOrigineGouvernorat').value;
    const delegationSelect = document.getElementById('planOrigineDelegation');

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
    const gouvernorat = document.getElementById('planGouvernorat').value;
    const delegationSelect = document.getElementById('planDelegation');

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
    const clientId = document.getElementById('planClient')?.value;
    const infoDiv = document.getElementById('planClientLocInfo');
    if (!clientId) {
        if (infoDiv) infoDiv.innerHTML = '';
        return;
    }
    const client = ClientsModule.getClientById(clientId);
    if (!client) return;

    // Show client info + button to use client's default location
    if (infoDiv) {
        const hasLoc = client.gouvernorat;
        const loc = client.delegation ? `${client.delegation}, ${client.gouvernorat}` : (client.gouvernorat || 'Non définie');
        infoDiv.innerHTML = hasLoc
            ? `<span style="color:#64748b">📍 Localisation: <strong>${loc}</strong></span>
               <button type="button" onclick="PlanificationModule.useClientLocation()" style="margin-left:8px;padding:3px 10px;border-radius:4px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;font-size:12px;cursor:pointer">Utiliser cette localisation</button>`
            : `<span style="color:#94a3b8">📍 Aucune localisation par défaut pour ce client</span>`;
    }
}

function useClientLocation() {
    const clientId = document.getElementById('planClient')?.value;
    if (!clientId) return;
    const client = ClientsModule.getClientById(clientId);
    if (!client?.gouvernorat) return;

    const gouvSel = document.getElementById('planGouvernorat');
    if (gouvSel) { gouvSel.value = client.gouvernorat; onGouvernoratChange(); }
    setTimeout(() => {
        if (client.delegation) {
            const delSel = document.getElementById('planDelegation');
            if (delSel) delSel.value = client.delegation;
        }
        updateDistanceEstimate();
        // Update info to show it was applied
        const infoDiv = document.getElementById('planClientLocInfo');
        if (infoDiv) {
            const loc = client.delegation ? `${client.delegation}, ${client.gouvernorat}` : client.gouvernorat;
            infoDiv.innerHTML = `<span style="color:#10b981">✅ Localisation appliquée: <strong>${loc}</strong></span>`;
        }
    }, 50);
}

function updateDistanceEstimate() {
    const origineGouv = document.getElementById('planOrigineGouvernorat')?.value;
    const origineDel = document.getElementById('planOrigineDelegation')?.value;
    const destGouv = document.getElementById('planGouvernorat')?.value || '';
    const destDel = document.getElementById('planDelegation')?.value || '';

    const destName = destDel || destGouv;

    if (origineGouv && destGouv) {
        const distanceAller = getDistanceEstimate(origineGouv, origineDel, destGouv, destDel);
        const distanceRetour = distanceAller;
        const distanceTotal = distanceAller * 2;

        const origName = origineDel || origineGouv;
        const trajDisplay = document.getElementById('planTrajectoryDisplay');
        if (trajDisplay) {
            trajDisplay.innerHTML = `
                <span style="color: #10b981;">🚀 ${origName}</span> → 
                <span style="color: #ef4444;">📍 ${destName}</span> → 
                <span style="color: #10b981;">🏠 ${origName}</span>
            `;
        }

        const allerDisplay = document.getElementById('planDistanceAller');
        const retourDisplay = document.getElementById('planDistanceRetour');
        const totalDisplay = document.getElementById('planDistanceTotal');
        const kmInput = document.getElementById('planKm');

        if (allerDisplay) allerDisplay.textContent = `${distanceAller} km`;
        if (retourDisplay) retourDisplay.textContent = `${distanceRetour} km`;
        if (totalDisplay) totalDisplay.textContent = `${distanceTotal} km`;
        if (kmInput) {
            kmInput.value = distanceTotal;
        }
    }
}

async function onTruckChange() {
    const truckId = document.getElementById('planCamion').value;
    if (truckId) {
        const drivers = await DataModule.getDrivers();
        const driver = drivers.find(d => d.camionId === truckId);
        if (driver) {
            document.getElementById('planChauffeur').value = driver.id;
        }
    }
    updateCalculations();
}

function updateCalculations() {
    const truckId = document.getElementById('planCamion')?.value;
    const truck = truckId ? DataModule.getTruckById(truckId) : null;
    const planId = document.getElementById('planId')?.value;
    const planDate = document.getElementById('planDate')?.value;

    const gasoil = parseFloat(document.getElementById('planGasoil')?.value) || 0;
    const prixGasoil = parseFloat(document.getElementById('planPrixGasoil')?.value) || 0;
    const maintenance = parseFloat(document.getElementById('planMaintenance')?.value) || 0;
    const prixLivraison = parseFloat(document.getElementById('planPrixLivraison')?.value) || 0;

    const montantGasoil = gasoil * prixGasoil;

    // Check if this is the first trip for this truck on this day
    const isFirst = isFirstTripForTruckOnDay(truckId, planDate, planId);
    let coutTotal = montantGasoil + (isFirst ? maintenance : 0);
    let chargesNote = '';

    if (truck && isFirst) {
        coutTotal += (truck.chargesFixes || 0) + (truck.montantAssurance || 0) + (truck.montantTaxe || 0) + (truck.chargePersonnel || 0) + (truck.fraisLeasing || 0);
    } else if (truck && !isFirst) {
        chargesNote = ' (charges camion déjà comptées)';
    }

    // TVA calculations
    const tauxTVA = parseInt(document.getElementById('planTVA')?.value) || 0;
    const montantTVA = prixLivraison * tauxTVA / 100;
    const prixTTC = prixLivraison + montantTVA;

    const resultat = prixTTC - coutTotal;

    const calcGasoil = document.getElementById('planCalcGasoil');
    const calcCout = document.getElementById('planCalcCout');
    const calcTVA = document.getElementById('planCalcTVA');
    const calcTTC = document.getElementById('planCalcTTC');
    const calcResultat = document.getElementById('planCalcResultat');

    if (calcGasoil) calcGasoil.value = `${montantGasoil.toLocaleString('fr-FR')} TND`;
    if (calcCout) calcCout.value = `${coutTotal.toLocaleString('fr-FR')} TND${chargesNote}`;
    if (calcTVA) calcTVA.value = `${montantTVA.toLocaleString('fr-FR')} TND (${tauxTVA}%)`;
    if (calcTTC) calcTTC.value = `${prixTTC.toLocaleString('fr-FR')} TND`;
    if (calcResultat) {
        calcResultat.value = `${resultat.toLocaleString('fr-FR')} TND`;
        calcResultat.style.color = resultat >= 0 ? '#10b981' : '#ef4444';
    }
}

// ==================== SAVE ====================
async function savePlan() {
    const origineGouvernorat = document.getElementById('planOrigineGouvernorat').value;
    const origineDelegation = document.getElementById('planOrigineDelegation').value;
    const gouvernorat = document.getElementById('planGouvernorat').value;
    const delegation = document.getElementById('planDelegation').value;
    const clientId = document.getElementById('planClient')?.value || '';

    // Calculate distance from gouvernorat/delegation
    const distanceAller = getDistanceEstimate(origineGouvernorat, origineDelegation, gouvernorat, delegation);
    const destLabel = delegation ? `${delegation}, ${gouvernorat}` : gouvernorat;
    const gasoil = parseFloat(document.getElementById('planGasoil')?.value) || 0;
    const prixGasoil = parseFloat(document.getElementById('planPrixGasoil')?.value) || 0;
    const montantGasoil = gasoil * prixGasoil;

    const planId = document.getElementById('planId').value;
    const newStatut = document.getElementById('planStatut').value || 'planifie';

    // Detect status transition: check previous status
    const existingPlan = planId ? getPlanningById(planId) : null;
    const previousStatut = existingPlan?.statut;
    const isNewPlan = !planId;
    const isNewTermine = (newStatut === 'termine' && previousStatut !== 'termine');
    const isNewEnRoute = ((newStatut === 'en_route' || newStatut === 'en_cours') && (previousStatut === 'planifie' || previousStatut === 'en_cours_chargement'));

    const tauxTVA = parseInt(document.getElementById('planTVA')?.value) || 0;
    const prixLivraisonHT = parseFloat(document.getElementById('planPrixLivraison').value) || 0;
    const montantTVA = prixLivraisonHT * tauxTVA / 100;
    const prixLivraisonTTC = prixLivraisonHT + montantTVA;

    const plan = {
        id: planId || `plan_${Date.now()}`,
        date: document.getElementById('planDate').value,
        heure: document.getElementById('planHeure')?.value || '',
        clientId: clientId,
        statut: newStatut,
        camionId: document.getElementById('planCamion').value,
        chauffeurId: document.getElementById('planChauffeur').value,
        origineGouvernorat,
        origineDelegation,
        origine: origineDelegation ? `${origineDelegation}, ${origineGouvernorat}` : origineGouvernorat,
        gouvernorat,
        delegation,
        destination: destLabel,
        kilometrage: parseInt(document.getElementById('planKm').value) || distanceAller * 2,
        distanceAller,
        quantiteGasoil: gasoil,
        prixGasoilLitre: prixGasoil,
        montantGasoil,
        maintenance: parseFloat(document.getElementById('planMaintenance').value) || 0,
        prixLivraison: prixLivraisonHT,
        tauxTVA: tauxTVA,
        montantTVA: montantTVA,
        prixLivraisonTTC: prixLivraisonTTC,
        remarques: document.getElementById('planRemarques').value,
        updatedAt: new Date().toISOString()
    };

    // Carry over ERP links from existing plan
    if (existingPlan) {
        if (existingPlan.devisId) { plan.devisId = existingPlan.devisId; plan.devisNumero = existingPlan.devisNumero; }
        if (existingPlan.bcId) { plan.bcId = existingPlan.bcId; plan.bcNumero = existingPlan.bcNumero; }
        if (existingPlan.blId) { plan.blId = existingPlan.blId; plan.blNumero = existingPlan.blNumero; }
    }

    if (!plan.date || !gouvernorat) {
        alert('La date et le gouvernorat de destination sont obligatoires');
        return;
    }

    try {
        // ========== ERP WORKFLOW: Auto-create sales documents ==========

        // 1) New plan with prixLivraison → create Devis Client
        if (isNewPlan && plan.prixLivraison > 0 && plan.clientId) {
            await createDevisFromPlan(plan);
        }

        // 2) Status → en_route → create BC from Devis
        if (isNewEnRoute && plan.devisId && !plan.bcId) {
            await createBCFromPlan(plan);
        }

        // 3) Status → terminé → ensure full chain: Devis → BC → BL, then convert to saisie
        if (isNewTermine) {
            // Auto-create Devis if missing (and plan has client + prix)
            // Set directly to 'Accepté' since plan is already terminé
            if (!plan.devisId && plan.clientId && plan.prixLivraison > 0) {
                console.log('📋 Terminé: Devis manquant, création automatique (Accepté)...');
                await createDevisFromPlan(plan, 'Accepté');
            }

            // Auto-create BC from Devis if missing
            // Set directly to 'Livré' since BL will be created immediately
            if (plan.devisId && !plan.bcId) {
                console.log('📦 Terminé: BC manquant, création automatique (Livré)...');
                await createBCFromPlan(plan, 'Livré');
            }

            // Create BL from BC
            if (plan.bcId && !plan.blId) {
                console.log('🚚 Terminé: Création BL...');
                await createBLFromPlan(plan);
            }

            // Convert to saisie journalière then DELETE from planification
            // Skip auto-saisie on Sundays
            if (isSunday(plan.date)) {
                console.log(`📅 Dimanche détecté — saisie non créée automatiquement pour ${plan.id}`);
                await setDoc(doc(db, COLLECTIONS.planifications, plan.id), plan);
                alert('⚠️ Dimanche détecté — la saisie journalière ne sera pas créée automatiquement.\nVous pouvez la convertir manuellement si nécessaire.');
            } else {
                await convertToEntry(plan);
                await deleteDoc(doc(db, COLLECTIONS.planifications, plan.id));
                console.log(`🗑️ Planification ${plan.id} supprimée après conversion`);
            }
        } else {
            await setDoc(doc(db, COLLECTIONS.planifications, plan.id), plan);
        }

        // ========== PUSH MOBILE NOTIFICATIONS ==========
        console.log('📱 Notification check: chauffeurId=', plan.chauffeurId, 'isNewPlan=', isNewPlan, 'isNewEnRoute=', isNewEnRoute);
        if (plan.chauffeurId) {
            try {
                const notifRef = dbRef(rtdb, `notifications/${plan.chauffeurId}`);
                const notifType = isNewPlan ? 'planifie' : (isNewEnRoute ? 'en_route' : 'update');
                const notifMsg = isNewPlan
                    ? `Nouveau voyage planifié vers ${plan.destination || 'destination'}`
                    : isNewEnRoute
                        ? `Votre voyage vers ${plan.destination || 'destination'} est maintenant en route`
                        : `Mise à jour du voyage vers ${plan.destination || 'destination'}`;

                await dbPush(notifRef, {
                    type: notifType,
                    planId: plan.id,
                    destination: plan.destination || '',
                    date: plan.date || '',
                    truck: plan.camionId || '',
                    message: notifMsg,
                    timestamp: Date.now()
                });
                console.log('✅ RTDB notification pushed to notifications/' + plan.chauffeurId);

                // Also send Expo push (works even when app is closed)
                notifyDriverTrip(plan.chauffeurId, notifType, plan)
                    .catch(e => console.warn('Expo push failed:', e));

            } catch (ne) { console.warn('❌ Notif push error:', ne); }
        }

        // ========== WHATSAPP TRACKING LINK ==========
        if (isNewPlan && plan.clientId) {
            try {
                await sendTrackingWhatsApp(plan);
            } catch (we) { console.warn('❌ WhatsApp error:', we); }
        }

        App.hideModal();
        await loadPlannings();
        await renderPlannings();
    } catch (error) {
        console.error('Error saving plan:', error);
        alert('Erreur lors de l\'enregistrement: ' + error.message);
    }
}

/** Convert a terminé planification into a saisie journalière (entry) */
async function convertToEntry(plan) {
    // ===== REMOVE IDLE_DAY ENTRY IF EXISTS FOR THIS TRUCK+DATE =====
    const allDateEntries = DataModule.getEntriesByDate(plan.date);
    const idleEntry = allDateEntries.find(e =>
        e.camionId === plan.camionId && e.source === 'idle_day'
    );
    if (idleEntry) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.entries, idleEntry.id));
            console.log(`🧹 Removed idle_day entry ${idleEntry.id} (replaced by planification trip)`);
        } catch (err) {
            console.warn('Could not remove idle entry:', err);
        }
    }

    // ===== DUPLICATE TRIP DETECTION =====
    const existingEntries = DataModule.getEntriesByDate(plan.date);
    const duplicate = existingEntries.find(e =>
        e.camionId === plan.camionId && e.chauffeurId === plan.chauffeurId && e.source !== 'idle_day'
    );

    if (duplicate) {
        const truck = DataModule.getTruckById(plan.camionId);
        const driver = DataModule.getDriverById(plan.chauffeurId);
        const truckLabel = truck?.matricule || plan.camionId;
        const driverLabel = driver?.nom || plan.chauffeurId;

        const addAnyway = confirm(
            `⚠️ Voyage doublon détecté !\n\n` +
            `Le chauffeur ${driverLabel} avec le camion ${truckLabel} a déjà un voyage\n` +
            `le ${plan.date} (${duplicate.destination || duplicate.gouvernorat || '-'}).\n\n` +
            `Voulez-vous quand même ajouter ce nouveau voyage ?`
        );

        if (!addAnyway) {
            console.log(`⏭️ Conversion annulée (doublon): ${plan.id}`);
            const msg = `⏭️ Conversion annulée — voyage doublon détecté pour ${truckLabel} le ${plan.date}`;
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(msg);
            }
            return;
        }
    }

    // ===== CHECK IF CHARGES ALREADY COUNTED FOR THIS TRUCK TODAY =====
    const isFirst = isFirstTripForTruckOnDay(plan.camionId, plan.date, plan.id);
    // Reuse existingEntries from duplicate detection above
    const truckAlreadyHasEntry = existingEntries.some(e => e.camionId === plan.camionId);
    const applyCharges = isFirst && !truckAlreadyHasEntry;

    // ===== BUILD ENTRY WITH PHOTOS =====
    const truck = plan.camionId ? DataModule.getTruckById(plan.camionId) : null;
    const driver = plan.chauffeurId ? DataModule.getDriverById(plan.chauffeurId) : null;

    const entry = {
        date: plan.date || '',
        camionId: plan.camionId || '',
        chauffeurId: plan.chauffeurId || '',
        matricule: truck?.matricule || plan.camionId || '',
        chauffeur: driver?.nom || plan.chauffeurId || '',
        clientId: plan.clientId || null,
        origineGouvernorat: plan.origineGouvernorat || '',
        origineDelegation: plan.origineDelegation || '',
        origine: plan.origine || '',
        gouvernorat: plan.gouvernorat || '',
        delegation: plan.delegation || '',
        destination: plan.destination || '',
        distanceAller: plan.distanceAller || 0,
        distanceRetour: plan.distanceAller || 0,
        kilometrage: plan.kilometrage || 0,
        quantiteGasoil: plan.quantiteGasoil || 0,
        prixGasoilLitre: plan.prixGasoilLitre || 0,
        montantGasoil: (plan.quantiteGasoil || 0) * (plan.prixGasoilLitre || 0),
        maintenance: applyCharges ? (plan.maintenance || 0) : 0,
        prixLivraison: plan.prixLivraison || 0,
        tauxTVA: plan.tauxTVA || 0,
        montantTVA: plan.montantTVA || 0,
        prixLivraisonTTC: plan.prixLivraisonTTC || plan.prixLivraison || 0,
        remarques: (plan.remarques || '') + ` [Plan ${plan.id}]` + (!applyCharges ? ' [Charges déjà comptées]' : ''),
        source: 'planification',
        planificationId: plan.id,
        chargesApplied: applyCharges,
        // ===== CARRY TRIP PHOTOS =====
        startPhotos: plan.startPhotos || null,
        endPhotos: plan.endPhotos || null
    };

    try {
        await DataModule.saveEntry(entry);
        console.log(`✅ Planification ${plan.id} → saisie journalière créée (avec photos)`);
        // Notify user
        const msg = `✅ La planification a été transformée en saisie journalière (${plan.date})`;
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(msg);
        } else {
            alert(msg);
        }
    } catch (err) {
        console.error('Error converting planification to entry:', err);
        alert('⚠️ Planification sauvegardée mais erreur lors de la conversion en saisie: ' + err.message);
    }
}

// ==================== EDIT & DELETE ====================
function edit(id) {
    openModal(id);
}

async function remove(id) {
    if (confirm('Supprimer cette planification ?')) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.planifications, id));
            await loadPlannings();
            await renderPlannings();
        } catch (error) {
            console.error('Error deleting plan:', error);
        }
    }
}

/**
 * Admin confirms a trip as terminé
 * Shows photos first, then triggers BL creation + entry conversion
 */
async function confirmTermine(planId) {
    const plan = getPlanningById(planId);
    if (!plan || plan.statut !== 'attente_confirmation') {
        alert('Cette planification n\'est pas en attente de confirmation.');
        return;
    }

    // Show photos for review first
    if (plan.startPhotos || plan.endPhotos) {
        TripPhotosModule.showTripPhotos(planId);
    }

    // Delay slightly so photo gallery opens first
    setTimeout(async () => {
        if (!confirm(`✅ Confirmer la fin du voyage vers ${plan.destination || '-'} ?\n\nCela créera automatiquement le BL et la saisie journalière.`)) {
            return;
        }

        try {
            plan.statut = 'termine';
            plan.updatedAt = new Date().toISOString();

            // Auto-create full document chain if missing
            if (!plan.devisId && plan.clientId && plan.prixLivraison > 0) {
                console.log('📋 ConfirmTerminé: Devis manquant, création automatique (Accepté)...');
                await createDevisFromPlan(plan, 'Accepté');
            }
            if (plan.devisId && !plan.bcId) {
                console.log('📦 ConfirmTerminé: BC manquant, création automatique (Livré)...');
                await createBCFromPlan(plan, 'Livré');
            }
            if (plan.bcId && !plan.blId) {
                console.log('🚚 ConfirmTerminé: Création BL...');
                await createBLFromPlan(plan);
            }

            // Convert to saisie journalière then DELETE from planification
            // Skip auto-saisie on Sundays
            if (isSunday(plan.date)) {
                console.log(`📅 Dimanche détecté — saisie non créée (confirmTerminé) pour ${plan.id}`);
                await setDoc(doc(db, COLLECTIONS.planifications, plan.id), plan);
                alert('⚠️ Dimanche détecté — la saisie journalière ne sera pas créée automatiquement.');
            } else {
                await convertToEntry(plan);
                await deleteDoc(doc(db, COLLECTIONS.planifications, plan.id));
                console.log(`✅ Planification ${plan.id} confirmée terminée par admin`);
            }

            // Push notification to driver
            if (plan.chauffeurId) {
                try {
                    const notifRef = dbRef(rtdb, `notifications/${plan.chauffeurId}`);
                    await dbPush(notifRef, {
                        type: 'termine',
                        planId: plan.id,
                        destination: plan.destination || '',
                        date: plan.date || '',
                        message: `✅ Votre voyage vers ${plan.destination || 'destination'} a été confirmé terminé par l'admin`,
                        timestamp: Date.now()
                    });
                } catch (ne) { console.warn('Notif push error:', ne); }
            }

            await loadPlannings();
            await renderPlannings();
        } catch (err) {
            console.error('Error confirming terminé:', err);
            alert('Erreur: ' + err.message);
        }
    }, 300);
}

/**
 * Admin confirms a status change (with photo review)
 * Used for: en_cours_chargement → en_route, en_route → attente_confirmation
 */
async function confirmStatusChange(planId, targetStatus) {
    const plan = getPlanningById(planId);
    if (!plan) { alert('Planification introuvable.'); return; }

    const statusLabels = {
        'en_route': '🚛 En route',
        'attente_confirmation': '⏳ Attente confirmation'
    };

    // Show photos for review
    if (plan.startPhotos || plan.endPhotos) {
        TripPhotosModule.showTripPhotos(planId);
    }

    setTimeout(async () => {
        const label = statusLabels[targetStatus] || targetStatus;
        if (!confirm(`Confirmer le changement de statut vers "${label}" ?\n\nAssurez-vous que les photos sont validées.`)) {
            return;
        }

        try {
            plan.statut = targetStatus;
            plan.updatedAt = new Date().toISOString();

            // If transitioning to en_route, create BC from Devis
            if (targetStatus === 'en_route' && plan.devisId && !plan.bcId) {
                await createBCFromPlan(plan);
            }

            await setDoc(doc(db, COLLECTIONS.planifications, plan.id), plan);
            console.log(`✅ Status ${plan.id} → ${targetStatus} confirmé par admin`);

            // Push notification to driver
            if (plan.chauffeurId) {
                try {
                    const notifRef = dbRef(rtdb, `notifications/${plan.chauffeurId}`);
                    await dbPush(notifRef, {
                        type: targetStatus,
                        planId: plan.id,
                        destination: plan.destination || '',
                        date: plan.date || '',
                        message: `Statut mis à jour: ${label} pour ${plan.destination || 'destination'}`,
                        timestamp: Date.now()
                    });
                } catch (ne) { console.warn('Notif push error:', ne); }
            }

            await loadPlannings();
            await renderPlannings();
        } catch (err) {
            console.error('Error changing status:', err);
            alert('Erreur: ' + err.message);
        }
    }, 300);
}

// ==================== EXPORT ====================
export const PlanificationModule = {
    init,
    refresh,
    getPlannings,
    getPlanningById,
    edit,
    remove,
    confirmTermine,
    onOrigineGouvernoratChange,
    onGouvernoratChange,
    updateDistanceEstimate,
    onTruckChange,
    updateCalculations,
    convertToEntry,
    onClientChangeDestination,
    useClientLocation,
    sendTrackingWhatsApp,
    getTrackingUrl,
    confirmStatusChange
};

window.PlanificationModule = PlanificationModule;
