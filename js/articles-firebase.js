/**
 * ARTICLES MODULE - FIREBASE VERSION
 * Gestion des Produits/Articles (Achat & Vente)
 */

import { db, collection, doc, getDocs, setDoc, deleteDoc, COLLECTIONS } from './firebase.js';

let cache = [];
let _loaded = false;

async function init() {
    document.getElementById('addArticleAchatBtn')?.addEventListener('click', () => openModal(null, 'achat'));
    document.getElementById('addArticleVenteBtn')?.addEventListener('click', () => openModal(null, 'vente'));
    await loadArticles();
}

async function loadArticles() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.articles));
        cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _loaded = true;
        return cache;
    } catch (error) {
        console.error('Error loading articles:', error);
        return [];
    }
}

async function getArticles() {
    if (!_loaded) await loadArticles();
    return cache;
}

function getArticleById(id) {
    return cache.find(a => a.id === id);
}

function getArticleByRef(ref) {
    return cache.find(a => a.reference === ref);
}

function getArticlesByType(type) {
    return cache.filter(a => (a.type || 'achat') === type);
}

async function refreshAchat() {
    await loadArticles();
    renderArticlesAchat();
}

async function refreshVente() {
    await loadArticles();
    renderArticlesVente();
}

async function refresh() {
    await loadArticles();
}

function generateReference(type) {
    const prefix = type === 'vente' ? 'AV' : 'AA';
    const filtered = cache.filter(a => (a.type || 'achat') === type);
    const num = String(filtered.length + 1).padStart(4, '0');
    return `${prefix}${num}`;
}

// ==================== RENDER ARTICLES ACHAT ====================
function renderArticlesAchat() {
    const articles = getArticlesByType('achat');
    const container = document.getElementById('articlesAchatTable');
    if (!container) return;

    if (articles.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px">Aucun article d\'achat</td></tr>';
        return;
    }

    container.innerHTML = articles.map(a => `
        <tr>
            <td><strong>${a.reference}</strong></td>
            <td>${a.designation}</td>
            <td>${a.categorie || '-'}</td>
            <td>${a.unite || 'Unité'}</td>
            <td>${(a.prixAchat || 0).toLocaleString('fr-FR')} TND</td>
            <td class="${a.stock > 10 ? 'result-positive' : a.stock > 0 ? 'result-warning' : 'result-negative'}">
                ${a.stock || 0}
            </td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="ArticlesModule.edit('${a.id}')">✏️</button>
                <button class="btn btn-sm btn-outline" onclick="ArticlesModule.remove('${a.id}', 'achat')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ==================== RENDER ARTICLES VENTE ====================
function renderArticlesVente() {
    const articles = getArticlesByType('vente');
    const container = document.getElementById('articlesVenteTable');
    if (!container) return;

    if (articles.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px">Aucun article de vente</td></tr>';
        return;
    }

    container.innerHTML = articles.map(a => `
        <tr>
            <td><strong>${a.reference}</strong></td>
            <td>${a.designation}</td>
            <td>${a.categorie || '-'}</td>
            <td>${a.unite || 'Unité'}</td>
            <td>${(a.prixVente || 0).toLocaleString('fr-FR')} TND</td>
            <td class="${a.stock > 10 ? 'result-positive' : a.stock > 0 ? 'result-warning' : 'result-negative'}">
                ${a.stock || 0}
            </td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="ArticlesModule.edit('${a.id}')">✏️</button>
                <button class="btn btn-sm btn-outline" onclick="ArticlesModule.remove('${a.id}', 'vente')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ==================== MODAL ====================
async function openModal(articleId = null, type = 'achat') {
    const article = articleId ? getArticleById(articleId) : null;
    const articleType = article?.type || type;
    const title = article ? 'Modifier Article' : (articleType === 'vente' ? 'Nouvel Article de Vente' : 'Nouvel Article d\'Achat');
    const ref = article?.reference || generateReference(articleType);

    const categoriesAchat = ['Pièces', 'Lubrifiants', 'Pneus', 'Carburant', 'Fournitures', 'Autre'];
    const categoriesVente = ['Produit fini', 'Service', 'Transport', 'Autre'];
    const categories = articleType === 'vente' ? categoriesVente : categoriesAchat;

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <form id="articleForm">
            <input type="hidden" id="articleId" value="${article?.id || ''}">
            <input type="hidden" id="articleType" value="${articleType}">
            <div class="form-row">
                <div class="form-group">
                    <label>Référence</label>
                    <input type="text" id="articleRef" value="${ref}" readonly>
                </div>
                <div class="form-group">
                    <label>Désignation *</label>
                    <input type="text" id="articleDesignation" value="${article?.designation || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Catégorie</label>
                    <select id="articleCategorie">
                        <option value="">-- Sélectionner --</option>
                        ${categories.map(c => `<option value="${c}" ${article?.categorie === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Unité</label>
                    <select id="articleUnite">
                        <option value="Unité" ${article?.unite === 'Unité' ? 'selected' : ''}>Unité</option>
                        <option value="Litre" ${article?.unite === 'Litre' ? 'selected' : ''}>Litre</option>
                        <option value="Kg" ${article?.unite === 'Kg' ? 'selected' : ''}>Kg</option>
                        <option value="Mètre" ${article?.unite === 'Mètre' ? 'selected' : ''}>Mètre</option>
                        <option value="Tonne" ${article?.unite === 'Tonne' ? 'selected' : ''}>Tonne</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Prix Achat (TND)</label>
                    <input type="number" id="articlePrixAchat" value="${article?.prixAchat || 0}" step="0.001" min="0">
                </div>
                <div class="form-group">
                    <label>Prix Vente (TND)</label>
                    <input type="number" id="articlePrixVente" value="${article?.prixVente || 0}" step="0.001" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stock Initial</label>
                    <input type="number" id="articleStock" value="${article?.stock || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>Stock Minimum</label>
                    <input type="number" id="articleStockMin" value="${article?.stockMin || 5}" min="0">
                </div>
            </div>
        </form>
    `;
    document.getElementById('modalSave').onclick = saveArticle;
    App.showModal();
}

async function saveArticle() {
    const articleType = document.getElementById('articleType').value || 'achat';
    const article = {
        id: document.getElementById('articleId').value || `article_${Date.now()}`,
        reference: document.getElementById('articleRef').value,
        designation: document.getElementById('articleDesignation').value,
        categorie: document.getElementById('articleCategorie').value,
        unite: document.getElementById('articleUnite').value,
        type: articleType,
        prixAchat: parseFloat(document.getElementById('articlePrixAchat').value) || 0,
        prixVente: parseFloat(document.getElementById('articlePrixVente').value) || 0,
        stock: parseInt(document.getElementById('articleStock').value) || 0,
        stockMin: parseInt(document.getElementById('articleStockMin').value) || 5,
        updatedAt: new Date().toISOString()
    };

    if (!article.designation) {
        alert('La désignation est obligatoire');
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.articles, article.id), article);
        App.hideModal();
        if (articleType === 'vente') await refreshVente();
        else await refreshAchat();
    } catch (error) {
        console.error('Error saving article:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

function edit(id) {
    const article = getArticleById(id);
    openModal(id, article?.type || 'achat');
}

async function remove(id, type = 'achat') {
    if (confirm('Supprimer cet article ?')) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.articles, id));
            if (type === 'vente') await refreshVente();
            else await refreshAchat();
        } catch (error) {
            console.error('Error deleting article:', error);
        }
    }
}

export const ArticlesModule = {
    init, refresh, refreshAchat, refreshVente,
    getArticles, getArticleById, getArticleByRef, getArticlesByType,
    edit, remove
};
window.ArticlesModule = ArticlesModule;
