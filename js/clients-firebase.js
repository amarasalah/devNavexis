/**
 * CLIENTS MODULE - FIREBASE VERSION
 * Gestion des Clients (Vente)
 */

import { db, collection, doc, getDocs, setDoc, deleteDoc, COLLECTIONS } from './firebase.js';

let cache = [];
let _loaded = false;

async function init() {
    document.getElementById('addClientBtn')?.addEventListener('click', () => openModal());
    await loadClients();
}

async function loadClients() {
    try {
        const snap = await getDocs(collection(db, COLLECTIONS.clients));
        cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _loaded = true;
        return cache;
    } catch (error) {
        console.error('Error loading clients:', error);
        return [];
    }
}

async function getClients() {
    if (!_loaded) await loadClients();
    return cache;
}

function getClientById(id) {
    return cache.find(c => c.id === id);
}

async function refresh() {
    await loadClients();
    await renderClients();
}

function generateCode() {
    const year = new Date().getFullYear().toString().slice(-2);
    const num = String(cache.length + 1).padStart(6, '0');
    return `CL${year}${num}`;
}

async function renderClients() {
    const clients = await getClients();
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;

    if (clients.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>Aucun client. Cliquez sur + pour ajouter.</p></div>';
        return;
    }

    grid.innerHTML = clients.map(c => {
        const locLabel = c.delegation ? `${c.delegation}, ${c.gouvernorat || ''}` : (c.gouvernorat || c.adresse || '-');
        const gpsLabel = (c.lat && c.lng) ? `<span style="color:#8b5cf6;font-size:11px;margin-left:4px">(GPS ✓)</span>` : '';
        return `
        <div class="entity-card client-card">
            <div class="entity-header">
                <div class="entity-icon">👥</div>
                <div class="entity-info">
                    <h3>${c.nom}</h3>
                    <span class="entity-badge">${c.code}</span>
                </div>
                <div class="entity-actions">
                    <button class="btn btn-sm btn-outline" onclick="ClientsModule.edit('${c.id}')">✏️</button>
                    <button class="btn btn-sm btn-outline" onclick="ClientsModule.remove('${c.id}')">🗑️</button>
                </div>
            </div>
            <div class="entity-details">
                <div class="detail-row"><span>📞</span><span>${c.telephone || '-'}</span></div>
                <div class="detail-row"><span>📧</span><span>${c.email || '-'}</span></div>
                <div class="detail-row"><span>📍</span><span>${locLabel}${gpsLabel}</span></div>
            </div>
            <div class="entity-footer">
                <span class="solde ${c.solde >= 0 ? 'result-positive' : 'result-negative'}">
                    Solde: ${(c.solde || 0).toLocaleString('fr-FR')} TND
                </span>
            </div>
        </div>`;
    }).join('');
}

async function openModal(clientId = null) {
    const client = clientId ? getClientById(clientId) : null;
    const title = client ? 'Modifier Client' : 'Nouveau Client';
    const code = client?.code || generateCode();

    const gouvernorats = typeof getGouvernorats === 'function' ? getGouvernorats() : [];
    const gouvOptions = gouvernorats.map(g => `<option value="${g}" ${client?.gouvernorat === g ? 'selected' : ''}>${g}</option>`).join('');
    const delegations = client?.gouvernorat && typeof getDelegations === 'function' ? getDelegations(client.gouvernorat) : [];
    const delOptions = delegations.map(d => `<option value="${d}" ${client?.delegation === d ? 'selected' : ''}>${d}</option>`).join('');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <form id="clientForm">
            <input type="hidden" id="clientId" value="${client?.id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>Code</label>
                    <input type="text" id="clientCode" value="${code}" readonly>
                </div>
                <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" id="clientNom" value="${client?.nom || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="tel" id="clientTel" value="${client?.telephone || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="clientEmail" value="${client?.email || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Adresse</label>
                <textarea id="clientAdresse" rows="2">${client?.adresse || ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Matricule Fiscale</label>
                    <input type="text" id="clientMF" value="${client?.matriculeFiscale || ''}" placeholder="Ex: 1234567/A/B/C/000">
                </div>
                <div class="form-group">
                    <label>RIB</label>
                    <input type="text" id="clientRib" value="${client?.rib || ''}">
                </div>
                <div class="form-group">
                    <label>Solde Initial (TND)</label>
                    <input type="number" id="clientSolde" value="${client?.solde || 0}" step="0.001">
                </div>
            </div>

            <!-- Location Section (optional) -->
            <div style="background:rgba(139,92,246,0.08);border-radius:8px;padding:16px;margin-top:12px;border-left:4px solid #8b5cf6">
                <h4 style="margin-bottom:12px;color:#8b5cf6">📍 Localisation (optionnel)</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Gouvernorat</label>
                        <select id="clientGouvernorat" onchange="ClientsModule.onGouvernoratChange()">
                            <option value="">-- Aucun --</option>
                            ${gouvOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Délégation</label>
                        <select id="clientDelegation" onchange="ClientsModule.onDelegationChange()">
                            <option value="">-- Sélectionner --</option>
                            ${delOptions}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Latitude</label>
                        <input type="number" id="clientLat" value="${client?.lat || ''}" step="0.000001" placeholder="Ex: 36.8065">
                    </div>
                    <div class="form-group">
                        <label>Longitude</label>
                        <input type="number" id="clientLng" value="${client?.lng || ''}" step="0.000001" placeholder="Ex: 10.1815">
                    </div>
                </div>
                <div id="clientMapContainer" style="height:250px;border-radius:8px;margin-top:8px;background:#1e293b;position:relative">
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#64748b;font-size:13px;z-index:0">Chargement de la carte...</div>
                </div>
                <small style="color:#64748b;margin-top:4px;display:block">Cliquez sur la carte pour placer le marqueur, ou sélectionnez gouvernorat/délégation.</small>
            </div>
        </form>
    `;
    document.getElementById('modalSave').onclick = saveClient;
    App.showModal();

    // Initialize map picker after modal is visible
    setTimeout(() => initClientMap(client), 200);
}

let clientMap = null;
let clientMarker = null;

function initClientMap(client) {
    const container = document.getElementById('clientMapContainer');
    if (!container || typeof L === 'undefined') return;

    // Clean previous map and marker
    if (clientMap) { clientMap.remove(); clientMap = null; }
    clientMarker = null;

    const lat = parseFloat(client?.lat) || 36.8065;
    const lng = parseFloat(client?.lng) || 10.1815;
    const zoom = (client?.lat && client?.lng) ? 13 : 7;

    clientMap = L.map(container).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM', maxZoom: 18
    }).addTo(clientMap);

    if (client?.lat && client?.lng) {
        clientMarker = L.marker([lat, lng], { draggable: true }).addTo(clientMap);
        clientMarker.on('dragend', () => {
            const pos = clientMarker.getLatLng();
            document.getElementById('clientLat').value = pos.lat.toFixed(6);
            document.getElementById('clientLng').value = pos.lng.toFixed(6);
        });
    }

    clientMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('clientLat').value = lat.toFixed(6);
        document.getElementById('clientLng').value = lng.toFixed(6);
        if (clientMarker) {
            clientMarker.setLatLng([lat, lng]);
        } else {
            clientMarker = L.marker([lat, lng], { draggable: true }).addTo(clientMap);
            clientMarker.on('dragend', () => {
                const pos = clientMarker.getLatLng();
                document.getElementById('clientLat').value = pos.lat.toFixed(6);
                document.getElementById('clientLng').value = pos.lng.toFixed(6);
            });
        }
    });

    // Fix map size after modal animation
    setTimeout(() => clientMap.invalidateSize(), 300);
}

function onGouvernoratChange() {
    const gouv = document.getElementById('clientGouvernorat')?.value;
    const delSelect = document.getElementById('clientDelegation');
    if (!delSelect) return;
    if (!gouv) {
        delSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
        return;
    }
    const delegations = typeof getDelegations === 'function' ? getDelegations(gouv) : [];
    delSelect.innerHTML = '<option value="">-- Sélectionner --</option>' +
        delegations.map(d => `<option value="${d}">${d}</option>`).join('');

    // Center map on gouvernorat
    const coords = typeof getGouvernoratCoordinates === 'function' ? getGouvernoratCoordinates(gouv) : null;
    if (coords && clientMap) {
        clientMap.setView([coords.lat, coords.lng], 10);
    }
}

function onDelegationChange() {
    const gouv = document.getElementById('clientGouvernorat')?.value;
    const del = document.getElementById('clientDelegation')?.value;
    if (!del || !gouv) return;

    const coords = typeof getDelegationCoordinates === 'function' ? getDelegationCoordinates(gouv, del) : null;
    if (coords) {
        document.getElementById('clientLat').value = coords.lat.toFixed(6);
        document.getElementById('clientLng').value = coords.lng.toFixed(6);
        if (clientMap) {
            clientMap.setView([coords.lat, coords.lng], 13);
            if (clientMarker) {
                clientMarker.setLatLng([coords.lat, coords.lng]);
            } else {
                clientMarker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(clientMap);
                clientMarker.on('dragend', () => {
                    const pos = clientMarker.getLatLng();
                    document.getElementById('clientLat').value = pos.lat.toFixed(6);
                    document.getElementById('clientLng').value = pos.lng.toFixed(6);
                });
            }
        }
    }
}

async function saveClient() {
    const lat = parseFloat(document.getElementById('clientLat')?.value) || null;
    const lng = parseFloat(document.getElementById('clientLng')?.value) || null;
    const client = {
        id: document.getElementById('clientId').value || `client_${Date.now()}`,
        code: document.getElementById('clientCode').value,
        nom: document.getElementById('clientNom').value,
        telephone: document.getElementById('clientTel').value,
        email: document.getElementById('clientEmail').value,
        adresse: document.getElementById('clientAdresse').value,
        matriculeFiscale: document.getElementById('clientMF').value,
        rib: document.getElementById('clientRib').value,
        solde: parseFloat(document.getElementById('clientSolde').value) || 0,
        gouvernorat: document.getElementById('clientGouvernorat')?.value || null,
        delegation: document.getElementById('clientDelegation')?.value || null,
        lat: lat,
        lng: lng,
        updatedAt: new Date().toISOString()
    };

    if (!client.nom) {
        alert('Le nom est obligatoire');
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.clients, client.id), client);
        App.hideModal();
        await refresh();
    } catch (error) {
        console.error('Error saving client:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

function edit(id) { openModal(id); }

async function remove(id) {
    if (confirm('Supprimer ce client ?')) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.clients, id));
            await refresh();
        } catch (error) {
            console.error('Error deleting client:', error);
        }
    }
}

export const ClientsModule = { init, refresh, getClients, getClientById, edit, remove, onGouvernoratChange, onDelegationChange };
window.ClientsModule = ClientsModule;
