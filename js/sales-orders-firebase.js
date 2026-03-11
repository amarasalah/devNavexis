/**
 * SALES ORDERS MODULE - FIREBASE VERSION
 * Bon Commandes Vente (Clients)
 * Flow: Devis Client → BC Client → BL Client → Facture Client
 * Mirrors Achat BC pattern: BC pulls articles from Devis source
 */

import { db, collection, doc, getDocs, setDoc, deleteDoc, COLLECTIONS, getNextNumber } from './firebase.js';
import { ClientsModule } from './clients-firebase.js';
import { ArticlesModule } from './articles-firebase.js';

let cache = [];
let _loaded = false;
let _devisCache = [];

async function init() {
    document.getElementById('addSalesOrderBtn')?.addEventListener('click', () => openModal());
    await loadOrders();
}

async function loadOrders() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.bonCommandesVente));
        cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cache.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        _loaded = true;
        return cache;
    } catch (error) {
        console.error('Error loading sales orders:', error);
        return [];
    }
}

async function loadDevis() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.devisClients));
        _devisCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return _devisCache;
    } catch (err) {
        console.error('Error loading devis:', err);
        _devisCache = [];
        return [];
    }
}

async function getOrders() {
    if (!_loaded) await loadOrders();
    return cache;
}

function getOrderById(id) {
    return cache.find(o => o.id === id);
}

async function refresh() {
    await loadOrders();
    await renderOrders();
}

// ==================== TABLE RENDER ====================
async function renderOrders() {
    const orders = await getOrders();
    const tbody = document.getElementById('salesOrdersTable');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:30px">Aucun bon de commande vente</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const client = ClientsModule.getClientById(o.clientId);
        const total = (o.lignes || []).reduce((sum, l) => sum + (l.prixTotal || 0), 0);
        return `
            <tr>
                <td><strong>${o.numero || o.id}</strong></td>
                <td>${o.date || '-'}</td>
                <td>${o.devisNumero || '-'}</td>
                <td>${client?.nom || '-'}</td>
                <td>${(o.lignes || []).length} article(s)</td>
                <td><strong>${(o.montantTotal || total).toFixed(3)} TND</strong></td>
                <td><span class="status-badge status-${(o.statut || '').toLowerCase().replace(/\s/g, '-').replace(/é/g, 'e')}">${o.statut || 'En cours'}</span></td>
                <td>
                    <button class="btn-icon" onclick="SalesOrdersModule.edit('${o.id}')" title="Modifier">✏️</button>
                    <button class="btn-icon" onclick="SalesOrdersModule.transformToBL('${o.id}')" title="Transformer en BL">📦</button>
                    <button class="btn-icon" onclick="SalesOrdersModule.remove('${o.id}')" title="Supprimer">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==================== BC CLIENT MODAL (mirrors Achat BC) ====================
async function openModal(orderId = null) {
    const order = orderId ? getOrderById(orderId) : null;
    await loadDevis();
    const validDevis = _devisCache.filter(d => d.statut === 'Accepté' || d.id === order?.devisId);

    const devisOpts = validDevis.map(d => {
        const c = ClientsModule.getClientById(d.clientId);
        return `<option value="${d.id}" ${order?.devisId === d.id ? 'selected' : ''}>${d.numero || d.id} - ${c?.nom || ''} (${(d.montantTotal || 0).toFixed(3)} TND)</option>`;
    }).join('');

    const lignes = order?.lignes || [];

    document.getElementById('modalTitle').textContent = order ? 'Modifier BC Client' : 'Nouveau BC Client';
    document.getElementById('modalBody').innerHTML = `
        <form id="bcClientForm">
            <input type="hidden" id="bcClientId" value="${order?.id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>Devis source</label>
                    <select id="bcClientDevisId" onchange="SalesOrdersModule.onDevisChange()" ${order ? 'disabled' : ''} required>
                        <option value="">-- Sélectionner un Devis --</option>
                        ${devisOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>Date BC</label>
                    <input type="date" id="bcClientDate" value="${order?.date || new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Client</label>
                    <input type="text" id="bcClientNom" value="${order?.clientId ? ClientsModule.getClientById(order.clientId)?.nom || '' : ''}" readonly style="background:rgba(15,23,42,0.2)">
                    <input type="hidden" id="bcClientClientId" value="${order?.clientId || ''}">
                </div>
            </div>
            <div style="margin-top:16px">
                <label style="font-weight:600;margin-bottom:8px;display:block">📦 Articles (prix modifiables)</label>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                        <tr style="background:rgba(148,163,184,0.1)">
                            <th style="padding:8px;text-align:left">Désignation</th>
                            <th style="padding:8px;text-align:right;width:120px">Prix Unit.</th>
                            <th style="padding:8px;text-align:right;width:80px">Qté</th>
                            <th style="padding:8px;text-align:right;width:120px">Total</th>
                        </tr>
                    </thead>
                    <tbody id="bcClientLignesBody">
                        ${lignes.map((l, i) => `
                            <tr data-article-id="${l.articleId || ''}">
                                <td style="padding:6px;color:#f1f5f9">${l.designation || l.nom || ''}</td>
                                <td style="padding:4px"><input type="number" class="bcv-pu" value="${l.prixUnitaire || 0}" step="0.001" onchange="SalesOrdersModule.recalcBCLigne(this)" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:14px"></td>
                                <td style="padding:4px"><input type="number" class="bcv-qte" value="${l.quantite || 0}" min="0" step="1" onchange="SalesOrdersModule.recalcBCLigne(this)" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:14px"></td>
                                <td style="padding:6px;text-align:right;font-weight:600;color:#10b981" class="bcv-total">${((l.prixUnitaire || 0) * (l.quantite || 0)).toFixed(3)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top:2px solid rgba(148,163,184,0.2)">
                            <td colspan="3" style="padding:8px;text-align:right;font-weight:700">Total HT:</td>
                            <td style="padding:8px;text-align:right;font-weight:700;font-size:15px" id="bcClientTotalGeneral">${lignes.reduce((s, l) => s + ((l.prixUnitaire || 0) * (l.quantite || 0)), 0).toFixed(3)} TND</td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding:8px;text-align:right">Remise:</td>
                            <td style="padding:8px;text-align:right">
                                <input type="number" id="bcClientRemise" value="${order?.remise || 0}" min="0" max="100" step="0.5" onchange="SalesOrdersModule.recalcBCTotal()" style="width:70px;padding:2px 4px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);background:rgba(30,41,59,0.8);color:#e2e8f0;text-align:right"> %
                            </td>
                            <td style="padding:8px;text-align:right;font-weight:600;color:#f97316" id="bcClientMontantRemise">0.000 TND</td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding:8px;text-align:right">TVA:</td>
                            <td style="padding:8px;text-align:right">
                                <select id="bcClientTVA" onchange="SalesOrdersModule.recalcBCTotal()" style="width:70px;padding:2px 4px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);background:rgba(30,41,59,0.8);color:#e2e8f0">
                                    <option value="0" ${(!order?.tauxTVA || order?.tauxTVA === 0) ? 'selected' : ''}>0%</option>
                                    <option value="7" ${order?.tauxTVA === 7 ? 'selected' : ''}>7%</option>
                                    <option value="19" ${order?.tauxTVA === 19 ? 'selected' : ''}>19%</option>
                                </select>
                            </td>
                            <td style="padding:8px;text-align:right;font-weight:600;color:#f59e0b" id="bcClientTotalTVA">0.000 TND</td>
                        </tr>
                        <tr style="border-top:1px solid rgba(148,163,184,0.2)">
                            <td colspan="3" style="padding:8px;text-align:right;font-weight:700;color:#8b5cf6">Total TTC:</td>
                            <td style="padding:8px;text-align:right;font-weight:700;color:#8b5cf6;font-size:15px" id="bcClientTotalTTC">0.000 TND</td>
                        </tr>
                    </tfoot>
                </table>
                ${lignes.length === 0 ? '<div style="color:#64748b;padding:20px;text-align:center;font-size:14px">Sélectionnez un Devis pour charger les articles</div>' : ''}
            </div>
        </form>
    `;
    document.getElementById('modalSave').onclick = saveOrder;
    App.showModal();
}

function onDevisChange() {
    const devisId = document.getElementById('bcClientDevisId')?.value;
    if (!devisId) return;
    const devis = _devisCache.find(d => d.id === devisId);
    if (!devis) return;

    // Fill client
    const client = ClientsModule.getClientById(devis.clientId);
    document.getElementById('bcClientNom').value = client?.nom || '';
    document.getElementById('bcClientClientId').value = devis.clientId || '';

    // Copy TVA from devis if available
    const tvaSelect = document.getElementById('bcClientTVA');
    if (tvaSelect && devis.tauxTVA) tvaSelect.value = devis.tauxTVA;

    // Fill lignes from Devis
    const lignes = devis.lignes || [];
    const tbody = document.getElementById('bcClientLignesBody');
    tbody.innerHTML = lignes.map(l => `
    < tr data - article - id="${l.articleId || ''}" >
            <td style="padding:6px;color:#f1f5f9">${l.designation || ''}</td>
            <td style="padding:4px"><input type="number" class="bcv-pu" value="${l.prixUnitaire || 0}" step="0.001" onchange="SalesOrdersModule.recalcBCLigne(this)" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:14px"></td>
            <td style="padding:4px"><input type="number" class="bcv-qte" value="${l.quantite || 0}" min="0" step="1" onchange="SalesOrdersModule.recalcBCLigne(this)" style="width:100%;padding:6px;text-align:right;background:rgba(15,23,42,0.3);border:1px solid rgba(148,163,184,0.2);border-radius:4px;color:#f1f5f9;font-size:14px"></td>
            <td style="padding:6px;text-align:right;font-weight:600;color:#10b981" class="bcv-total">${((l.prixUnitaire || 0) * (l.quantite || 0)).toFixed(3)}</td>
        </tr >
    `).join('');
    recalcBCTotal();
}

function recalcBCLigne(input) {
    const row = input.closest('tr');
    const pu = parseFloat(row.querySelector('.bcv-pu').value) || 0;
    const qte = parseFloat(row.querySelector('.bcv-qte').value) || 0;
    row.querySelector('.bcv-total').textContent = (pu * qte).toFixed(3);
    recalcBCTotal();
}

function recalcBCTotal() {
    const totals = document.querySelectorAll('#bcClientLignesBody .bcv-total');
    let totalHT = 0;
    totals.forEach(t => totalHT += parseFloat(t.textContent) || 0);

    const remisePct = parseFloat(document.getElementById('bcClientRemise')?.value) || 0;
    const montantRemise = totalHT * remisePct / 100;
    const montantApresRemise = totalHT - montantRemise;

    const tauxTVA = parseInt(document.getElementById('bcClientTVA')?.value) || 0;
    const montantTVA = montantApresRemise * tauxTVA / 100;
    const totalTTC = montantApresRemise + montantTVA;

    const elHT = document.getElementById('bcClientTotalGeneral');
    const elRemise = document.getElementById('bcClientMontantRemise');
    const elTVA = document.getElementById('bcClientTotalTVA');
    const elTTC = document.getElementById('bcClientTotalTTC');
    if (elHT) elHT.textContent = totalHT.toFixed(3) + ' TND';
    if (elRemise) elRemise.textContent = '-' + montantRemise.toFixed(3) + ' TND';
    if (elTVA) elTVA.textContent = montantTVA.toFixed(3) + ' TND';
    if (elTTC) elTTC.textContent = totalTTC.toFixed(3) + ' TND';
}

async function saveOrder() {
    const devisId = document.getElementById('bcClientDevisId')?.value;
    const devis = devisId ? _devisCache.find(d => d.id === devisId) : null;

    // Get lignes from table
    const rows = document.querySelectorAll('#bcClientLignesBody tr');
    const lignes = Array.from(rows).map(row => {
        const designation = row.querySelector('td:first-child').textContent.trim();
        const articleId = row.dataset.articleId || null;
        const pu = parseFloat(row.querySelector('.bcv-pu')?.value) || 0;
        const qte = parseFloat(row.querySelector('.bcv-qte')?.value) || 0;
        return { designation, nom: designation, articleId, prixUnitaire: pu, quantite: qte, prixTotal: pu * qte };
    });

    if (lignes.length === 0) { alert('Aucun article'); return; }

    const montantHT = lignes.reduce((s, l) => s + l.prixTotal, 0);
    const remise = parseFloat(document.getElementById('bcClientRemise')?.value) || 0;
    const montantRemise = montantHT * remise / 100;
    const montantApresRemise = montantHT - montantRemise;
    const tauxTVA = parseInt(document.getElementById('bcClientTVA')?.value) || 0;
    const montantTVA = montantApresRemise * tauxTVA / 100;
    const montantTTC = montantApresRemise + montantTVA;

    const order = {
        id: document.getElementById('bcClientId').value || null,
        numero: document.getElementById('bcClientId').value
            ? getOrderById(document.getElementById('bcClientId').value)?.numero
            : await getNextNumber('BCV'),
        date: document.getElementById('bcClientDate').value,
        devisId: devisId || null,
        devisNumero: devis?.numero || '',
        clientId: document.getElementById('bcClientClientId').value,
        lignes: lignes,
        montantHT: montantHT,
        remise: remise,
        montantRemise: montantRemise,
        tauxTVA: tauxTVA,
        montantTVA: montantTVA,
        montantTotal: montantTTC,
        montantTTC: montantTTC,
        statut: 'En cours',
        type: 'vente'
    };

    if (!order.clientId) { alert('Sélectionnez un client'); return; }

    try {
        const id = order.id || `bcv_${Date.now()} `;
        order.id = id;
        order.updatedAt = new Date().toISOString();
        if (!document.getElementById('bcClientId').value) order.createdAt = new Date().toISOString();
        await setDoc(doc(db, COLLECTIONS.bonCommandesVente, id), order);

        // Update Devis status to 'Transformé' + add backlink
        if (devisId && devis && !document.getElementById('bcClientId').value) {
            devis.statut = 'Accepté';
            devis.bcId = order.id;
            devis.bcNumero = order.numero;
            await setDoc(doc(db, COLLECTIONS.devisClients, devisId), devis);
        }

        App.hideModal();
        await refresh();
    } catch (error) {
        console.error('Error saving order:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

function edit(id) { openModal(id); }

async function transformToBL(orderId) {
    const order = getOrderById(orderId);
    if (!order) return;
    if (order.statut === 'Livré') { alert('Ce BC est déjà transformé en BL'); return; }
    if (!confirm(`Transformer le BC ${order.numero} en Bon de Livraison Client ? `)) return;

    const lignes = (order.lignes || []).map(l => ({
        nom: l.designation || l.nom || '',
        articleId: l.articleId || null,
        prixUnitaire: l.prixUnitaire || 0,
        quantiteCommandee: l.quantite || 0,
        quantiteLivree: l.quantite || 0,
        prixTotal: (l.quantite || 0) * (l.prixUnitaire || 0)
    }));

    const blNumero = await getNextNumber('BLV');
    const montantHT = lignes.reduce((s, l) => s + l.prixTotal, 0);
    const tauxTVA = order.tauxTVA || 0;
    const remise = order.remise || 0;
    const montantRemise = montantHT * remise / 100;
    const montantApresRemise = montantHT - montantRemise;
    const montantTVA = montantApresRemise * tauxTVA / 100;
    const montantTTC = montantApresRemise + montantTVA;
    const blData = {
        id: `blv_${Date.now()}`,
        numero: blNumero,
        date: new Date().toISOString().split('T')[0],
        commandeId: order.id,
        commandeNumero: order.numero,
        clientId: order.clientId,
        lignes: lignes,
        montantHT: montantHT,
        remise: remise,
        montantRemise: montantRemise,
        tauxTVA: tauxTVA,
        montantTVA: montantTVA,
        montantTotal: montantTTC,
        montantTTC: montantTTC,
        statut: 'Livré',
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, COLLECTIONS.bonLivraisonsVente, blData.id), blData);

        // Record stock movements (sortie) via InventaireModule
        try {
            const { InventaireModule } = await import('./inventory-firebase.js');
            const client = ClientsModule.getClientById(order.clientId);
            await InventaireModule.recordBLMovements(lignes, 'sortie', {
                documentType: 'BL Vente',
                documentNumero: blData.numero,
                documentId: blData.id,
                tiersId: order.clientId,
                tiersNom: client?.nom || '',
                date: blData.date
            });
        } catch (invErr) {
            // Fallback: manual stock reduction if inventory module fails
            console.warn('Inventory tracking error, falling back to manual stock update:', invErr);
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

        // Update BC status to Livré
        order.statut = 'Livré';
        await setDoc(doc(db, COLLECTIONS.bonCommandesVente, order.id), { ...order, updatedAt: new Date().toISOString() });

        alert(`✅ BL Vente ${blData.numero} créé avec succès!\nStock mis à jour.`);
        await refresh();
    } catch (err) {
        console.error('Erreur transformation BC → BL Vente:', err);
        alert('Erreur: ' + err.message);
    }
}

async function remove(id) {
    if (confirm('Supprimer ce bon de commande vente ?')) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.bonCommandesVente, id));
            await refresh();
        } catch (error) {
            console.error('Error deleting order:', error);
        }
    }
}

export const SalesOrdersModule = {
    init, refresh, getOrders, getOrderById, edit, remove,
    onDevisChange, recalcBCLigne, recalcBCTotal, transformToBL
};
window.SalesOrdersModule = SalesOrdersModule;
