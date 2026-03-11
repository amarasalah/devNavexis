/**
 * SUPPLIERS MODULE - FIREBASE VERSION
 * Gestion des Fournisseurs + Achat Data (DA, BC, BL, Factures)
 */

import { db, collection, doc, getDocs, getDoc, setDoc, deleteDoc, COLLECTIONS } from './firebase.js';

// ========== CACHES ==========
let suppliersCache = [];
let demandesCache = [];
let commandesCache = [];
let livraisonsCache = [];
let facturesCache = [];
let _suppliersLoaded = false;
let _demandesLoaded = false;
let _commandesLoaded = false;
let _livraisonsLoaded = false;
let _facturesLoaded = false;
let _sortiesLoaded = false;

// ========== SUPPLIERS ==========
async function init() {
    document.getElementById('addSupplierBtn')?.addEventListener('click', () => openModal());
    await loadSuppliers();
}

async function loadSuppliers() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.suppliers));
        suppliersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _suppliersLoaded = true;
        return suppliersCache;
    } catch (error) {
        console.error('Error loading suppliers:', error);
        return [];
    }
}

async function getSuppliers() {
    if (!_suppliersLoaded) await loadSuppliers();
    return suppliersCache;
}

function getSupplierById(id) {
    return suppliersCache.find(s => s.id === id);
}

async function refresh() {
    await loadSuppliers();
    await renderSuppliers();
}

function generateCode() {
    const year = new Date().getFullYear().toString().slice(-2);
    const num = String(suppliersCache.length + 1).padStart(6, '0');
    return `FR${year}${num}`;
}

async function renderSuppliers() {
    const suppliers = await getSuppliers();
    const grid = document.getElementById('suppliersGrid');
    if (!grid) return;

    if (suppliers.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>Aucun fournisseur. Cliquez sur + pour ajouter.</p></div>';
        return;
    }

    grid.innerHTML = suppliers.map(s => `
        <div class="entity-card supplier-card">
            <div class="entity-header">
                <div class="entity-icon">🏭</div>
                <div class="entity-info">
                    <h3>${s.nom}</h3>
                    <span class="entity-badge">${s.code}</span>
                </div>
                <div class="entity-actions">
                    <button class="btn btn-sm btn-outline" onclick="SuppliersModule.edit('${s.id}')">✏️</button>
                    <button class="btn btn-sm btn-outline" onclick="SuppliersModule.remove('${s.id}')">🗑️</button>
                </div>
            </div>
            <div class="entity-details">
                <div class="detail-row"><span>📞</span><span>${s.telephone || '-'}</span></div>
                <div class="detail-row"><span>📧</span><span>${s.email || '-'}</span></div>
                <div class="detail-row"><span>📍</span><span>${s.adresse || '-'}</span></div>
            </div>
            <div class="entity-footer">
                <span class="solde ${s.solde >= 0 ? 'result-positive' : 'result-negative'}">
                    Solde: ${(s.solde || 0).toLocaleString('fr-FR')} TND
                </span>
            </div>
        </div>
    `).join('');
}

async function openModal(supplierId = null) {
    const supplier = supplierId ? getSupplierById(supplierId) : null;
    const title = supplier ? 'Modifier Fournisseur' : 'Nouveau Fournisseur';
    const code = supplier?.code || generateCode();

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <form id="supplierForm">
            <input type="hidden" id="supplierId" value="${supplier?.id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>Code</label>
                    <input type="text" id="supplierCode" value="${code}" readonly>
                </div>
                <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" id="supplierNom" value="${supplier?.nom || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="tel" id="supplierTel" value="${supplier?.telephone || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="supplierEmail" value="${supplier?.email || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Adresse</label>
                <textarea id="supplierAdresse" rows="2">${supplier?.adresse || ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Matricule Fiscale</label>
                    <input type="text" id="supplierMF" value="${supplier?.matriculeFiscale || ''}" placeholder="Ex: 1234567/A/B/C/000">
                </div>
                <div class="form-group">
                    <label>RIB</label>
                    <input type="text" id="supplierRib" value="${supplier?.rib || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Solde Initial (TND)</label>
                    <input type="number" id="supplierSolde" value="${supplier?.solde || 0}" step="0.001">
                </div>
            </div>
        </form>
    `;
    document.getElementById('modalSave').onclick = saveSupplier;
    App.showModal();
}

async function saveSupplier() {
    const supplier = {
        id: document.getElementById('supplierId').value || `supplier_${Date.now()}`,
        code: document.getElementById('supplierCode').value,
        nom: document.getElementById('supplierNom').value,
        telephone: document.getElementById('supplierTel').value,
        email: document.getElementById('supplierEmail').value,
        adresse: document.getElementById('supplierAdresse').value,
        matriculeFiscale: document.getElementById('supplierMF').value,
        rib: document.getElementById('supplierRib').value,
        solde: parseFloat(document.getElementById('supplierSolde').value) || 0,
        updatedAt: new Date().toISOString()
    };

    if (!supplier.nom) {
        alert('Le nom est obligatoire');
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.suppliers, supplier.id), supplier);
        App.hideModal();
        await refresh();
    } catch (error) {
        console.error('Error saving supplier:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

function edit(id) { openModal(id); }

async function remove(id) {
    if (confirm('Supprimer ce fournisseur ?')) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.suppliers, id));
            await refresh();
        } catch (error) {
            console.error('Error deleting supplier:', error);
        }
    }
}

// ========== DEMANDES D'ACHAT ==========
async function loadDemandes() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.demandesAchat));
        demandesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        demandesCache.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        _demandesLoaded = true;
        return demandesCache;
    } catch (error) {
        console.error('Error loading demandes:', error);
        return [];
    }
}

async function getDemandes() {
    if (!_demandesLoaded) await loadDemandes();
    return demandesCache;
}

function getDemandeById(id) {
    return demandesCache.find(d => d.id === id);
}

async function saveDemande(demande) {
    const id = demande.id || `da_${Date.now()}`;
    demande.id = id;
    demande.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.demandesAchat, id), demande);
    await loadDemandes();
    return demande;
}

async function deleteDemande(id) {
    await deleteDoc(doc(db, COLLECTIONS.demandesAchat, id));
    await loadDemandes();
}

// ========== BON COMMANDES ==========
async function loadCommandes() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.bonCommandesAchat));
        commandesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        commandesCache.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        _commandesLoaded = true;
        return commandesCache;
    } catch (error) {
        console.error('Error loading commandes:', error);
        return [];
    }
}

async function getCommandes() {
    if (!_commandesLoaded) await loadCommandes();
    return commandesCache;
}

function getCommandeById(id) {
    return commandesCache.find(c => c.id === id);
}

async function saveCommande(commande) {
    const id = commande.id || `bc_${Date.now()}`;
    commande.id = id;
    commande.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.bonCommandesAchat, id), commande);
    await loadCommandes();
    return commande;
}

async function deleteCommande(id) {
    await deleteDoc(doc(db, COLLECTIONS.bonCommandesAchat, id));
    await loadCommandes();
}

// ========== BON LIVRAISONS ==========
async function loadLivraisons() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.bonLivraisonsAchat));
        livraisonsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        livraisonsCache.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        _livraisonsLoaded = true;
        return livraisonsCache;
    } catch (error) {
        console.error('Error loading livraisons:', error);
        return [];
    }
}

async function getLivraisons() {
    if (!_livraisonsLoaded) await loadLivraisons();
    return livraisonsCache;
}

function getLivraisonById(id) {
    return livraisonsCache.find(l => l.id === id);
}

async function saveLivraison(livraison) {
    const id = livraison.id || `bl_${Date.now()}`;
    livraison.id = id;
    livraison.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.bonLivraisonsAchat, id), livraison);
    await loadLivraisons();
    return livraison;
}

async function deleteLivraison(id) {
    await deleteDoc(doc(db, COLLECTIONS.bonLivraisonsAchat, id));
    await loadLivraisons();
}

// ========== FACTURES ACHAT ==========
async function loadFactures() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.facturesAchat));
        facturesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        facturesCache.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        _facturesLoaded = true;
        return facturesCache;
    } catch (error) {
        console.error('Error loading factures:', error);
        return [];
    }
}

async function getFactures() {
    if (!_facturesLoaded) await loadFactures();
    return facturesCache;
}

function getFactureById(id) {
    return facturesCache.find(f => f.id === id);
}

async function saveFacture(facture) {
    const id = facture.id || `fa_${Date.now()}`;
    facture.id = id;
    facture.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.facturesAchat, id), facture);
    await loadFactures();
    return facture;
}

async function deleteFacture(id) {
    await deleteDoc(doc(db, COLLECTIONS.facturesAchat, id));
    await loadFactures();
}

// ========== BONS DE SORTIE ==========
let sortiesCache = [];

async function loadSorties() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.bonsSortie));
        sortiesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _sortiesLoaded = true;
        return sortiesCache;
    } catch (error) {
        console.error('Error loading sorties:', error);
        return [];
    }
}

async function getSorties() {
    if (!_sortiesLoaded) await loadSorties();
    return sortiesCache;
}

function getSortieById(id) {
    return sortiesCache.find(s => s.id === id);
}

async function saveSortie(sortie) {
    const id = sortie.id || `bs_${Date.now()}`;
    sortie.id = id;
    sortie.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.bonsSortie, id), sortie);
    await loadSorties();
}

async function deleteSortie(id) {
    await deleteDoc(doc(db, COLLECTIONS.bonsSortie, id));
    await loadSorties();
}

// ========== BONS DE RETOUR FOURNISSEUR ==========
let retoursCache = [];
let _retoursLoaded = false;

async function loadRetours() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.bonsRetour));
        retoursCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        retoursCache.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        _retoursLoaded = true;
        return retoursCache;
    } catch (error) {
        console.error('Error loading retours:', error);
        return [];
    }
}

async function getRetours() {
    if (!_retoursLoaded) await loadRetours();
    return retoursCache;
}

function getRetourById(id) {
    return retoursCache.find(r => r.id === id);
}

async function saveRetour(retour) {
    const id = retour.id || `br_${Date.now()}`;
    retour.id = id;
    retour.updatedAt = new Date().toISOString();
    await setDoc(doc(db, COLLECTIONS.bonsRetour, id), retour);
    await loadRetours();
    return retour;
}

async function deleteRetour(id) {
    await deleteDoc(doc(db, COLLECTIONS.bonsRetour, id));
    await loadRetours();
}

// ========== RELOAD ALL ==========
async function reloadAll() {
    await Promise.all([loadSuppliers(), loadDemandes(), loadCommandes(), loadLivraisons(), loadFactures(), loadSorties(), loadRetours()]);
}

export const SuppliersModule = {
    init, refresh, reloadAll,
    // Suppliers
    getSuppliers, getSupplierById, edit, remove,
    // Demandes d'Achat
    loadDemandes, getDemandes, getDemandeById, saveDemande, deleteDemande,
    // Bon Commandes
    loadCommandes, getCommandes, getCommandeById, saveCommande, deleteCommande,
    // Bon Livraisons
    loadLivraisons, getLivraisons, getLivraisonById, saveLivraison, deleteLivraison,
    // Factures
    loadFactures, getFactures, getFactureById, saveFacture, deleteFacture,
    // Bons de Sortie
    loadSorties, getSorties, getSortieById, saveSortie, deleteSortie,
    // Bons de Retour
    loadRetours, getRetours, getRetourById, saveRetour, deleteRetour
};
window.SuppliersModule = SuppliersModule;
