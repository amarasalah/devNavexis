/**
 * VENTE LOCAL MODULE - FIREBASE VERSION
 * UI module for sales management: BL Client + Factures Client
 * Flow: BC Client → BL Client → Facture Client (with stock reduction)
 */

import { db, collection, doc, getDocs, getDoc, setDoc, deleteDoc, COLLECTIONS, getNextNumber } from './firebase.js';
import { ClientsModule } from './clients-firebase.js';
import { SalesOrdersModule } from './sales-orders-firebase.js';
import { CaisseModule } from './caisse-firebase.js';
import { ArticlesModule } from './articles-firebase.js';

// ========== CACHES ==========
let blVenteCache = [];
let factureVenteCache = [];
let devisClientCache = [];
let _blLoaded = false;
let _factureLoaded = false;
let currentPage = '';
let _devisArticles = [];

// ========== INIT ==========
function init() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.id === 'addBLClientBtn') {
            e.preventDefault();
            e.stopPropagation();
            openBLModal();
        } else if (btn && btn.id === 'addFactureClientBtn') {
            e.preventDefault();
            e.stopPropagation();
            openFactureModal();
        } else if (btn && btn.id === 'addDevisClientBtn') {
            e.preventDefault();
            e.stopPropagation();
            openDevisModal();
        } else if (btn && btn.id === 'addReglementClientBtn') {
            e.preventDefault();
            e.stopPropagation();
            openReglementClientModal();
        }
    });
}

function showPage(page) {
    currentPage = page;
    refreshCurrentPage();
}

async function refreshCurrentPage() {
    populateClientFilters();
    switch (currentPage) {
        case 'livraisons-clients': await renderBLs(); break;
        case 'factures-clients': await renderFactures(); break;
        case 'devis-clients': await renderDevisClients(); break;
        case 'reglements-clients': await renderReglementsClients(); break;
    }
}

// ==================== FILTERS ====================
async function populateClientFilters() {
    const clients = await ClientsModule.getClients();
    const opts = '<option value="">Tous</option>' + clients.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
    ['venteBLClient', 'venteFactClient'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

function applyVenteFilters(items, dateStartId, dateEndId, clientFilterId, statutId, statutField = 'statut') {
    const ds = document.getElementById(dateStartId)?.value;
    const de = document.getElementById(dateEndId)?.value;
    const c = document.getElementById(clientFilterId)?.value;
    const s = document.getElementById(statutId)?.value;
    let filtered = [...items];
    if (ds) filtered = filtered.filter(i => (i.date || '') >= ds);
    if (de) filtered = filtered.filter(i => (i.date || '') <= de);
    if (c) filtered = filtered.filter(i => i.clientId === c);
    if (s) {
        if (statutField === 'etat_paiement') {
            filtered = filtered.filter(i => {
                const montant = parseFloat(i.montantTotal) || 0;
                const paye = (i.echeances || []).filter(e => e.statut === 'Pay\u00e9').reduce((sum, e) => sum + (e.montant || 0), 0);
                if (s === 'paye') return i.etat === 'Pay\u00e9e' || paye >= montant;
                if (s === 'partiel') return paye > 0 && paye < montant;
                if (s === 'non_paye') return paye === 0;
                return true;
            });
        } else {
            filtered = filtered.filter(i => (i[statutField] || '') === s);
        }
    }
    return filtered;
}

async function filterBLs() { await renderBLs(); }
async function filterFacturesVente() { await renderFactures(); }

// ========== DATA LAYER: BL VENTE ==========
async function loadBLs() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.bonLivraisonsVente));
        blVenteCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _blLoaded = true;
        return blVenteCache;
    } catch (error) {
        console.error('Error loading BL vente:', error);
        return [];
    }
}

async function getBLs() {
    if (!_blLoaded) await loadBLs();
    return blVenteCache;
}

function getBLById(id) {
    return blVenteCache.find(bl => bl.id === id);
}

async function saveBL(bl) {
    const id = bl.id || `blv_${Date.now()}`;
    bl.id = id;
    bl.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.bonLivraisonsVente, id), bl);
    await loadBLs();
}

async function deleteBLData(id) {
    await deleteDoc(doc(db, COLLECTIONS.bonLivraisonsVente, id));
    await loadBLs();
}

// ========== DATA LAYER: FACTURES VENTE ==========
async function loadFactures() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.facturesVente));
        factureVenteCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _factureLoaded = true;
        return factureVenteCache;
    } catch (error) {
        console.error('Error loading factures vente:', error);
        return [];
    }
}

async function getFactures() {
    if (!_factureLoaded) await loadFactures();
    return factureVenteCache;
}

function getFactureById(id) {
    return factureVenteCache.find(f => f.id === id);
}

async function saveFactureData(facture) {
    const id = facture.id || `fv_${Date.now()}`;
    facture.id = id;
    facture.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.facturesVente, id), facture);
    await loadFactures();
}

async function deleteFactureData(id) {
    await deleteDoc(doc(db, COLLECTIONS.facturesVente, id));
    await loadFactures();
}

// ==================== BL CLIENT RENDER ====================
async function renderBLs() {
    await loadBLs();
    const bls = applyVenteFilters(blVenteCache, 'venteBLDateStart', 'venteBLDateEnd', 'venteBLClient', 'venteBLStatut');
    const tbody = document.getElementById('blClientsBody');
    if (!tbody) return;

    if (bls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px">Aucun bon de livraison client</td></tr>';
        return;
    }

    tbody.innerHTML = await Promise.all(bls.map(async (bl) => {
        const client = ClientsModule.getClientById(bl.clientId);
        const total = (bl.lignes || []).reduce((s, l) => s + (l.prixTotal || 0), 0);

        // Check for trip photos linked via planification
        let photoBtn = '';
        if (bl.planificationId || bl.source === 'planification') {
            try {
                const planRef = bl.planificationId || bl.id;
                let bcPhoto = null, blPhoto = null;

                // First: look in entries (plan was converted to entry with photos)
                const entriesSnap = await getDocs(collection(db, COLLECTIONS.entries));
                const matchingEntry = entriesSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .find(e => e.planificationId === planRef);

                if (matchingEntry) {
                    bcPhoto = matchingEntry.startPhotos?.document;
                    blPhoto = matchingEntry.endPhotos?.document;
                } else {
                    // Fallback: plan might still exist (not yet confirmed)
                    const planSnap = await getDoc(doc(db, COLLECTIONS.planifications, planRef)).catch(() => null);
                    const planData = planSnap?.exists?.() ? planSnap.data() : null;
                    bcPhoto = planData?.startPhotos?.document;
                    blPhoto = planData?.endPhotos?.document;
                }

                if (bcPhoto || blPhoto) {
                    photoBtn = `<button class="btn-icon" title="Voir BC/BL documents" onclick="VenteModule.showDocPhotos('${bcPhoto || ''}', '${blPhoto || ''}', '${bl.numero || bl.id}')" style="color:#a78bfa">📷</button>`;
                }
            } catch (e) { console.warn('Photo lookup error:', e); }
        }

        return `
            <tr>
                <td><strong>${bl.numero || bl.id}</strong></td>
                <td>${bl.date || '-'}</td>
                <td>${bl.commandeNumero || '-'}</td>
                <td>${client?.nom || '-'}</td>
                <td>${(bl.lignes || []).length} article(s)</td>
                <td><strong>${total.toFixed(3)} TND</strong></td>
                <td><span class="status-badge status-${(bl.statut || '').toLowerCase().replace(/\s/g, '-')}">${bl.statut || 'Livré'}</span></td>
                <td>
                    ${photoBtn}
                    <button class="btn-icon" onclick="VenteModule.editBL('${bl.id}')">✏️</button>
                    <button class="btn-icon" onclick="VenteModule.deleteBL('${bl.id}')">🗑️</button>
                </td>
            </tr>
        `;
    })).then(rows => rows.join(''));
}

// ==================== BL CLIENT MODAL ====================
async function openBLModal(blId = null) {
    const bl = blId ? getBLById(blId) : null;
    const orders = await SalesOrdersModule.getOrders();
    const activeOrders = orders.filter(o => o.statut === 'En cours' || o.statut === 'Validé' || o.statut === 'Confirmé' || o.id === bl?.commandeId);
    const clients = await ClientsModule.getClients();
    const { DataModule } = await import('./data-firebase.js');
    const trucks = await DataModule.getTrucks();
    const drivers = await DataModule.getDrivers();

    const cmdOpts = activeOrders.map(o => {
        const c = ClientsModule.getClientById(o.clientId);
        return `<option value="${o.id}" ${bl?.commandeId === o.id ? 'selected' : ''}>${o.numero || o.id} - ${c?.nom || ''} (${(o.montantTotal || o.totalTTC || 0).toFixed(3)} TND)</option>`;
    }).join('');

    const clientOpts = clients.map(c => `<option value="${c.id}" ${bl?.clientId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('');
    const truckOpts = trucks.map(t => `<option value="${t.id}" ${bl?.camionId === t.id ? 'selected' : ''}>${t.matricule} (${t.type || ''})</option>`).join('');
    const driverOpts = drivers.map(d => `<option value="${d.id}" ${bl?.chauffeurId === d.id ? 'selected' : ''}>${d.nom}</option>`).join('');

    const lignes = bl?.lignes || [];

    document.getElementById('modalTitle').textContent = bl ? 'Modifier BL Client' : 'Nouveau BL Client';
    document.getElementById('modalBody').innerHTML = `
        <form id="blClientForm">
            <input type="hidden" id="blClientId" value="${bl?.id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>BC Client source</label>
                    <select id="blClientCommandeId" onchange="VenteModule.onCommandeChangeBLClient()" ${bl ? 'disabled' : ''}>
                        <option value="">-- Aucun (saisie libre) --</option>
                        ${cmdOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>Date Livraison</label>
                    <input type="date" id="blClientDate" value="${bl?.date || new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>👥 Client *</label>
                    <select id="blClientClientId" required>
                        <option value="">-- Sélectionner --</option>
                        ${clientOpts}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>🚛 Camion</label>
                    <select id="blClientCamion" onchange="VenteModule.onTruckChangeBL()">
                        <option value="">-- Sélectionner --</option>
                        ${truckOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>👤 Chauffeur</label>
                    <select id="blClientChauffeur">
                        <option value="">-- Sélectionner --</option>
                        ${driverOpts}
                    </select>
                </div>
            </div>
            <div style="margin-top:16px">
                <label style="font-weight:600;margin-bottom:8px;display:block">📦 Articles à livrer</label>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                        <tr style="background:rgba(148,163,184,0.1)">
                            <th style="padding:8px;text-align:left">Article</th>
                            <th style="padding:8px;text-align:right;width:80px">Prix Unit.</th>
                            <th style="padding:8px;text-align:right;width:80px">Commandé</th>
                            <th style="padding:8px;text-align:right;width:100px">Qté livrée</th>
                            <th style="padding:8px;text-align:right;width:100px">Total</th>
                        </tr>
                    </thead>
                    <tbody id="blClientLignesBody">
                        ${lignes.map(l => `
                            <tr>
                                <td style="padding:6px;color:#f1f5f9">${l.nom}</td>
                                <td style="padding:6px;text-align:right;color:#94a3b8">${(l.prixUnitaire || 0).toFixed(3)}</td>
                                <td style="padding:6px;text-align:right;color:#94a3b8">${l.quantiteCommandee || 0}</td>
                                <td style="padding:4px"><input type="number" class="blc-qte" value="${l.quantiteLivree || 0}" min="0" max="${l.quantiteCommandee || 0}" onchange="VenteModule.recalcBLLigne(this)" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:13px"></td>
                                <td style="padding:6px;text-align:right;font-weight:600;color:#10b981" class="blc-total">${((l.quantiteLivree || 0) * (l.prixUnitaire || 0)).toFixed(3)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top:2px solid rgba(148,163,184,0.2)">
                            <td colspan="4" style="padding:8px;text-align:right;font-weight:700">Total:</td>
                            <td style="padding:8px;text-align:right;font-weight:700;font-size:15px;color:#10b981" id="blClientTotal">${lignes.reduce((s, l) => s + ((l.quantiteLivree || 0) * (l.prixUnitaire || 0)), 0).toFixed(3)} TND</td>
                        </tr>
                    </tfoot>
                </table>
                ${lignes.length === 0 ? '<div style="color:#64748b;padding:20px;text-align:center;font-size:13px">Sélectionnez un BC Client pour charger les articles</div>' : ''}
            </div>
        </form>
    `;
    document.getElementById('modalSave').onclick = saveBLForm;
    App.showModal();
}

async function onCommandeChangeBLClient() {
    const bcId = document.getElementById('blClientCommandeId')?.value;
    if (!bcId) return;
    const order = SalesOrdersModule.getOrderById(bcId);
    if (!order) return;

    // Fill client dropdown
    if (order.clientId) {
        document.getElementById('blClientClientId').value = order.clientId;
    }

    // Fill lignes from BC
    const lignes = order.lignes || [];
    const tbody = document.getElementById('blClientLignesBody');
    tbody.innerHTML = lignes.map(l => {
        return `
            <tr>
                <td style="padding:6px;color:#f1f5f9">${l.designation || l.nom || ''}</td>
                <td style="padding:6px;text-align:right;color:#94a3b8">${(l.prixUnitaire || l.prix || 0).toFixed(3)}</td>
                <td style="padding:6px;text-align:right;color:#94a3b8">${l.quantite || 0}</td>
                <td style="padding:4px"><input type="number" class="blc-qte" value="${l.quantite || 0}" min="0" max="${l.quantite || 0}" onchange="VenteModule.recalcBLLigne(this)" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:13px"></td>
                <td style="padding:6px;text-align:right;font-weight:600;color:#10b981" class="blc-total">${((l.quantite || 0) * (l.prixUnitaire || l.prix || 0)).toFixed(3)}</td>
            </tr>
        `;
    }).join('');
    recalcBLTotal();
}

async function onTruckChangeBL() {
    const truckId = document.getElementById('blClientCamion')?.value;
    if (truckId) {
        const { DataModule } = await import('./data-firebase.js');
        const drivers = await DataModule.getDrivers();
        const driver = drivers.find(d => d.camionId === truckId);
        if (driver) {
            document.getElementById('blClientChauffeur').value = driver.id;
        }
    }
}

function recalcBLLigne(input) {
    const row = input.closest('tr');
    const pu = parseFloat(row.querySelector('td:nth-child(2)').textContent) || 0;
    const qte = parseFloat(input.value) || 0;
    row.querySelector('.blc-total').textContent = (pu * qte).toFixed(3);
    recalcBLTotal();
}

function recalcBLTotal() {
    const totals = document.querySelectorAll('#blClientLignesBody .blc-total');
    let grand = 0;
    totals.forEach(t => grand += parseFloat(t.textContent) || 0);
    const el = document.getElementById('blClientTotal');
    if (el) el.textContent = grand.toFixed(3) + ' TND';
}

async function saveBLForm() {
    const bcId = document.getElementById('blClientCommandeId')?.value;
    const order = bcId ? SalesOrdersModule.getOrderById(bcId) : null;

    const rows = document.querySelectorAll('#blClientLignesBody tr');
    const lignes = Array.from(rows).map(row => {
        const nom = row.querySelector('td:first-child').textContent.trim();
        const prixUnitaire = parseFloat(row.querySelector('td:nth-child(2)').textContent) || 0;
        const quantiteCommandee = parseFloat(row.querySelector('td:nth-child(3)').textContent) || 0;
        const quantiteLivree = parseFloat(row.querySelector('.blc-qte')?.value) || 0;
        // Find articleId from order lignes
        const orderLine = (order?.lignes || []).find(l => (l.designation || l.nom) === nom);
        return {
            nom,
            articleId: orderLine?.articleId || null,
            prixUnitaire,
            quantiteCommandee,
            quantiteLivree,
            prixTotal: prixUnitaire * quantiteLivree
        };
    }).filter(l => l.quantiteLivree > 0);

    if (lignes.length === 0) { alert('Aucune quantité livrée'); return; }

    const clientId = document.getElementById('blClientClientId')?.value;
    if (!clientId) { alert('S\u00e9lectionnez un client'); return; }

    const bl = {
        id: document.getElementById('blClientId').value || null,
        numero: document.getElementById('blClientId').value ? getBLById(document.getElementById('blClientId').value)?.numero : await getNextNumber('BLV'),
        date: document.getElementById('blClientDate').value,
        commandeId: bcId || null,
        commandeNumero: order?.numero || '',
        clientId: clientId,
        camionId: document.getElementById('blClientCamion')?.value || null,
        chauffeurId: document.getElementById('blClientChauffeur')?.value || null,
        lignes: lignes,
        montantTotal: lignes.reduce((s, l) => s + l.prixTotal, 0),
        statut: 'Livr\u00e9'
    };

    try {
        await saveBL(bl);

        // R3/D4: Record stock movements (sortie) via InventaireModule
        try {
            const { InventaireModule } = await import('./inventory-firebase.js');
            const client = ClientsModule.getClientById(bl.clientId);
            await InventaireModule.recordBLMovements(lignes, 'sortie', {
                documentType: 'BL Vente',
                documentNumero: bl.numero,
                documentId: bl.id,
                tiersId: bl.clientId,
                tiersNom: client?.nom || '',
                date: bl.date
            });
        } catch (invErr) {
            console.warn('Inventory tracking error, falling back to manual:', invErr);
            for (const ligne of lignes) {
                let article = null;
                if (ligne.articleId) {
                    article = ArticlesModule.getArticleById(ligne.articleId);
                }
                if (!article && ligne.nom) {
                    const allArticles = await ArticlesModule.getArticles();
                    article = allArticles.find(a => a.designation === ligne.nom);
                }
                if (article) {
                    const newStock = Math.max(0, (article.stock || 0) - (ligne.quantiteLivree || 0));
                    await setDoc(doc(db, COLLECTIONS.articles, article.id), { ...article, stock: newStock });
                }
            }
        }
        await ArticlesModule.refresh();

        App.hideModal();
        await renderBLs();
    } catch (err) {
        console.error('Erreur sauvegarde BL Client:', err);
        alert('Erreur: ' + err.message);
    }
}

function editBL(id) { openBLModal(id); }
async function deleteBL(id) {
    if (confirm('Supprimer ce bon de livraison client?')) {
        await deleteBLData(id);
        await renderBLs();
    }
}

// ==================== FACTURES CLIENT RENDER ====================
async function renderFactures() {
    await loadFactures();
    await loadBLs();
    const factures = applyVenteFilters(factureVenteCache, 'venteFactDateStart', 'venteFactDateEnd', 'venteFactClient', 'venteFactStatut', 'etat_paiement');
    const tbody = document.getElementById('facturesClientsBody');
    if (!tbody) return;

    let totalNonPaye = 0;
    let totalPaye = 0;

    if (factures.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:30px">Aucune facture client</td></tr>';
    } else {
        tbody.innerHTML = factures.map(f => {
            const client = ClientsModule.getClientById(f.clientId);
            const montant = parseFloat(f.montantTotal) || 0;
            const echeances = f.echeances || [];
            const paye = echeances.filter(e => e.statut === 'Payé').reduce((s, e) => s + (e.montant || 0), 0);
            const restant = montant - paye;

            if (f.etat === 'Payée') totalPaye += montant;
            else totalNonPaye += restant;

            return `
                <tr>
                    <td><strong>${f.numero || f.id}</strong></td>
                    <td>${f.date || '-'}</td>
                    <td>${f.livraisonNumero || '-'}</td>
                    <td>${client?.nom || '-'}</td>
                    <td><strong>${montant.toFixed(3)} TND</strong></td>
                    <td>${paye.toFixed(3)} TND</td>
                    <td><span class="status-badge status-${(f.etat || '').toLowerCase().replace(/\s/g, '-').replace(/é/g, 'e')}">${f.etat || 'Non Payée'}</span></td>
                    <td>
                        <button class="btn-icon" onclick="VenteModule.editFacture('${f.id}')">✏️</button>
                        <button class="btn-icon" onclick="VenteModule.viewEcheancesClient('${f.id}')" title="Échéances">💰</button>
                        <button class="btn-icon" onclick="VenteModule.deleteFacture('${f.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    const kpiNonPaye = document.getElementById('totalNonPayeClient');
    const kpiPaye = document.getElementById('totalPayeClient');
    if (kpiNonPaye) kpiNonPaye.textContent = totalNonPaye.toFixed(3) + ' TND';
    if (kpiPaye) kpiPaye.textContent = totalPaye.toFixed(3) + ' TND';
}

// ==================== FACTURE CLIENT MODAL ====================
async function openFactureModal(factureId = null) {
    const facture = factureId ? getFactureById(factureId) : null;
    await loadBLs();
    const activeBLs = blVenteCache.filter(bl => bl.statut === 'Livré' || bl.id === facture?.livraisonId);

    const blOpts = activeBLs.map(bl => {
        const c = ClientsModule.getClientById(bl.clientId);
        return `<option value="${bl.id}" ${facture?.livraisonId === bl.id ? 'selected' : ''}>${bl.numero || bl.id} - ${c?.nom || ''} (${(bl.montantTotal || 0).toFixed(3)} TND)</option>`;
    }).join('');

    const echeances = facture?.echeances || [{ date: new Date().toISOString().split('T')[0], montant: 0, typePaiement: 'Virement', statut: 'En attente' }];

    document.getElementById('modalTitle').textContent = facture ? 'Modifier Facture Client' : 'Nouvelle Facture Client';
    document.getElementById('modalBody').innerHTML = `
        <form id="factureClientForm">
            <input type="hidden" id="factureClientId" value="${facture?.id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>BL Client source</label>
                    <select id="factureClientBLId" onchange="VenteModule.onBLChangeFactureClient()" ${facture ? 'disabled' : ''} required>
                        <option value="">-- Sélectionner un BL --</option>
                        ${blOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>Date Facture</label>
                    <input type="date" id="factureClientDate" value="${facture?.date || new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Client</label>
                    <input type="text" id="factureClientNom" value="${facture?.clientId ? ClientsModule.getClientById(facture.clientId)?.nom || '' : ''}" readonly style="background:rgba(15,23,42,0.2)">
                    <input type="hidden" id="factureClientClientId" value="${facture?.clientId || ''}">
                </div>
                <div class="form-group">
                    <label>Montant Total (TND)</label>
                    <input type="number" id="factureClientMontant" value="${facture?.montantTotal || ''}" step="0.001" required>
                </div>
            </div>
            <div style="margin-top:16px">
                <label style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
                    <span>💰 Échéances de paiement</span>
                    <button type="button" onclick="VenteModule.addEcheanceClient()" 
                        style="padding:4px 12px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px dashed #818cf8;border-radius:4px;cursor:pointer;font-size:11px">
                        ➕ Tranche
                    </button>
                </label>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                        <tr style="background:rgba(148,163,184,0.1)">
                            <th style="padding:8px;text-align:left">Date</th>
                            <th style="padding:8px;text-align:right;width:120px">Montant</th>
                            <th style="padding:8px;text-align:left;width:130px">Type</th>
                            <th style="padding:8px;text-align:left;width:110px">Statut</th>
                            <th style="padding:8px;width:40px"></th>
                        </tr>
                    </thead>
                    <tbody id="echeancesClientBody">
                        ${echeances.map((e, i) => renderEcheanceClientRow(i, e)).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top:2px solid rgba(148,163,184,0.2)">
                            <td style="padding:8px;font-weight:700">Total échéances:</td>
                            <td style="padding:8px;text-align:right;font-weight:700" id="echeancesClientTotalDisplay">0.000 TND</td>
                            <td colspan="3"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </form>
    `;
    recalcEcheancesClient();
    document.getElementById('modalSave').onclick = saveFactureForm;
    App.showModal();
}

function renderEcheanceClientRow(index, ech = {}) {
    const typeOptions = ['Virement', 'Versement', 'Traite', 'Chèque', 'Espèce'].map(t =>
        `<option value="${t}" ${ech.typePaiement === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    return `
        <tr data-ech="${index}">
            <td style="padding:4px"><input type="date" class="echc-date" value="${ech.date || ''}" style="padding:6px;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:12px;width:100%"></td>
            <td style="padding:4px"><input type="number" class="echc-montant" value="${ech.montant || 0}" step="0.001" onchange="VenteModule.recalcEcheancesClient()" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:13px"></td>
            <td style="padding:4px"><select class="echc-type" style="padding:6px;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:12px;width:100%">${typeOptions}</select></td>
            <td style="padding:4px"><select class="echc-statut" style="padding:6px;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:12px;width:100%">
                <option value="En attente" ${ech.statut === 'En attente' ? 'selected' : ''}>En attente</option>
                <option value="Payé" ${ech.statut === 'Payé' ? 'selected' : ''}>Payé</option>
            </select></td>
            <td style="padding:4px;text-align:center"><button type="button" onclick="VenteModule.removeEcheanceClient(this)" style="background:none;border:none;cursor:pointer;font-size:14px;color:#ef4444">🗑️</button></td>
        </tr>
    `;
}

function addEcheanceClient() {
    const tbody = document.getElementById('echeancesClientBody');
    if (!tbody) return;
    const index = tbody.children.length;
    tbody.insertAdjacentHTML('beforeend', renderEcheanceClientRow(index, { date: new Date().toISOString().split('T')[0], statut: 'En attente' }));
}

function removeEcheanceClient(btn) {
    btn.closest('tr').remove();
    recalcEcheancesClient();
}

function recalcEcheancesClient() {
    const amounts = document.querySelectorAll('#echeancesClientBody .echc-montant');
    let total = 0;
    amounts.forEach(a => total += parseFloat(a.value) || 0);
    const el = document.getElementById('echeancesClientTotalDisplay');
    if (el) el.textContent = total.toFixed(3) + ' TND';
}

function getEcheancesClientFromForm() {
    const rows = document.querySelectorAll('#echeancesClientBody tr');
    return Array.from(rows).map(row => ({
        date: row.querySelector('.echc-date')?.value || '',
        montant: parseFloat(row.querySelector('.echc-montant')?.value) || 0,
        typePaiement: row.querySelector('.echc-type')?.value || 'Virement',
        statut: row.querySelector('.echc-statut')?.value || 'En attente'
    }));
}

async function onBLChangeFactureClient() {
    const blId = document.getElementById('factureClientBLId')?.value;
    if (!blId) return;
    const bl = getBLById(blId);
    if (!bl) return;

    // Fill client
    const client = ClientsModule.getClientById(bl.clientId);
    document.getElementById('factureClientNom').value = client?.nom || '';
    document.getElementById('factureClientClientId').value = bl.clientId || '';

    // Auto-fill montant from BL total
    const montant = bl.montantTotal || (bl.lignes || []).reduce((s, l) => s + ((l.quantiteLivree || 0) * (l.prixUnitaire || 0)), 0);
    document.getElementById('factureClientMontant').value = montant.toFixed(3);
}

async function saveFactureForm() {
    const echeances = getEcheancesClientFromForm();
    const blId = document.getElementById('factureClientBLId')?.value;
    const bl = blId ? getBLById(blId) : null;
    const montant = parseFloat(document.getElementById('factureClientMontant').value) || 0;

    const paye = echeances.filter(e => e.statut === 'Payé').reduce((s, e) => s + e.montant, 0);
    let etat = 'Non Payée';
    if (paye >= montant && montant > 0) etat = 'Payée';
    else if (paye > 0) etat = 'Partiel';

    const facture = {
        id: document.getElementById('factureClientId').value || null,
        numero: document.getElementById('factureClientId').value ? getFactureById(document.getElementById('factureClientId').value)?.numero : await getNextNumber('FV'),
        date: document.getElementById('factureClientDate').value,
        livraisonId: blId || null,
        livraisonNumero: bl?.numero || '',
        clientId: document.getElementById('factureClientClientId').value,
        montantTotal: montant,
        echeances: echeances,
        etat: etat
    };

    try {
        // Create Caisse encaissements for newly paid échéances
        const existingFacture = facture.id ? getFactureById(facture.id) : null;
        const existingEcheances = existingFacture?.echeances || [];

        for (let i = 0; i < echeances.length; i++) {
            const ech = echeances[i];
            if (ech.statut === 'Payé' && !ech.caisseId) {
                // Check if this is a NEW paid échéance
                const wasAlreadyPaid = existingEcheances[i]?.statut === 'Payé' && existingEcheances[i]?.caisseId;
                if (!wasAlreadyPaid) {
                    const client = ClientsModule.getClientById(document.getElementById('factureClientClientId').value);
                    const caisseId = await CaisseModule.addAutoTransaction({
                        type: 'encaissement',
                        tiers: client?.nom || 'Client',
                        montant: ech.montant,
                        mode: ech.typePaiement,
                        reference: facture.numero,
                        notes: `Paiement ${facture.numero}`,
                        source: 'vente'
                    });
                    if (caisseId) ech.caisseId = caisseId;
                }
            }
        }
        facture.echeances = echeances;

        await saveFactureData(facture);

        // R5: Update client solde
        const clientId = document.getElementById('factureClientClientId').value;
        if (clientId) {
            await updateClientSolde(clientId);
        }

        App.hideModal();
        await renderFactures();
    } catch (err) {
        console.error('Erreur sauvegarde Facture Client:', err);
        alert('Erreur: ' + err.message);
    }
}

async function viewEcheancesClient(factureId) {
    const facture = getFactureById(factureId);
    if (!facture) return;
    const client = ClientsModule.getClientById(facture.clientId);
    const echeances = facture.echeances || [];
    const montant = facture.montantTotal || 0;
    const paye = echeances.filter(e => e.statut === 'Payé').reduce((s, e) => s + (e.montant || 0), 0);

    document.getElementById('modalTitle').textContent = `💰 Échéances - ${facture.numero}`;
    document.getElementById('modalBody').innerHTML = `
        <div style="margin-bottom:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
                <div style="text-align:center;padding:12px;background:rgba(241,245,249,0.05);border-radius:8px">
                    <div style="font-size:18px;font-weight:700;color:#f1f5f9">${montant.toFixed(3)} TND</div>
                    <div style="font-size:11px;color:#64748b">Montant Total</div>
                </div>
                <div style="text-align:center;padding:12px;background:rgba(16,185,129,0.1);border-radius:8px">
                    <div style="font-size:18px;font-weight:700;color:#10b981">${paye.toFixed(3)} TND</div>
                    <div style="font-size:11px;color:#64748b">Payé</div>
                </div>
                <div style="text-align:center;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px">
                    <div style="font-size:18px;font-weight:700;color:#ef4444">${(montant - paye).toFixed(3)} TND</div>
                    <div style="font-size:11px;color:#64748b">Restant</div>
                </div>
            </div>
            <div style="margin-top:8px;font-size:13px;color:#94a3b8">Client: <strong>${client?.nom || '-'}</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="background:rgba(148,163,184,0.1)">
                    <th style="padding:8px;text-align:left">Date</th>
                    <th style="padding:8px;text-align:right">Montant</th>
                    <th style="padding:8px;text-align:left">Type</th>
                    <th style="padding:8px;text-align:left">Statut</th>
                </tr>
            </thead>
            <tbody>
                ${echeances.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:20px">Aucune échéance</td></tr>' :
            echeances.map(e => `
                    <tr>
                        <td style="padding:8px">${e.date || '-'}</td>
                        <td style="padding:8px;text-align:right;font-weight:600">${(e.montant || 0).toFixed(3)} TND</td>
                        <td style="padding:8px">${e.typePaiement || '-'}</td>
                        <td style="padding:8px"><span class="status-badge status-${e.statut === 'Payé' ? 'paye' : 'en-attente'}">${e.statut}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('modalSave').style.display = 'none';
    App.showModal();
}

function editFacture(id) { openFactureModal(id); }
async function deleteFacture(id) {
    if (confirm('Supprimer cette facture client?')) {
        // Remove linked caisse transactions before deleting
        const facture = getFactureById(id);
        if (facture) {
            for (const ech of (facture.echeances || [])) {
                if (ech.caisseId) {
                    await CaisseModule.removeAutoTransaction(ech.caisseId);
                }
            }
        }
        await deleteFactureData(id);
        // Update client solde after deletion
        if (facture?.clientId) {
            await updateClientSolde(facture.clientId);
        }
        await renderFactures();
    }
}

// ==================== DEVIS CLIENTS ====================
async function loadDevisClients() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.devisClients));
        devisClientCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error loading devis clients:', err);
        devisClientCache = [];
    }
}

function getDevisById(id) { return devisClientCache.find(d => d.id === id); }

async function renderDevisClients() {
    await loadDevisClients();
    const clients = await ClientsModule.getClients();
    const container = document.getElementById('devisClientsContent') || document.querySelector('#page-devis-clients');
    if (!container) return;
    const content = container.querySelector('.page-content') || container;

    const statusColors = { 'Brouillon': '#94a3b8', 'Envoyé': '#f59e0b', 'Accepté': '#10b981', 'Refusé': '#ef4444' };

    content.innerHTML = `
        <div class="card" style="padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:1rem">📋 Devis / Offres Clients</h3>
                <button class="btn btn-primary" id="addDevisClientBtn">➕ Nouveau Devis</button>
            </div>
            <div style="overflow-x:auto">
                <table class="data-table" style="width:100%">
                    <thead>
                        <tr><th>N°</th><th>Date</th><th>Client</th><th>Montant</th><th>Statut</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${devisClientCache.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:30px">Aucun devis</td></tr>' :
            devisClientCache.map(d => {
                const cl = ClientsModule.getClientById(d.clientId);
                return `<tr>
                            <td><strong>${d.numero || d.id}</strong></td>
                            <td>${d.date || '-'}</td>
                            <td>${cl?.nom || '-'}</td>
                            <td><strong>${(d.montantTotal || 0).toFixed(3)} TND</strong></td>
                            <td><span style="padding:3px 8px;border-radius:4px;font-size:12px;font-weight:500;background:${statusColors[d.statut] || '#64748b'}22;color:${statusColors[d.statut] || '#64748b'}">${d.statut || 'Brouillon'}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="VenteModule.editDevis('${d.id}')">✏️</button>
                                ${d.statut === 'Accepté' ? `<button class="btn btn-sm btn-outline" onclick="VenteModule.transformDevisToBC('${d.id}')" title="Transformer en BC">📄→</button>` : ''}
                                <button class="btn btn-sm btn-outline" onclick="VenteModule.deleteDevis('${d.id}')">🗑️</button>
                            </td>
                        </tr>`;
            }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function openDevisModal(devisId = null) {
    const devis = devisId ? getDevisById(devisId) : null;
    const clients = await ClientsModule.getClients();
    _devisArticles = ArticlesModule.getArticlesByType('vente');

    const clientOpts = clients.map(c => `<option value="${c.id}" ${devis?.clientId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('');
    const lignes = devis?.lignes || [{ articleId: '', designation: '', quantite: 1, prixUnitaire: 0 }];

    document.getElementById('modalTitle').textContent = devis ? 'Modifier Devis' : 'Nouveau Devis Client';
    document.getElementById('modalBody').innerHTML = `
        <form id="devisForm">
            <input type="hidden" id="devisId" value="${devis?.id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>Client *</label>
                    <select id="devisClientId" required>
                        <option value="">-- Sélectionner --</option>
                        ${clientOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" id="devisDate" value="${devis?.date || new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Statut</label>
                    <select id="devisStatut">
                        ${['Brouillon', 'Envoyé', 'Accepté', 'Refusé'].map(s => `<option value="${s}" ${devis?.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>N° Devis</label>
                    <input type="text" id="devisNumero" value="${devis?.numero || ''}" placeholder="Auto-généré">
                </div>
            </div>
            <div style="margin-top:16px">
                <label style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
                    <span>📦 Lignes du devis</span>
                    <button type="button" onclick="VenteModule.addDevisLigne()" style="padding:4px 12px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px dashed #818cf8;border-radius:4px;cursor:pointer;font-size:11px">➕ Ligne</button>
                </label>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                        <tr style="background:rgba(148,163,184,0.1)">
                            <th style="padding:8px;text-align:left">Désignation</th>
                            <th style="padding:8px;text-align:right;width:80px">Qté</th>
                            <th style="padding:8px;text-align:right;width:100px">P.U.</th>
                            <th style="padding:8px;text-align:right;width:100px">Total</th>
                            <th style="padding:8px;width:40px"></th>
                        </tr>
                    </thead>
                    <tbody id="devisLignesBody">
                        ${lignes.map((l, i) => renderDevisLigneRow(i, l)).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top:2px solid rgba(148,163,184,0.2)">
                            <td colspan="3" style="padding:8px;font-weight:700;text-align:right">Total HT:</td>
                            <td style="padding:8px;text-align:right;font-weight:700" id="devisTotalHT">0.000 TND</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding:8px;text-align:right">TVA:</td>
                            <td style="padding:8px;text-align:right">
                                <select id="devisTVA" onchange="VenteModule.recalcDevisTotal()" style="width:70px;padding:2px 4px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);background:rgba(30,41,59,0.8);color:#e2e8f0">
                                    <option value="0" ${(!devis?.tauxTVA || devis?.tauxTVA === 0) ? 'selected' : ''}>0%</option>
                                    <option value="7" ${devis?.tauxTVA === 7 ? 'selected' : ''}>7%</option>
                                    <option value="19" ${devis?.tauxTVA === 19 ? 'selected' : ''}>19%</option>
                                </select>
                            </td>
                            <td style="padding:8px;text-align:right;font-weight:600;color:#f59e0b" id="devisTotalTVA">0.000 TND</td>
                            <td></td>
                        </tr>
                        <tr style="border-top:1px solid rgba(148,163,184,0.2)">
                            <td colspan="3" style="padding:8px;font-weight:700;text-align:right;color:#8b5cf6">Total TTC:</td>
                            <td style="padding:8px;text-align:right;font-weight:700;color:#8b5cf6;font-size:15px" id="devisTotalTTC">0.000 TND</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </form>
    `;
    recalcDevisTotal();
    document.getElementById('modalSave').onclick = saveDevis;
    document.getElementById('modalSave').style.display = '';
    App.showModal();
}

function renderDevisLigneRow(index, l = {}) {
    const artOpts = _devisArticles.map(a => `<option value="${a.id}" ${l.articleId === a.id ? 'selected' : ''}>${a.designation || a.reference}</option>`).join('');
    return `
        <tr data-dl="${index}">
            <td style="padding:4px">
                <select class="dl-article" onchange="VenteModule.onDevisArticleChange(this)" style="width:100%;padding:6px;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:12px">
                    <option value="">-- Article --</option>
                    ${artOpts}
                </select>
            </td>
            <td style="padding:4px"><input type="number" class="dl-quantite" value="${l.quantite || 1}" min="1" onchange="VenteModule.recalcDevisTotal()" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:12px"></td>
            <td style="padding:4px"><input type="number" class="dl-prix" value="${l.prixUnitaire || 0}" step="0.001" onchange="VenteModule.recalcDevisTotal()" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:12px"></td>
            <td style="padding:4px;text-align:right" class="dl-total">${((l.quantite || 1) * (l.prixUnitaire || 0)).toFixed(3)}</td>
            <td style="padding:4px;text-align:center"><button type="button" onclick="VenteModule.removeDevisLigne(this)" style="background:none;border:none;cursor:pointer;font-size:14px;color:#ef4444">🗑️</button></td>
        </tr>
    `;
}

function onDevisArticleChange(selectEl) {
    const articleId = selectEl.value;
    const article = _devisArticles.find(a => a.id === articleId);
    const row = selectEl.closest('tr');
    if (article && row) {
        const prixInput = row.querySelector('.dl-prix');
        if (prixInput) prixInput.value = (article.prixVente || article.prix || 0).toFixed(3);
        recalcDevisTotal();
    }
}

function addDevisLigne() {
    const tbody = document.getElementById('devisLignesBody');
    if (!tbody) return;
    tbody.insertAdjacentHTML('beforeend', renderDevisLigneRow(tbody.children.length, {}));
}
function removeDevisLigne(btn) { btn.closest('tr').remove(); recalcDevisTotal(); }

function recalcDevisTotal() {
    const rows = document.querySelectorAll('#devisLignesBody tr');
    let totalHT = 0;
    rows.forEach(r => {
        const q = parseFloat(r.querySelector('.dl-quantite')?.value) || 0;
        const p = parseFloat(r.querySelector('.dl-prix')?.value) || 0;
        const t = q * p;
        totalHT += t;
        const td = r.querySelector('.dl-total');
        if (td) td.textContent = t.toFixed(3);
    });
    const tauxTVA = parseInt(document.getElementById('devisTVA')?.value) || 0;
    const montantTVA = totalHT * tauxTVA / 100;
    const totalTTC = totalHT + montantTVA;

    const elHT = document.getElementById('devisTotalHT');
    const elTVA = document.getElementById('devisTotalTVA');
    const elTTC = document.getElementById('devisTotalTTC');
    if (elHT) elHT.textContent = totalHT.toFixed(3) + ' TND';
    if (elTVA) elTVA.textContent = montantTVA.toFixed(3) + ' TND';
    if (elTTC) elTTC.textContent = totalTTC.toFixed(3) + ' TND';
}

async function saveDevis() {
    const clientId = document.getElementById('devisClientId').value;
    if (!clientId) { alert('Sélectionnez un client'); return; }

    const rows = document.querySelectorAll('#devisLignesBody tr');
    const lignes = Array.from(rows).map(r => {
        const sel = r.querySelector('.dl-article');
        const articleId = sel?.value || '';
        const article = _devisArticles.find(a => a.id === articleId);
        return {
            articleId: articleId,
            designation: article ? (article.designation || article.reference) : '',
            quantite: parseFloat(r.querySelector('.dl-quantite')?.value) || 0,
            prixUnitaire: parseFloat(r.querySelector('.dl-prix')?.value) || 0
        };
    }).filter(l => l.articleId);
    const montantHT = lignes.reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
    const tauxTVA = parseInt(document.getElementById('devisTVA')?.value) || 0;
    const montantTVA = montantHT * tauxTVA / 100;
    const montantTTC = montantHT + montantTVA;

    const existingId = document.getElementById('devisId').value;
    const devis = {
        id: existingId || `dv_${Date.now()}`,
        numero: document.getElementById('devisNumero').value || await getNextNumber('DV'),
        date: document.getElementById('devisDate').value,
        clientId: clientId,
        statut: document.getElementById('devisStatut').value || 'Brouillon',
        lignes: lignes,
        tauxTVA: tauxTVA,
        montantHT: montantHT,
        montantTVA: montantTVA,
        montantTotal: montantTTC,
        montantTTC: montantTTC,
        updatedAt: new Date().toISOString()
    };
    if (!existingId) devis.createdAt = new Date().toISOString();

    try {
        await setDoc(doc(db, COLLECTIONS.devisClients, devis.id), devis);
        App.hideModal();
        await renderDevisClients();
    } catch (err) {
        console.error('Erreur sauvegarde devis:', err);
        alert('Erreur: ' + err.message);
    }
}

function editDevis(id) { openDevisModal(id); }
async function deleteDevis(id) {
    if (confirm('Supprimer ce devis ?')) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.devisClients, id));
            await renderDevisClients();
        } catch (err) { console.error('Erreur suppression devis:', err); }
    }
}

async function transformDevisToBC(devisId) {
    const devis = getDevisById(devisId);
    if (!devis) return;
    if (!confirm(`Transformer le devis ${devis.numero} en Bon de Commande Client ?`)) return;

    const lignes = devis.lignes.map(l => ({
        designation: l.designation,
        nom: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        articleId: l.articleId || '',
        prixTotal: (l.quantite || 0) * (l.prixUnitaire || 0)
    }));

    const bcData = {
        id: `bcv_${Date.now()}`,
        numero: `BCV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        clientId: devis.clientId,
        devisId: devis.id,
        devisNumero: devis.numero,
        lignes: lignes,
        montantTotal: lignes.reduce((s, l) => s + l.prixTotal, 0),
        statut: 'En cours',
        type: 'vente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, COLLECTIONS.bonCommandesVente, bcData.id), bcData);
        // Update devis statut + add backlink
        devis.statut = 'Accepté';
        devis.bcId = bcData.id;
        devis.bcNumero = bcData.numero;
        await setDoc(doc(db, COLLECTIONS.devisClients, devis.id), devis);
        alert(`✅ BC Client ${bcData.numero} créé avec succès !`);
        await renderDevisClients();
    } catch (err) {
        console.error('Erreur transformation devis:', err);
        alert('Erreur: ' + err.message);
    }
}

// ==================== REGLEMENTS CLIENTS ====================
async function renderReglementsClients() {
    await loadFactures();
    const container = document.getElementById('reglementsClientsContent') || document.querySelector('#page-reglements-clients');
    if (!container) return;
    const content = container.querySelector('.page-content') || container;

    // Collect all echéances from client factures
    let allEcheances = [];
    factureVenteCache.forEach(f => {
        const cl = ClientsModule.getClientById(f.clientId);
        (f.echeances || []).forEach(e => {
            allEcheances.push({
                ...e,
                factureNumero: f.numero || f.id,
                clientNom: cl?.nom || '-',
                factureId: f.id
            });
        });
    });
    allEcheances.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const totalEnAttente = allEcheances.filter(e => e.statut === 'En attente').reduce((s, e) => s + (e.montant || 0), 0);
    const totalPaye = allEcheances.filter(e => e.statut === 'Payé').reduce((s, e) => s + (e.montant || 0), 0);

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px">
            <div class="card" style="padding:16px;text-align:center">
                <div style="font-size:24px;font-weight:700;color:#f59e0b">${totalEnAttente.toFixed(3)} TND</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px">⏳ En attente</div>
            </div>
            <div class="card" style="padding:16px;text-align:center">
                <div style="font-size:24px;font-weight:700;color:#10b981">${totalPaye.toFixed(3)} TND</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px">✅ Encaissé</div>
            </div>
            <div class="card" style="padding:16px;text-align:center">
                <div style="font-size:24px;font-weight:700;color:#f1f5f9">${allEcheances.length}</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px">📋 Total échéances</div>
            </div>
        </div>
        <div class="card" style="padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:1rem">💰 Échéances Clients</h3>
                <button class="btn btn-primary" id="addReglementClientBtn">➕ Nouvel Encaissement</button>
            </div>
            <div style="overflow-x:auto">
                <table class="data-table" style="width:100%">
                    <thead>
                        <tr><th>Date</th><th>Facture</th><th>Client</th><th>Montant</th><th>Type</th><th>Statut</th><th>Caisse</th></tr>
                    </thead>
                    <tbody>
                        ${allEcheances.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px">Aucune échéance</td></tr>' :
            allEcheances.map(e => `
                            <tr>
                                <td>${e.date || '-'}</td>
                                <td>${e.factureNumero}</td>
                                <td>${e.clientNom}</td>
                                <td><strong>${(e.montant || 0).toFixed(3)} TND</strong></td>
                                <td>${e.typePaiement || '-'}</td>
                                <td><span class="status-badge status-${e.statut === 'Payé' ? 'paye' : 'en-attente'}">${e.statut}</span></td>
                                <td>${e.caisseId ? '<span style="color:#10b981;font-size:11px">✅ Caisse</span>' : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function openReglementClientModal() {
    await loadFactures();
    const unpaid = factureVenteCache.filter(f => f.etat !== 'Payée');

    const opts = unpaid.map(f => {
        const cl = ClientsModule.getClientById(f.clientId);
        const montant = f.montantTotal || 0;
        const paye = (f.echeances || []).filter(e => e.statut === 'Payé').reduce((s, e) => s + (e.montant || 0), 0);
        const restant = montant - paye;
        return `<option value="${f.id}" data-montant="${montant}" data-paye="${paye}" data-restant="${restant}">${f.numero || f.id} - ${cl?.nom || ''} (Restant: ${restant.toFixed(3)} TND)</option>`;
    }).join('');

    document.getElementById('modalTitle').textContent = '💰 Nouvel Encaissement Client';
    document.getElementById('modalBody').innerHTML = `
        <form id="reglementClientForm">
            <div class="form-group">
                <label>Facture Client</label>
                <select id="reglementClientFactureId" onchange="VenteModule.onFactureChangeReglementClient()" required>
                    <option value="">-- Sélectionner --</option>
                    ${opts}
                </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:12px 0">
                <div style="text-align:center;padding:12px;background:rgba(241,245,249,0.05);border-radius:8px">
                    <div style="font-size:18px;font-weight:700" id="rcMontantTotal">0.000</div>
                    <div style="font-size:11px;color:#64748b">Montant Total</div>
                </div>
                <div style="text-align:center;padding:12px;background:rgba(16,185,129,0.1);border-radius:8px">
                    <div style="font-size:18px;font-weight:700;color:#10b981" id="rcMontantPaye">0.000</div>
                    <div style="font-size:11px;color:#64748b">Déjà Payé</div>
                </div>
                <div style="text-align:center;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px">
                    <div style="font-size:18px;font-weight:700;color:#ef4444" id="rcMontantRestant">0.000</div>
                    <div style="font-size:11px;color:#64748b">Restant</div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Montant Encaissement (TND)</label>
                    <input type="number" id="rcMontant" step="0.001" required>
                </div>
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" id="rcDate" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Type Paiement</label>
                <select id="rcType">
                    <option value="Virement">Virement</option>
                    <option value="Versement">Versement</option>
                    <option value="Traite">Traite</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Espèce">Espèce</option>
                </select>
            </div>
        </form>
    `;
    document.getElementById('modalSave').onclick = saveReglementClient;
    document.getElementById('modalSave').style.display = '';
    App.showModal();
}

function onFactureChangeReglementClient() {
    const sel = document.getElementById('reglementClientFactureId');
    if (!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    const montant = parseFloat(opt.dataset.montant) || 0;
    const paye = parseFloat(opt.dataset.paye) || 0;
    const restant = parseFloat(opt.dataset.restant) || 0;

    document.getElementById('rcMontantTotal').textContent = montant.toFixed(3);
    document.getElementById('rcMontantPaye').textContent = paye.toFixed(3);
    document.getElementById('rcMontantRestant').textContent = restant.toFixed(3);
    document.getElementById('rcMontant').value = restant.toFixed(3);
}

async function saveReglementClient() {
    const factureId = document.getElementById('reglementClientFactureId')?.value;
    if (!factureId) { alert('Sélectionnez une facture'); return; }

    const montant = parseFloat(document.getElementById('rcMontant').value) || 0;
    if (montant <= 0) { alert('Montant invalide'); return; }

    const date = document.getElementById('rcDate').value;
    const typePaiement = document.getElementById('rcType').value;

    const facture = getFactureById(factureId);
    if (!facture) { alert('Facture introuvable'); return; }

    // Create Caisse encaissement FIRST
    const client = ClientsModule.getClientById(facture.clientId);
    const caisseId = await CaisseModule.addAutoTransaction({
        type: 'encaissement',
        tiers: client?.nom || 'Client',
        montant: montant,
        mode: typePaiement,
        reference: facture.numero || facture.id,
        notes: `Encaissement ${facture.numero || facture.id}`,
        source: 'vente'
    });

    // Add échéance to facture
    const echeances = facture.echeances || [];
    echeances.push({ date, montant, typePaiement, statut: 'Payé', caisseId: caisseId || null });

    // Recalculate etat
    const totalPaye = echeances.filter(e => e.statut === 'Payé').reduce((s, e) => s + (e.montant || 0), 0);
    const total = parseFloat(facture.montantTotal) || 0;
    let etat = 'Non Payée';
    if (totalPaye >= total && total > 0) etat = 'Payée';
    else if (totalPaye > 0) etat = 'Partiel';

    try {
        await saveFactureData({ ...facture, echeances, etat });

        // R5: Update client solde
        if (facture.clientId) {
            await updateClientSolde(facture.clientId);
        }

        App.hideModal();
        await renderReglementsClients();
    } catch (err) {
        console.error('Erreur sauvegarde règlement client:', err);
        alert('Erreur: ' + err.message);
    }
}

// R5: Recalculate client solde from all factures
async function updateClientSolde(clientId) {
    try {
        await loadFactures();
        const clientFactures = factureVenteCache.filter(f => f.clientId === clientId);
        let totalDu = 0;
        let totalPaye = 0;
        clientFactures.forEach(f => {
            totalDu += parseFloat(f.montantTotal) || 0;
            (f.echeances || []).forEach(e => {
                if (e.statut === 'Payé') totalPaye += (e.montant || 0);
            });
        });
        const solde = totalDu - totalPaye;
        const client = ClientsModule.getClientById(clientId);
        if (client) {
            await setDoc(doc(db, COLLECTIONS.clients, clientId), { ...client, solde: solde, updatedAt: new Date().toISOString() });
        }
    } catch (err) {
        console.error('Error updating client solde:', err);
    }
}


// ==================== DOCUMENT PHOTOS ====================
function showDocPhotos(bcPhotoUrl, blPhotoUrl, blNumero) {
    const modal = document.createElement('div');
    modal.id = 'docPhotosModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;padding:20px';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const photos = [];
    if (bcPhotoUrl) photos.push({ label: '📋 Bon de Commande (BC)', url: bcPhotoUrl });
    if (blPhotoUrl) photos.push({ label: '📄 Bon de Livraison (BL)', url: blPhotoUrl });

    modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:16px;max-width:800px;width:100%;border:1px solid rgba(148,163,184,0.1);overflow:hidden">
            <div style="padding:20px;border-bottom:1px solid rgba(148,163,184,0.1);display:flex;justify-content:space-between;align-items:center">
                <h3 style="color:#f1f5f9;font-size:1.1rem">📷 Documents - ${blNumero}</h3>
                <button onclick="document.getElementById('docPhotosModal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer">✕</button>
            </div>
            <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
                ${photos.map(p => `
                    <div style="background:rgba(0,0,0,0.3);border-radius:12px;overflow:hidden;border:1px solid rgba(148,163,184,0.1)">
                        <div style="padding:10px 14px;border-bottom:1px solid rgba(148,163,184,0.1);color:#a78bfa;font-weight:600;font-size:0.85rem">${p.label}</div>
                        <div style="padding:8px">
                            <img src="${p.url}" style="width:100%;border-radius:8px;cursor:pointer" onclick="window.open('${p.url}','_blank')" title="Cliquer pour agrandir">
                        </div>
                    </div>
                `).join('')}
                ${photos.length === 0 ? '<p style="color:#64748b;text-align:center;padding:30px">Aucun document photo disponible</p>' : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== EXPORT ======================================
export const VenteModule = {
    init, showPage, refreshCurrentPage,
    // BL Client
    editBL, deleteBL, openBLModal,
    onCommandeChangeBLClient, onTruckChangeBL, recalcBLLigne,
    // Factures Client
    editFacture, deleteFacture, openFactureModal,
    onBLChangeFactureClient,
    viewEcheancesClient, addEcheanceClient, removeEcheanceClient, recalcEcheancesClient,
    // Devis Client
    editDevis, deleteDevis, openDevisModal, transformDevisToBC,
    addDevisLigne, removeDevisLigne, recalcDevisTotal, onDevisArticleChange,
    // Reglements Client
    openReglementClientModal, onFactureChangeReglementClient,
    // Document Photos
    showDocPhotos,
    // Filters
    filterBLs, filterFactures: filterFacturesVente
};
window.VenteModule = VenteModule;
