/**
 * PURCHASE ORDERS MODULE - FIREBASE VERSION
 * Bon Commandes Achat (Fournisseurs)
 */

import { db, collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, COLLECTIONS, getNextNumber } from './firebase.js';
import { DataModule } from './data-firebase.js';
import { SuppliersModule } from './suppliers-firebase.js';
import { ArticlesModule } from './articles-firebase.js';

let cache = [];
let _loaded = false;
let _orderArticles = [];
let _orderLines = [];

async function init() {
    // Note: addCommandeBtn is handled by AchatModule (achat-local.js) via event delegation
    document.getElementById('addPurchaseOrderBtn')?.addEventListener('click', () => openModal());
    await loadOrders();
}

async function loadOrders() {
    try {
        const q = query(collection(db, COLLECTIONS.bonCommandesAchat), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _loaded = true;
        return cache;
    } catch (error) {
        console.error('Error loading purchase orders:', error);
        const snap = await getDocs(collection(db, COLLECTIONS.bonCommandesAchat));
        cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _loaded = true;
        return cache;
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

async function generateNumero() {
    return await getNextNumber('BCA');
}

async function renderOrders() {
    const orders = await getOrders();
    const tbody = document.getElementById('commandesBody') || document.getElementById('purchaseOrdersTable');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Aucun bon de commande</td></tr>';
        return;
    }

    const suppliers = await SuppliersModule.getSuppliers();
    const trucks = await DataModule.getTrucks();

    tbody.innerHTML = orders.map(o => {
        const supplier = suppliers.find(s => s.id === o.fournisseurId);
        const truck = o.camionId ? trucks.find(t => t.id === o.camionId) : null;
        const statusClass = o.statut === 'Validé' ? 'status-success' :
            o.statut === 'En cours' ? 'status-warning' : 'status-default';
        return `
            <tr>
                <td><strong>${o.numero}</strong></td>
                <td>${formatDate(o.date)}</td>
                <td>${truck?.matricule || '-'}</td>
                <td>${supplier?.nom || '-'}</td>
                <td>${o.lignes?.length || 0}</td>
                <td><strong>${(o.totalHT || 0).toLocaleString('fr-FR')} TND</strong></td>
                <td>${(o.totalTVA || 0).toLocaleString('fr-FR')} TND</td>
                <td><strong>${(o.totalTTC || 0).toLocaleString('fr-FR')} TND</strong></td>
                <td><span class="status-badge ${statusClass}">${o.statut || 'Brouillon'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="PurchaseOrdersModule.edit('${o.id}')" title="Modifier">✏️</button>
                    <button class="btn btn-sm btn-info" onclick="PurchaseOrdersModule.view('${o.id}')" title="Voir">👁️</button>
                    <button class="btn btn-sm btn-success" onclick="PurchaseOrdersModule.transformToBL('${o.id}')" title="Transformer en BL">📦</button>
                    <button class="btn btn-sm btn-danger" onclick="PurchaseOrdersModule.remove('${o.id}')" title="Supprimer">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR');
}

async function openModal(orderId = null) {
    const order = orderId ? getOrderById(orderId) : null;
    const title = order ? 'Modifier Bon Commande' : 'Nouveau Bon Commande Achat';
    const numero = order?.numero || await generateNumero();
    const today = new Date().toISOString().split('T')[0];

    const suppliers = await SuppliersModule.getSuppliers();
    const trucks = await DataModule.getTrucks();
    const articles = ArticlesModule.getArticlesByType('achat');

    const supplierOptions = suppliers.map(s =>
        `<option value="${s.id}" ${order?.fournisseurId === s.id ? 'selected' : ''}>${s.nom}</option>`
    ).join('');

    const truckOptions = trucks.map(t =>
        `<option value="${t.id}" ${order?.camionId === t.id ? 'selected' : ''}>${t.matricule}</option>`
    ).join('');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modal').classList.add('modal-large');
    document.getElementById('modalBody').innerHTML = `
        <form id="purchaseOrderForm">
            <input type="hidden" id="orderId" value="${order?.id || ''}">
            
            <div class="form-row">
                <div class="form-group">
                    <label>N° BC</label>
                    <input type="text" id="orderNumero" value="${numero}" readonly>
                </div>
                <div class="form-group">
                    <label>Date *</label>
                    <input type="date" id="orderDate" value="${order?.date || today}" required>
                </div>
                <div class="form-group">
                    <label>🚛 Camion</label>
                    <select id="orderCamion">
                        <option value="">-- Aucun camion --</option>
                        ${truckOptions}
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Fournisseur *</label>
                    <select id="orderFournisseur" required>
                        <option value="">-- Sélectionner --</option>
                        ${supplierOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Statut</label>
                    <select id="orderStatut">
                        <option value="Brouillon" ${order?.statut === 'Brouillon' ? 'selected' : ''}>Brouillon</option>
                        <option value="En cours" ${order?.statut === 'En cours' ? 'selected' : ''}>En cours</option>
                        <option value="Validé" ${order?.statut === 'Validé' ? 'selected' : ''}>Validé</option>
                    </select>
                </div>
            </div>

            <div style="background: rgba(59, 130, 246, 0.1); border-radius: 8px; padding: 16px; margin: 16px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="color: #3b82f6; margin: 0;">📦 Lignes de Commande</h4>
                    <button type="button" class="btn btn-sm btn-primary" onclick="PurchaseOrdersModule.addLine()">+ Ajouter Ligne</button>
                </div>
                <div id="orderLinesContainer">
                    <table class="data-table" style="font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th>Désignation</th>
                                <th>Qté</th>
                                <th>Prix Unit.</th>
                                <th>TVA %</th>
                                <th>Total HT</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="orderLinesBody"></tbody>
                    </table>
                </div>
            </div>

            <div style="background: rgba(139, 92, 246, 0.1); border-radius: 8px; padding: 16px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center;">
                    <div>
                        <span style="color: #94a3b8; font-size: 0.75rem;">Total HT</span>
                        <div id="orderTotalHT" style="font-size: 1.25rem; font-weight: bold;">0.000 TND</div>
                    </div>
                    <div>
                        <span style="color: #94a3b8; font-size: 0.75rem;">Total TVA</span>
                        <div id="orderTotalTVA" style="font-size: 1.25rem; font-weight: bold;">0.000 TND</div>
                    </div>
                    <div>
                        <span style="color: #94a3b8; font-size: 0.75rem;">Total TTC</span>
                        <div id="orderTotalTTC" style="font-size: 1.5rem; font-weight: bold; color: #8b5cf6;">0.000 TND</div>
                    </div>
                </div>
            </div>
        </form>
    `;

    // Store articles for line items
    _orderArticles = articles;
    _orderLines = order?.lignes || [];

    renderLines();
    document.getElementById('modalSave').onclick = saveOrder;
    App.showModal();
}

function addLine() {
    _orderLines.push({
        articleId: '',
        designation: '',
        quantite: 1,
        prixUnitaire: 0,
        tva: 19,
        totalHT: 0
    });
    renderLines();
}

function removeLine(index) {
    _orderLines.splice(index, 1);
    renderLines();
}

function renderLines() {
    const tbody = document.getElementById('orderLinesBody');
    if (!tbody) return;

    const articles = _orderArticles || [];
    const lines = _orderLines || [];

    if (lines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;">Aucune ligne</td></tr>';
        return;
    }

    const articleOptions = articles.map(a => `<option value="${a.id}">${a.reference}</option>`).join('');

    tbody.innerHTML = lines.map((line, i) => `
        <tr>
            <td>
                <select onchange="PurchaseOrdersModule.onArticleChange(${i}, this.value)" style="width: 100px;">
                    <option value="">--</option>
                    ${articles.map(a => `<option value="${a.id}" ${line.articleId === a.id ? 'selected' : ''}>${a.reference}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" value="${line.designation || ''}" onchange="PurchaseOrdersModule.updateLine(${i}, 'designation', this.value)" style="width: 150px;"></td>
            <td><input type="number" value="${line.quantite || 1}" min="1" onchange="PurchaseOrdersModule.updateLine(${i}, 'quantite', this.value)" style="width: 60px;"></td>
            <td><input type="number" value="${line.prixUnitaire || 0}" step="0.001" onchange="PurchaseOrdersModule.updateLine(${i}, 'prixUnitaire', this.value)" style="width: 80px;"></td>
            <td><input type="number" value="${line.tva || 19}" onchange="PurchaseOrdersModule.updateLine(${i}, 'tva', this.value)" style="width: 50px;"></td>
            <td style="font-weight: bold;">${(line.totalHT || 0).toFixed(3)}</td>
            <td><button type="button" class="btn btn-sm btn-danger" onclick="PurchaseOrdersModule.removeLine(${i})">✕</button></td>
        </tr>
    `).join('');

    updateTotals();
}

function onArticleChange(index, articleId) {
    const article = _orderArticles.find(a => a.id === articleId);
    if (article) {
        _orderLines[index].articleId = articleId;
        _orderLines[index].designation = article.designation;
        _orderLines[index].prixUnitaire = article.prixAchat || 0;
    }
    renderLines();
}

function updateLine(index, field, value) {
    if (field === 'quantite' || field === 'prixUnitaire' || field === 'tva') {
        _orderLines[index][field] = parseFloat(value) || 0;
    } else {
        _orderLines[index][field] = value;
    }
    _orderLines[index].totalHT = _orderLines[index].quantite * _orderLines[index].prixUnitaire;
    updateTotals();
}

function updateTotals() {
    let totalHT = 0;
    let totalTVA = 0;

    _orderLines.forEach(line => {
        line.totalHT = (line.quantite || 0) * (line.prixUnitaire || 0);
        totalHT += line.totalHT;
        totalTVA += line.totalHT * (line.tva || 0) / 100;
    });

    const totalTTC = totalHT + totalTVA;

    const htEl = document.getElementById('orderTotalHT');
    const tvaEl = document.getElementById('orderTotalTVA');
    const ttcEl = document.getElementById('orderTotalTTC');

    if (htEl) htEl.textContent = `${totalHT.toFixed(3)} TND`;
    if (tvaEl) tvaEl.textContent = `${totalTVA.toFixed(3)} TND`;
    if (ttcEl) ttcEl.textContent = `${totalTTC.toFixed(3)} TND`;
}

async function saveOrder() {
    let totalHT = 0, totalTVA = 0;
    _orderLines.forEach(line => {
        line.totalHT = line.quantite * line.prixUnitaire;
        totalHT += line.totalHT;
        totalTVA += line.totalHT * (line.tva || 0) / 100;
    });

    const order = {
        id: document.getElementById('orderId').value || `bc_${Date.now()}`,
        numero: document.getElementById('orderNumero').value,
        date: document.getElementById('orderDate').value,
        camionId: document.getElementById('orderCamion').value || null,
        fournisseurId: document.getElementById('orderFournisseur').value,
        statut: document.getElementById('orderStatut').value,
        lignes: _orderLines,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        type: 'achat',
        createdAt: document.getElementById('orderId').value ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (!order.fournisseurId) {
        alert('Veuillez sélectionner un fournisseur');
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.bonCommandesAchat, order.id), order);

        // R4: Store purchase charges separately (not in chargesFixes)
        if (order.camionId && order.totalTTC > 0) {
            const truck = DataModule.getTruckById(order.camionId);
            if (truck) {
                const oldOrder = getOrderById(order.id);
                const oldAmount = (oldOrder?.camionId === order.camionId) ? (oldOrder.totalTTC || 0) : 0;
                const difference = order.totalTTC - oldAmount;
                const updatedChargesAchat = (truck.chargesAchat || 0) + difference;
                await setDoc(doc(db, COLLECTIONS.trucks, order.camionId), {
                    ...truck,
                    chargesAchat: updatedChargesAchat,
                    updatedAt: new Date().toISOString()
                });
                console.log(`✅ Charges achat du camion ${truck.matricule} mises à jour: +${difference.toFixed(3)} TND`);
            }
        }

        document.getElementById('modal').classList.remove('modal-large');
        App.hideModal();
        await refresh();
    } catch (error) {
        console.error('Error saving order:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

function edit(id) { openModal(id); }

async function view(id) {
    const order = getOrderById(id);
    if (!order) return;

    const suppliers = await SuppliersModule.getSuppliers();
    const supplier = suppliers.find(s => s.id === order.fournisseurId);

    document.getElementById('modalTitle').textContent = `BC: ${order.numero}`;
    document.getElementById('modal').classList.add('modal-large');
    document.getElementById('modalBody').innerHTML = `
        <div style="padding: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div><strong>Fournisseur:</strong> ${supplier?.nom || '-'}</div>
                <div><strong>Date:</strong> ${formatDate(order.date)}</div>
                <div><strong>Statut:</strong> ${order.statut}</div>
            </div>
            <table class="data-table">
                <thead>
                    <tr><th>Article</th><th>Désignation</th><th>Qté</th><th>Prix</th><th>TVA</th><th>Total</th></tr>
                </thead>
                <tbody>
                    ${order.lignes?.map(l => `
                        <tr>
                            <td>${l.articleId || '-'}</td>
                            <td>${l.designation}</td>
                            <td>${l.quantite}</td>
                            <td>${l.prixUnitaire?.toFixed(3)}</td>
                            <td>${l.tva}%</td>
                            <td><strong>${l.totalHT?.toFixed(3)}</strong></td>
                        </tr>
                    `).join('') || '<tr><td colspan="6">Aucune ligne</td></tr>'}
                </tbody>
            </table>
            <div style="text-align: right; margin-top: 16px; font-size: 1.1rem;">
                <div>Total HT: <strong>${order.totalHT?.toFixed(3)} TND</strong></div>
                <div>Total TVA: <strong>${order.totalTVA?.toFixed(3)} TND</strong></div>
                <div style="font-size: 1.3rem; color: #8b5cf6;">Total TTC: <strong>${order.totalTTC?.toFixed(3)} TND</strong></div>
            </div>
        </div>
    `;
    document.getElementById('modalSave').style.display = 'none';
    document.getElementById('modalCancel').textContent = 'Fermer';
    App.showModal();
}

async function transformToBL(orderId) {
    const order = getOrderById(orderId);
    if (!order) return;
    if (!confirm(`Transformer le BC ${order.numero} en Bon de Livraison Achat ?`)) return;

    const lignes = (order.lignes || []).map(l => ({
        nom: l.designation || l.nom || '',
        articleId: l.articleId || null,
        quantiteCommandee: l.quantite || 0,
        dejaRecu: 0,
        quantiteRecue: l.quantite || 0
    }));

    const blNumero = await getNextNumber('BLA');
    const blData = {
        id: `bla_${Date.now()}`,
        numero: blNumero,
        date: new Date().toISOString().split('T')[0],
        commandeId: order.id,
        commandeNumero: order.numero,
        fournisseurId: order.fournisseurId,
        depot: 'Magasin principal',
        lignes: lignes,
        statut: 'Reçu',
        updatedAt: new Date().toISOString()
    };

    try {
        // Import SuppliersModule dynamically to avoid circular deps
        const { SuppliersModule } = await import('./suppliers-firebase.js');
        await SuppliersModule.saveLivraison(blData);

        // Record stock movements (entree)
        try {
            const { InventaireModule } = await import('./inventory-firebase.js');
            const suppliers = await SuppliersModule.getSuppliers();
            const supplier = suppliers.find(s => s.id === order.fournisseurId);
            await InventaireModule.recordBLMovements(lignes, 'entree', {
                documentType: 'BL Achat',
                documentNumero: blData.numero,
                documentId: blData.id,
                tiersId: order.fournisseurId,
                tiersNom: supplier?.nom || '',
                date: blData.date
            });
        } catch (invErr) {
            console.warn('Stock tracking error (non-blocking):', invErr);
        }

        // Update BC status to Livré
        order.statut = 'Livré';
        await setDoc(doc(db, COLLECTIONS.bonCommandesAchat, order.id), { ...order, updatedAt: new Date().toISOString() });

        alert(`✅ BL Achat ${blData.numero} créé avec succès !\nArticles ajoutés au stock.`);
        await refresh();
    } catch (err) {
        console.error('Erreur transformation BC → BL:', err);
        alert('Erreur: ' + err.message);
    }
}

async function remove(id) {
    if (confirm('Supprimer ce bon de commande ?')) {
        try {
            // Récupérer le bon de commande avant suppression
            const order = getOrderById(id);

            // R4: Remove from chargesAchat (not chargesFixes)
            if (order?.camionId && order.totalTTC > 0) {
                const truck = DataModule.getTruckById(order.camionId);
                if (truck) {
                    const updatedChargesAchat = Math.max(0, (truck.chargesAchat || 0) - order.totalTTC);
                    await setDoc(doc(db, COLLECTIONS.trucks, order.camionId), {
                        ...truck,
                        chargesAchat: updatedChargesAchat,
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`✅ Charges achat du camion ${truck.matricule} mises à jour: -${order.totalTTC.toFixed(3)} TND`);
                }
            }

            await deleteDoc(doc(db, COLLECTIONS.bonCommandesAchat, id));
            await refresh();
        } catch (error) {
            console.error('Error deleting order:', error);
        }
    }
}

export const PurchaseOrdersModule = {
    init, refresh, getOrders, getOrderById, edit, view, remove,
    addLine, removeLine, onArticleChange, updateLine, transformToBL
};
window.PurchaseOrdersModule = PurchaseOrdersModule;
