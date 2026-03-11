/**
 * INVENTORY MODULE - FIREBASE VERSION
 * Stock management with full movement history
 * Tracks: BL Achat (entree), BL Vente (sortie), manual adjustments
 */

import { db, collection, doc, getDocs, setDoc, query, orderBy, COLLECTIONS } from './firebase.js';
import { ArticlesModule } from './articles-firebase.js';
import { SuppliersModule } from './suppliers-firebase.js';
import { ClientsModule } from './clients-firebase.js';

let _movements = [];
let _loaded = false;

async function init() {
    await loadMovements();
}

// ==================== LOAD MOVEMENTS ====================
async function loadMovements() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.stockMovements));
        _movements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _movements.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
        _loaded = true;
    } catch (err) {
        console.error('Error loading stock movements:', err);
        _movements = [];
    }
}

// ==================== RECORD STOCK MOVEMENT ====================
/**
 * Record a stock movement and update article stock
 * @param {Object} params
 * @param {string} params.articleId - Article ID
 * @param {string} params.articleDesignation - Article designation
 * @param {string} params.type - 'entree' | 'sortie' | 'ajustement'
 * @param {number} params.quantite - Quantity moved (always positive)
 * @param {number} params.prixUnitaire - Unit price at time of movement
 * @param {string} params.documentType - e.g. 'BL Achat', 'BL Vente'
 * @param {string} params.documentNumero - Document number
 * @param {string} params.documentId - Document ID
 * @param {string} params.tiersId - Supplier or Client ID
 * @param {string} params.tiersNom - Supplier or Client name
 * @param {string} params.date - Date string YYYY-MM-DD
 */
async function recordMovement(params) {
    try {
        // Get current stock
        const article = ArticlesModule.getArticleById(params.articleId);
        const stockBefore = article?.stock || 0;
        let stockAfter = stockBefore;

        if (params.type === 'entree') {
            stockAfter = stockBefore + params.quantite;
        } else if (params.type === 'sortie') {
            stockAfter = Math.max(0, stockBefore - params.quantite);
        } else if (params.type === 'ajustement') {
            stockAfter = params.quantite; // Direct set
        }

        const mvtId = `mvt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const movement = {
            id: mvtId,
            articleId: params.articleId,
            articleDesignation: params.articleDesignation || article?.designation || '',
            articleReference: article?.reference || '',
            type: params.type,
            quantite: params.quantite,
            prixUnitaire: params.prixUnitaire || 0,
            stockBefore,
            stockAfter,
            documentType: params.documentType || '',
            documentNumero: params.documentNumero || '',
            documentId: params.documentId || '',
            tiersId: params.tiersId || '',
            tiersNom: params.tiersNom || '',
            date: params.date || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };

        // Save movement
        await setDoc(doc(db, COLLECTIONS.stockMovements, mvtId), movement);

        // Update article stock
        if (article) {
            await setDoc(doc(db, COLLECTIONS.articles, article.id), {
                ...article,
                stock: stockAfter,
                updatedAt: new Date().toISOString()
            });
        }

        console.log(`📦 Stock mouvement: ${params.type} ${params.quantite} x ${params.articleDesignation} → stock: ${stockBefore} → ${stockAfter}`);
        return movement;
    } catch (err) {
        console.error('Error recording stock movement:', err);
        throw err;
    }
}

/**
 * Record stock movements for all lines in a BL
 * @param {Array} lignes - BL lines with articleId, quantite/quantiteRecue/quantiteLivree
 * @param {string} type - 'entree' (achat) or 'sortie' (vente)
 * @param {Object} docInfo - { documentType, documentNumero, documentId, tiersId, tiersNom, date }
 */
async function recordBLMovements(lignes, type, docInfo) {
    for (const ligne of lignes) {
        const articleId = ligne.articleId;
        if (!articleId) continue;

        const qte = ligne.quantiteRecue || ligne.quantiteLivree || ligne.quantite || 0;
        if (qte <= 0) continue;

        await recordMovement({
            articleId,
            articleDesignation: ligne.nom || ligne.designation || '',
            type,
            quantite: qte,
            prixUnitaire: ligne.prixUnitaire || 0,
            ...docInfo
        });
    }
}

// ==================== RENDER KPIs ====================
function renderKPIs() {
    const articles = ArticlesModule.getArticles ? ArticlesModule.getArticles() : [];
    const allArticles = Array.isArray(articles) ? articles : [];

    const totalArticles = allArticles.length;
    const totalStock = allArticles.reduce((s, a) => s + (a.stock || 0), 0);
    const totalValue = allArticles.reduce((s, a) => s + ((a.stock || 0) * (a.prixAchat || 0)), 0);
    const lowStock = allArticles.filter(a => (a.stock || 0) <= (a.stockMin || 5) && (a.stock || 0) > 0).length;
    const outOfStock = allArticles.filter(a => (a.stock || 0) === 0).length;

    const kpisEl = document.getElementById('inventaireKPIs');
    if (!kpisEl) return;

    kpisEl.innerHTML = `
        <div class="kpi-card" style="border-left:3px solid #3b82f6">
            <div class="kpi-icon">📦</div>
            <div class="kpi-content">
                <span class="kpi-label">Articles</span>
                <span class="kpi-value">${totalArticles}</span>
                <span class="kpi-trend">${totalStock} unités en stock</span>
            </div>
        </div>
        <div class="kpi-card" style="border-left:3px solid #10b981">
            <div class="kpi-icon">💰</div>
            <div class="kpi-content">
                <span class="kpi-label">Valeur du Stock</span>
                <span class="kpi-value">${totalValue.toFixed(3)}</span>
                <span class="kpi-trend">TND</span>
            </div>
        </div>
        <div class="kpi-card" style="border-left:3px solid #f59e0b">
            <div class="kpi-icon">⚠️</div>
            <div class="kpi-content">
                <span class="kpi-label">Stock Faible</span>
                <span class="kpi-value">${lowStock}</span>
                <span class="kpi-trend">articles à réapprovisionner</span>
            </div>
        </div>
        <div class="kpi-card" style="border-left:3px solid #ef4444">
            <div class="kpi-icon">🚫</div>
            <div class="kpi-content">
                <span class="kpi-label">Rupture de Stock</span>
                <span class="kpi-value">${outOfStock}</span>
                <span class="kpi-trend">articles épuisés</span>
            </div>
        </div>
    `;
}

// ==================== RENDER STOCK TABLE ====================
async function renderStockTable() {
    const tbody = document.getElementById('inventaireStockBody');
    if (!tbody) return;

    let articles = [];
    try {
        articles = await ArticlesModule.getArticles();
    } catch {
        articles = [];
    }
    if (!Array.isArray(articles)) articles = [];

    // Filters
    const typeFilter = document.getElementById('inventaireTypeFilter')?.value || '';
    const search = (document.getElementById('inventaireSearch')?.value || '').toLowerCase();

    let filtered = articles;
    if (typeFilter) {
        filtered = filtered.filter(a => a.type === typeFilter);
    }
    if (search) {
        filtered = filtered.filter(a =>
            (a.reference || '').toLowerCase().includes(search) ||
            (a.designation || '').toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:40px">Aucun article trouvé</td></tr>';
        return;
    }

    // Get last entry/exit dates per article from movements
    const lastEntry = {};
    const lastExit = {};
    _movements.forEach(m => {
        if (m.type === 'entree' && (!lastEntry[m.articleId] || m.date > lastEntry[m.articleId])) {
            lastEntry[m.articleId] = m.date;
        }
        if (m.type === 'sortie' && (!lastExit[m.articleId] || m.date > lastExit[m.articleId])) {
            lastExit[m.articleId] = m.date;
        }
    });

    tbody.innerHTML = filtered.map(a => {
        const stock = a.stock || 0;
        const prixAchat = a.prixAchat || 0;
        const valeur = stock * prixAchat;
        const stockClass = stock === 0 ? 'color:#ef4444;font-weight:700' :
            stock <= (a.stockMin || 5) ? 'color:#f59e0b;font-weight:600' : 'color:#10b981;font-weight:600';
        const typeLabel = a.type === 'achat' ? '🛒 Achat' : a.type === 'vente' ? '🛍️ Vente' : a.type || '-';

        return `
            <tr>
                <td><strong>${a.reference || '-'}</strong></td>
                <td>${a.designation || '-'}</td>
                <td>${typeLabel}</td>
                <td style="${stockClass}">${stock}</td>
                <td>${prixAchat.toFixed(3)} TND</td>
                <td><strong>${valeur.toFixed(3)} TND</strong></td>
                <td>${lastEntry[a.id] ? formatDate(lastEntry[a.id]) : '-'}</td>
                <td>${lastExit[a.id] ? formatDate(lastExit[a.id]) : '-'}</td>
                <td>
                    <button class="btn-icon" onclick="InventaireModule.showArticleHistory('${a.id}')" title="Historique">📋</button>
                    <button class="btn-icon" onclick="InventaireModule.adjustStock('${a.id}')" title="Ajustement">⚙️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==================== RENDER MOVEMENTS TABLE ====================
async function renderMovements() {
    const tbody = document.getElementById('inventaireMvtBody');
    if (!tbody) return;

    if (!_loaded) await loadMovements();

    const startDate = document.getElementById('mvtDateStart')?.value || '';
    const endDate = document.getElementById('mvtDateEnd')?.value || '';
    const typeFilter = document.getElementById('mvtTypeFilter')?.value || '';

    let filtered = [..._movements];
    if (startDate) filtered = filtered.filter(m => m.date >= startDate);
    if (endDate) filtered = filtered.filter(m => m.date <= endDate);
    if (typeFilter) filtered = filtered.filter(m => m.type === typeFilter);

    // Limit to 100 latest
    filtered = filtered.slice(0, 100);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:40px">Aucun mouvement trouvé</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(m => {
        const typeIcon = m.type === 'entree' ? '↗️' : m.type === 'sortie' ? '↘️' : '🔄';
        const typeColor = m.type === 'entree' ? '#10b981' : m.type === 'sortie' ? '#ef4444' : '#f59e0b';
        const qteSign = m.type === 'entree' ? '+' : m.type === 'sortie' ? '-' : '';

        return `
            <tr>
                <td>${formatDate(m.date)}</td>
                <td><strong>${m.articleDesignation || m.articleReference || '-'}</strong></td>
                <td style="color:${typeColor};font-weight:600">${typeIcon} ${m.type === 'entree' ? 'Entrée' : m.type === 'sortie' ? 'Sortie' : 'Ajustement'}</td>
                <td style="color:${typeColor};font-weight:700">${qteSign}${m.quantite}</td>
                <td>${(m.prixUnitaire || 0).toFixed(3)} TND</td>
                <td>${m.stockBefore ?? '-'}</td>
                <td><strong>${m.stockAfter ?? '-'}</strong></td>
                <td>${m.documentType ? `${m.documentType} ${m.documentNumero || ''}` : '-'}</td>
                <td>${m.tiersNom || '-'}</td>
            </tr>
        `;
    }).join('');
}

// ==================== SHOW ARTICLE HISTORY ====================
function showArticleHistory(articleId) {
    const article = ArticlesModule.getArticleById(articleId);
    const artMvts = _movements.filter(m => m.articleId === articleId);

    const html = `
        <div style="max-height:60vh;overflow:auto">
            <div style="margin-bottom:16px;padding:12px;background:rgba(59,130,246,0.1);border-radius:8px">
                <strong>${article?.designation || 'Article'}</strong> — Réf: ${article?.reference || '-'}<br>
                <span style="color:#10b981;font-weight:600">Stock actuel: ${article?.stock || 0}</span>
            </div>
            <table class="data-table" style="font-size:0.85rem">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Qté</th>
                        <th>Stock→</th>
                        <th>Document</th>
                        <th>Tiers</th>
                    </tr>
                </thead>
                <tbody>
                    ${artMvts.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#64748b">Aucun mouvement</td></tr>' :
            artMvts.map(m => {
                const color = m.type === 'entree' ? '#10b981' : m.type === 'sortie' ? '#ef4444' : '#f59e0b';
                return `<tr>
                                <td>${formatDate(m.date)}</td>
                                <td style="color:${color};font-weight:600">${m.type === 'entree' ? '↗ Entrée' : m.type === 'sortie' ? '↘ Sortie' : '🔄 Ajust.'}</td>
                                <td style="font-weight:700">${m.type === 'entree' ? '+' : m.type === 'sortie' ? '-' : ''}${m.quantite}</td>
                                <td>${m.stockBefore} → <strong>${m.stockAfter}</strong></td>
                                <td>${m.documentType} ${m.documentNumero || ''}</td>
                                <td>${m.tiersNom || '-'}</td>
                            </tr>`;
            }).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('modalTitle').textContent = `📋 Historique: ${article?.designation || 'Article'}`;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalSave').style.display = 'none';
    document.getElementById('modalCancel').textContent = 'Fermer';
    App.showModal();
}

// ==================== MANUAL STOCK ADJUSTMENT ====================
function adjustStock(articleId) {
    const article = ArticlesModule.getArticleById(articleId);
    if (!article) return;

    document.getElementById('modalTitle').textContent = `⚙️ Ajustement Stock: ${article.designation}`;
    document.getElementById('modalBody').innerHTML = `
        <div style="padding:12px">
            <div style="margin-bottom:16px;padding:12px;background:rgba(59,130,246,0.1);border-radius:8px">
                <strong>${article.designation}</strong> — Réf: ${article.reference || '-'}<br>
                Stock actuel: <strong style="color:#10b981">${article.stock || 0}</strong>
            </div>
            <div class="form-group">
                <label>Nouveau stock</label>
                <input type="number" id="adjustNewStock" value="${article.stock || 0}" min="0" class="form-control">
            </div>
            <div class="form-group">
                <label>Raison de l'ajustement</label>
                <input type="text" id="adjustReason" placeholder="Inventaire physique, correction, etc." class="form-control">
            </div>
        </div>
    `;
    document.getElementById('modalSave').style.display = '';
    document.getElementById('modalSave').onclick = async () => {
        const newStock = parseInt(document.getElementById('adjustNewStock').value) || 0;
        const reason = document.getElementById('adjustReason').value || 'Ajustement manuel';

        try {
            await recordMovement({
                articleId: article.id,
                articleDesignation: article.designation,
                type: 'ajustement',
                quantite: newStock,
                prixUnitaire: article.prixAchat || 0,
                documentType: 'Ajustement',
                documentNumero: reason,
                date: new Date().toISOString().split('T')[0]
            });

            await ArticlesModule.refresh();
            await refresh();
            App.hideModal();
            alert(`✅ Stock de "${article.designation}" ajusté à ${newStock}`);
        } catch (err) {
            alert('Erreur: ' + err.message);
        }
    };
    App.showModal();
}

// ==================== REFRESH ====================
async function refresh() {
    await loadMovements();
    renderKPIs();
    await renderStockTable();
    // Set default dates if empty
    if (!document.getElementById('mvtDateStart')?.value) {
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        const startEl = document.getElementById('mvtDateStart');
        const endEl = document.getElementById('mvtDateEnd');
        if (startEl) startEl.value = start.toISOString().split('T')[0];
        if (endEl) endEl.value = today.toISOString().split('T')[0];
    }
    await renderMovements();
}

async function refreshMovements() {
    await renderMovements();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR');
}

export const InventaireModule = {
    init,
    refresh,
    refreshMovements,
    recordMovement,
    recordBLMovements,
    showArticleHistory,
    adjustStock
};
window.InventaireModule = InventaireModule;
