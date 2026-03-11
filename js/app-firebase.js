/**
 * MAIN APPLICATION - FIREBASE VERSION
 * Handles navigation, initialization, auth gate, and global functions
 */

import { DataModule } from './data-firebase.js';
import { DashboardModule } from './dashboard-firebase.js';
import { TrucksModule } from './trucks-firebase.js';
import { DriversModule } from './drivers-firebase.js';
import { EntriesModule } from './entries-firebase.js';
import { ReportsModule } from './reports-firebase.js';
import { ProfileModule } from './profile-firebase.js';
// ERP Modules
import { SuppliersModule } from './suppliers-firebase.js';
import { ClientsModule } from './clients-firebase.js';
import { ArticlesModule } from './articles-firebase.js';
import { PurchaseOrdersModule } from './purchase-orders-firebase.js';
import { SalesOrdersModule } from './sales-orders-firebase.js';
import { AchatModule } from './achat-local.js';
import { VenteModule } from './vente-local.js';
import { ExcelImportModule } from './excel-import-firebase.js';
import { PlanificationModule } from './planification-firebase.js';
import { CaisseModule } from './caisse-firebase.js';
import { InventaireModule } from './inventory-firebase.js';
import { MessengerModule } from './messenger-firebase.js';
import { AuthModule } from './auth-firebase.js';
// Photo modules
import { TripPhotosModule } from './trip-photos.js';
import './cloudinary-web.js';

let currentPage = 'dashboard';
let selectedDate = new Date().toISOString().split('T')[0];
let currentUser = null;

async function init() {
    console.log('🚛 FleetTrack - Initializing...');

    // Show loading
    showLoading();

    try {
        // ========== AUTH GATE ==========
        const firebaseUser = await AuthModule.waitForAuth();
        if (!firebaseUser) {
            window.location.href = 'login.html';
            return;
        }

        const profile = await AuthModule.getUserProfile(firebaseUser.uid);
        if (!profile || profile.status !== 'approved') {
            window.location.href = 'login.html';
            return;
        }

        currentUser = profile;
        window.currentUser = currentUser;
        console.log('👤 Logged in as:', profile.displayName, '| Role:', profile.role);

        // Initialize Firebase data
        await DataModule.init();

        // Initialize modules
        DashboardModule.init();
        TrucksModule.init();
        DriversModule.init();
        EntriesModule.init();
        ReportsModule.init();
        ProfileModule.init();
        // ERP Modules
        SuppliersModule.init();
        AchatModule.init();
        VenteModule.init();
        ClientsModule.init();
        ArticlesModule.init();
        PurchaseOrdersModule.init();
        SalesOrdersModule.init();
        ExcelImportModule.init();
        PlanificationModule.init();
        CaisseModule.init();
        MessengerModule.init();
        // TrackingModule loaded dynamically on first use

        // Setup UI
        setupNavigation();
        setupDatePicker();
        setupModal();
        setupSettings();
        setupDataActions();
        updateDateDisplay();
        setupUserWidget();
        setupAdminPanel();

        // Global: open driver chat from drivers page
        window.openDriverChat = async (driverId) => {
            const convId = `conv_${driverId}`;
            await navigateTo('messagerie');
            setTimeout(() => MessengerModule.openConversation(convId), 300);
        };

        // ========== SUNDAY CLEANUP: Remove any idle_day entries on Sundays ==========
        // MUST complete before generating new idle entries to avoid race condition
        try {
            const cleanedCount = await DataModule.cleanupSundayIdleEntries();
            if (cleanedCount > 0) {
                console.log(`🗑️ ${cleanedCount} Sunday idle entries cleaned. Refreshing...`);
                await refreshCurrentPage();
            }
        } catch (err) { console.error('Sunday cleanup error:', err); }

        // ========== IDLE DAY CHARGES: Auto-generate for missing days ==========
        // Only runs AFTER Sunday cleanup is complete
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const fromDate = '2026-02-01';
        const toDateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        // Run in background to avoid blocking the UI
        DataModule.generateIdleDayEntries(fromDate, toDateStr).then(count => {
            if (count > 0) {
                console.log(`🚫 ${count} idle entries generated. Refreshing current page...`);
                refreshCurrentPage();
            }
        }).catch(err => console.error('Idle day generation error:', err));

        // Navigate to dashboard
        await navigateTo('dashboard');

        console.log('✅ FleetTrack ready!');

    } catch (error) {
        console.error('❌ Initialization error:', error);
        alert('Erreur de connexion à Firebase. Vérifiez votre connexion internet.');
    } finally {
        hideLoading();
    }
}

// ========== USER WIDGET ==========
function setupUserWidget() {
    const widget = document.getElementById('userWidget');
    if (!widget || !currentUser) return;

    const name = widget.querySelector('.user-name');
    const role = widget.querySelector('.user-role');
    const logoutBtn = widget.querySelector('.user-logout');

    if (name) name.textContent = currentUser.displayName || 'Utilisateur';
    if (role) {
        if (currentUser.role === 'super_admin' || currentUser.roleId === 'super_admin') {
            role.textContent = '👑 Super Admin';
        } else {
            role.textContent = currentUser.roleName || currentUser.role || 'Utilisateur';
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await AuthModule.logout();
            window.location.href = 'login.html';
        });
    }

    widget.style.display = 'flex';

    // Show/hide admin nav — handled by setupNavigation permission checks
}

// ========== ADMIN PANEL - ROLE MANAGER + USER MANAGER ==========
let cachedRoles = [];

function setupAdminPanel() {
    if (currentUser.role !== 'super_admin' && currentUser.roleId !== 'super_admin') return;
    loadAdminData();
}

async function loadAdminData() {
    cachedRoles = await AuthModule.getAllRoles();
    renderRoleManager();
    renderUserManager();
    renderChauffeurManager();
}

// ---------- ROLE MANAGER ----------
function renderRoleManager() {
    const container = document.getElementById('roleManagerContent');
    if (!container) return;

    const permCheckboxes = AuthModule.PERMISSION_KEYS.map(p => `
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0">
            <input type="checkbox" id="newRolePerm_${p.key}" style="accent-color:#8b5cf6;width:16px;height:16px">
            <span style="font-size:13px">${p.label}</span>
        </label>
    `).join('');

    const rolesList = cachedRoles.map(r => {
        const activePerms = AuthModule.PERMISSION_KEYS
            .filter(p => r.permissions?.[p.key])
            .map(p => `<span style="font-size:10px;padding:2px 6px;background:rgba(139,92,246,0.15);border-radius:4px;color:#a78bfa">${p.label}</span>`)
            .join(' ');

        return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(15,23,42,0.4);border-radius:10px;margin-bottom:8px;border:1px solid rgba(148,163,184,0.08)">
                <div>
                    <div style="font-weight:600;margin-bottom:4px">${r.name}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">${activePerms || '<span style="font-size:11px;color:#64748b">Aucune permission</span>'}</div>
                </div>
                <div style="display:flex;gap:6px">
                    <button onclick="window.AdminActions.editRole('${r.id}')"
                        style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.2);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">✏️</button>
                    <button onclick="window.AdminActions.deleteRole('${r.id}')"
                        style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.2);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px;margin-bottom:20px">
            <h3 style="margin:0 0 16px;font-size:16px;color:#f1f5f9">➕ Créer un rôle</h3>
            <input id="newRoleName" placeholder="Nom du rôle (ex: Chauffeur, Comptable...)"
                style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:16px">
                ${permCheckboxes}
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <button id="createRoleBtn" onclick="window.AdminActions.createRole()"
                    style="padding:10px 24px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
                    ➕ Créer le rôle
                </button>
                <span id="createRoleMsg" style="display:none;font-size:13px"></span>
            </div>
        </div>
        <h3 style="margin:0 0 12px;font-size:16px;color:#f1f5f9">🏷️ Rôles existants (${cachedRoles.length})</h3>
        ${rolesList || '<div style="color:#64748b;font-size:13px;padding:12px">Aucun rôle créé. Créez votre premier rôle ci-dessus.</div>'}
    `;
}

// ---------- USER MANAGER ----------
async function renderUserManager() {
    const container = document.getElementById('userManagerContent');
    if (!container) return;

    const roleOptions = cachedRoles.map(r =>
        `<option value="${r.id}">${r.name}</option>`
    ).join('');

    const loadUsers = async () => {
        const usersListEl = document.getElementById('adminUsersList');
        if (!usersListEl) return;

        try {
            const users = await AuthModule.getAllUsers();
            const sorted = users.sort((a, b) => {
                if (a.role === 'super_admin') return -1;
                if (b.role === 'super_admin') return 1;
                return (a.roleName || '').localeCompare(b.roleName || '');
            });

            usersListEl.innerHTML = sorted.map(u => {
                const isSuperAdmin = u.role === 'super_admin' || u.roleId === 'super_admin';
                const badge = isSuperAdmin
                    ? '<span style="color:#f59e0b">👑 Super Admin</span>'
                    : `<span style="color:#a78bfa">🏷️ ${u.roleName || 'Sans rôle'}</span>`;

                const permBadges = !isSuperAdmin && u.permissions
                    ? AuthModule.PERMISSION_KEYS
                        .filter(p => u.permissions[p.key])
                        .map(p => `<span style="font-size:10px;padding:1px 5px;background:rgba(16,185,129,0.12);border-radius:3px;color:#10b981">${p.key}</span>`)
                        .join(' ')
                    : '';

                let actions = '';
                if (u.uid !== currentUser.uid && !isSuperAdmin) {
                    const changeRoleOpts = cachedRoles.map(r =>
                        `<option value="${r.id}" ${u.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                    ).join('');
                    actions = `
                        <select onchange="window.AdminActions.changeUserRole('${u.uid}', this.value)"
                            style="background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:6px;padding:4px 8px;font-size:12px">
                            ${changeRoleOpts}
                        </select>
                        <button onclick="window.AdminActions.deleteUser('${u.uid}')"
                            style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.2);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">🗑️</button>
                    `;
                } else if (u.uid === currentUser.uid) {
                    actions = '<span style="font-size:11px;color:#64748b">Vous</span>';
                }

                return `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(15,23,42,0.4);border-radius:10px;margin-bottom:8px;border:1px solid rgba(148,163,184,0.08)">
                        <div>
                            <div style="font-weight:600;margin-bottom:2px">${u.displayName || 'Sans nom'}</div>
                            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">${u.email}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:3px">${permBadges}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px">
                            ${badge}
                            ${actions}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            usersListEl.innerHTML = '<div style="color:#ef4444">Erreur de chargement</div>';
        }
    };

    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:20px;margin-bottom:20px">
            <h3 style="margin:0 0 16px;font-size:16px;color:#f1f5f9">➕ Créer un utilisateur</h3>
            ${cachedRoles.length === 0 ? '<div style="color:#f59e0b;font-size:13px;margin-bottom:12px">⚠️ Créez d\'abord un rôle dans la section ci-dessus</div>' : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <input id="newUserName" placeholder="Nom complet"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
                <input id="newUserEmail" placeholder="Email" type="email"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
                <input id="newUserPassword" placeholder="Mot de passe" type="password"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
                <select id="newUserRole"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
                    <option value="">-- Sélectionner un rôle --</option>
                    ${roleOptions}
                </select>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <button id="createUserBtn" onclick="window.AdminActions.createUser()"
                    style="padding:10px 24px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600"
                    ${cachedRoles.length === 0 ? 'disabled' : ''}>
                    ➕ Créer l'utilisateur
                </button>
                <span id="createUserMsg" style="display:none;font-size:13px"></span>
            </div>
        </div>
        <h3 style="margin:0 0 12px;font-size:16px;color:#f1f5f9">👥 Utilisateurs</h3>
        <div id="adminUsersList"><div style="color:#64748b">Chargement...</div></div>
    `;

    loadUsers();
    // Store for refresh
    window._refreshAdminUsers = loadUsers;
}

// ---------- CHAUFFEUR MANAGER ----------
async function renderChauffeurManager() {
    const container = document.getElementById('chauffeurManagerContent');
    if (!container) return;

    const drivers = await DataModule.getDrivers();
    const existingUsers = await AuthModule.getAllUsers();
    const linkedDriverIds = existingUsers.filter(u => u.driverId).map(u => u.driverId);
    const availableDrivers = drivers.filter(d => !linkedDriverIds.includes(d.id));
    const trucks = await DataModule.getTrucks();

    const driverOptions = availableDrivers.map(d => {
        const truck = trucks.find(t => t.id === d.camionId);
        return `<option value="${d.id}" data-camion="${d.camionId || ''}">${d.nom}${truck ? ' — ' + truck.matricule : ''}</option>`;
    }).join('');

    // Show existing chauffeur accounts
    const chauffeurAccounts = existingUsers.filter(u => u.driverId);
    const accountsList = chauffeurAccounts.map(u => {
        const driver = drivers.find(d => d.id === u.driverId);
        const truck = trucks.find(t => t.id === u.camionId);
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(15,23,42,0.4);border-radius:8px;margin-bottom:6px;border:1px solid rgba(148,163,184,0.08)">
                <div>
                    <span style="font-weight:600">${u.displayName}</span>
                    <span style="font-size:12px;color:#94a3b8;margin-left:8px">${u.email}</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <span style="font-size:11px;padding:2px 8px;background:rgba(16,185,129,0.12);border-radius:4px;color:#10b981">� ${truck?.matricule || '-'}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="font-size:12px;color:#94a3b8;margin-bottom:16px">Le chauffeur verra uniquement ses propres données (entrées, planning, camion)</div>
        ${availableDrivers.length === 0 && chauffeurAccounts.length === 0
            ? '<div style="color:#f59e0b;font-size:13px">⚠️ Aucun chauffeur n\'existe dans le système. Ajoutez d\'abord des chauffeurs dans la section "Chauffeurs".</div>'
            : ''}

        ${availableDrivers.length > 0 ? `
        <div style="background:rgba(15,23,42,0.3);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:16px;margin-bottom:16px">
            <h3 style="margin:0 0 12px;font-size:14px;color:#10b981">➕ Créer un nouveau compte</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <select id="chauffeurDriverSelect"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
                    <option value="">-- Sélectionner un chauffeur --</option>
                    ${driverOptions}
                </select>
                <input id="chauffeurEmail" placeholder="Email du chauffeur" type="email"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
                <input id="chauffeurPassword" placeholder="Mot de passe" type="password"
                    style="padding:10px 14px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:8px;font-size:14px">
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <button id="createChauffeurBtn" onclick="window.AdminActions.createChauffeur()"
                    style="padding:10px 24px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
                    🚚 Créer le compte chauffeur
                </button>
                <span id="createChauffeurMsg" style="display:none;font-size:13px"></span>
            </div>
        </div>
        ` : ''}

        ${chauffeurAccounts.length > 0 ? `
        <h3 style="margin:0 0 10px;font-size:14px;color:#f1f5f9">👥 Comptes existants (${chauffeurAccounts.length})</h3>
        ${accountsList}
        ` : ''}

        ${availableDrivers.length > 0 ? `
        <div style="font-size:11px;color:#64748b;margin-top:12px">${availableDrivers.length} chauffeur(s) sans compte</div>
        ` : '<div style="font-size:11px;color:#64748b;margin-top:8px">✅ Tous les chauffeurs ont un compte</div>'}
    `;
}

// Expose admin actions globally
window.AdminActions = {
    createRole: async () => {
        const name = document.getElementById('newRoleName')?.value?.trim();
        const msgEl = document.getElementById('createRoleMsg');
        if (!name) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '⚠️ Entrez un nom de rôle'; return;
        }
        const permissions = {};
        AuthModule.PERMISSION_KEYS.forEach(p => {
            permissions[p.key] = document.getElementById(`newRolePerm_${p.key}`)?.checked || false;
        });
        try {
            await AuthModule.createRole(name, permissions);
            msgEl.style.display = 'inline'; msgEl.style.color = '#10b981';
            msgEl.textContent = `✅ Rôle "${name}" créé!`;
            document.getElementById('newRoleName').value = '';
            AuthModule.PERMISSION_KEYS.forEach(p => {
                const cb = document.getElementById(`newRolePerm_${p.key}`);
                if (cb) cb.checked = false;
            });
            await loadAdminData();
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
        } catch (err) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '❌ ' + (err.message || 'Erreur');
        }
    },
    editRole: async (roleId) => {
        const role = cachedRoles.find(r => r.id === roleId);
        if (!role) return;
        const newName = prompt('Modifier le nom du rôle:', role.name);
        if (newName === null) return;
        // Simple edit — name only for now (full edit would need a modal)
        await AuthModule.updateRole(roleId, newName || role.name, role.permissions);
        await loadAdminData();
    },
    deleteRole: async (roleId) => {
        if (confirm('Supprimer ce rôle ? Les utilisateurs assignés garderont leurs permissions actuelles.')) {
            await AuthModule.deleteRole(roleId);
            await loadAdminData();
        }
    },
    createUser: async () => {
        const name = document.getElementById('newUserName')?.value?.trim();
        const email = document.getElementById('newUserEmail')?.value?.trim();
        const password = document.getElementById('newUserPassword')?.value;
        const roleId = document.getElementById('newUserRole')?.value;
        const msgEl = document.getElementById('createUserMsg');
        const btn = document.getElementById('createUserBtn');

        if (!name || !email || !password || !roleId) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '⚠️ Remplir tous les champs'; return;
        }
        if (password.length < 6) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '⚠️ Mot de passe min 6 caractères'; return;
        }

        const role = cachedRoles.find(r => r.id === roleId);
        if (!role) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '⚠️ Rôle invalide'; return;
        }

        btn.disabled = true; btn.textContent = '⏳ Création...';

        try {
            await AuthModule.createUser(email, password, name, roleId, role.name, role.permissions);
            msgEl.style.display = 'inline'; msgEl.style.color = '#10b981';
            msgEl.textContent = `✅ ${name} créé avec le rôle "${role.name}"!`;
            document.getElementById('newUserName').value = '';
            document.getElementById('newUserEmail').value = '';
            document.getElementById('newUserPassword').value = '';
            document.getElementById('newUserRole').value = '';
            if (window._refreshAdminUsers) window._refreshAdminUsers();
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
        } catch (err) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '❌ ' + (err.message || 'Erreur');
        } finally {
            btn.disabled = false; btn.textContent = '➕ Créer l\'utilisateur';
        }
    },
    changeUserRole: async (uid, roleId) => {
        const role = cachedRoles.find(r => r.id === roleId);
        if (!role) return;
        await AuthModule.updateUserRole(uid, roleId, role.name, role.permissions);
        if (window._refreshAdminUsers) window._refreshAdminUsers();
    },
    deleteUser: async (uid) => {
        if (confirm('Supprimer cet utilisateur ?')) {
            await AuthModule.deleteUser(uid);
            if (window._refreshAdminUsers) window._refreshAdminUsers();
        }
    },
    createChauffeur: async () => {
        const select = document.getElementById('chauffeurDriverSelect');
        const driverId = select?.value;
        const camionId = select?.selectedOptions[0]?.dataset?.camion || '';
        const driverName = select?.selectedOptions[0]?.textContent?.split(' — ')[0] || '';
        const email = document.getElementById('chauffeurEmail')?.value?.trim();
        const password = document.getElementById('chauffeurPassword')?.value;
        const msgEl = document.getElementById('createChauffeurMsg');
        const btn = document.getElementById('createChauffeurBtn');

        if (!driverId || !email || !password) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '⚠️ Remplir tous les champs'; return;
        }
        if (password.length < 6) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '⚠️ Mot de passe min 6 caractères'; return;
        }

        btn.disabled = true; btn.textContent = '⏳ Création...';

        try {
            await AuthModule.createChauffeurAccount(driverId, camionId, driverName, email, password);
            msgEl.style.display = 'inline'; msgEl.style.color = '#10b981';
            msgEl.textContent = `✅ Compte chauffeur pour "${driverName}" créé!`;
            document.getElementById('chauffeurEmail').value = '';
            document.getElementById('chauffeurPassword').value = '';
            select.value = '';
            await loadAdminData();
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
        } catch (err) {
            msgEl.style.display = 'inline'; msgEl.style.color = '#ef4444';
            msgEl.textContent = '❌ ' + (err.message || 'Erreur');
        } finally {
            btn.disabled = false; btn.textContent = '🚚 Créer le compte chauffeur';
        }
    }
};

function showLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function setupNavigation() {
    // Hide nav items based on permissions
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        const page = item.dataset.page;
        if (page && !AuthModule.hasPermission(currentUser, page)) {
            item.style.display = 'none';
        } else {
            item.style.display = '';
        }
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (page) navigateTo(page);
        });
    });

    // Hide submenu groups if the entire group permission is denied
    document.querySelectorAll('.nav-item[data-toggle]').forEach(toggle => {
        const groupKey = toggle.dataset.toggle;
        // Map group toggle names to permission keys
        const groupPerm = { 'achat-local': 'achat', 'vente-client': 'vente' };
        const permKey = groupPerm[groupKey];
        if (permKey) {
            const hasAccess = AuthModule.hasPermission(currentUser, permKey === 'achat' ? 'offres-prix' : 'devis-clients');
            const navGroup = toggle.closest('.nav-group');
            if (navGroup) navGroup.style.display = hasAccess ? '' : 'none';
        }

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const submenuId = toggle.dataset.toggle + '-submenu';
            const submenu = document.getElementById(submenuId);
            const navGroup = toggle.closest('.nav-group');
            const isOpen = navGroup?.classList.contains('open');

            // Close all other submenus
            document.querySelectorAll('.nav-group').forEach(group => {
                if (group !== navGroup) {
                    group.classList.remove('open');
                    group.querySelector('.nav-submenu')?.classList.remove('active');
                }
            });

            if (isOpen) {
                navGroup?.classList.remove('open');
                submenu?.classList.remove('active');
            } else {
                navGroup?.classList.add('open');
                submenu?.classList.add('active');
            }
        });
    });

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
}

async function navigateTo(page) {
    // Block unauthorized pages
    if (!AuthModule.hasPermission(currentUser, page)) {
        console.warn('⛔ Access denied to:', page);
        return;
    }
    currentPage = page;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`page-${page}`)?.classList.add('active');

    const titles = {
        dashboard: 'Tableau de bord',
        entries: 'Saisie journalière',
        trucks: 'Gestion des Camions',
        drivers: 'Gestion des Chauffeurs',
        reports: 'Rapports Mensuels',
        settings: 'Paramètres',
        // ERP Achat Local
        fournisseurs: 'Gestion des Fournisseurs',
        'offres-prix': 'Demandes d\'Achat',
        'bon-commandes': 'Bon Commandes Achat',
        'bon-livraisons': 'Bon Livraisons Achat',
        'bon-sorties': 'Bons de Sortie',
        'retours-fournisseurs': 'Bons de Retour Fournisseur',
        factures: 'Factures Fournisseurs',
        reglements: 'Règlements Fournisseurs',
        // ERP Vente Client
        clients: 'Gestion des Clients',
        'devis-clients': 'Devis / Offres Clients',
        'commandes-clients': 'Bon Commandes Vente',
        'livraisons-clients': 'Bon Livraisons Vente',
        'factures-clients': 'Factures Clients',
        'reglements-clients': 'Règlements Clients',
        // Articles
        articles: 'Gestion des Articles',
        inventaire: '📊 Inventaire Stock',
        admin: '👑 Administration',
        tracking: '📍 GPS Tracking',
        planification: 'Planification',
        caisse: '💵 Caisse',
        messagerie: '💬 Messagerie',
        profil: 'Mon Profil'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    await refreshCurrentPage();
}

async function refreshCurrentPage() {
    try {
        switch (currentPage) {
            case 'dashboard':
                await DashboardModule.refresh(selectedDate);
                break;
            case 'entries':
                await EntriesModule.refresh(selectedDate);
                break;
            case 'trucks':
                await TrucksModule.refresh();
                break;
            case 'drivers':
                await DriversModule.refresh();
                break;
            case 'planification':
                await PlanificationModule.refresh();
                break;
            case 'reports':
                await ReportsModule.refresh();
                break;
            // ERP Achat Local Pages - Use AchatModule
            case 'fournisseurs':
                await SuppliersModule.refresh();
                break;
            case 'offres-prix':
            case 'bon-commandes':
            case 'bon-livraisons':
            case 'bon-sorties':
            case 'retours-fournisseurs':
            case 'factures':
            case 'reglements':
                AchatModule.showPage(currentPage);
                break;
            // ERP Vente Client Pages
            case 'clients':
                await ClientsModule.refresh();
                break;
            case 'articles-achat':
                await ArticlesModule.refreshAchat();
                break;
            case 'articles-vente':
                await ArticlesModule.refreshVente();
                break;
            case 'commandes-clients':
                await SalesOrdersModule.refresh();
                break;
            case 'livraisons-clients':
            case 'factures-clients':
                VenteModule.showPage(currentPage);
                break;
            case 'devis-clients':
            case 'reglements-clients':
                VenteModule.showPage(currentPage);
                break;
            case 'tracking':
                try {
                    const { TrackingModule } = await import('./tracking-firebase.js');
                    window.TrackingModule = TrackingModule;
                    TrackingModule.init();
                    setTimeout(() => TrackingModule.refresh(), 300);
                } catch (err) {
                    console.error('GPS Tracking load error:', err);
                    const mapEl = document.getElementById('trackingMap');
                    if (mapEl) mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:16px">⚠️ Erreur GPS: ' + err.message + '</div>';
                }
                break;
            case 'admin':
                loadAdminData();
                break;
            case 'profil':
                renderProfilPage();
                break;
            case 'caisse':
                await CaisseModule.refresh();
                break;
            case 'messagerie':
                await MessengerModule.refresh();
                break;
            case 'inventaire':
                await InventaireModule.refresh();
                break;
        }
    } catch (error) {
        console.error('Page refresh error:', error);
    }
}

async function renderProfilPage() {
    const container = document.getElementById('profilContent');
    if (!container || !currentUser) return;

    const driver = currentUser.driverId ? DataModule.getDriverById(currentUser.driverId) : null;
    const truck = currentUser.camionId ? DataModule.getTruckById(currentUser.camionId) : null;

    // Count user's entries and plannings
    const allEntries = DataModule.getCachedEntries();
    const myEntries = currentUser.driverId
        ? allEntries.filter(e => e.chauffeurId === currentUser.driverId)
        : allEntries;
    const totalKm = myEntries.reduce((s, e) => s + (e.kilometrage || 0), 0);
    const totalTrips = myEntries.length;

    container.innerHTML = `
        <div style="max-width:700px;margin:0 auto">
            <!-- Profile Card -->
            <div class="card" style="padding:32px;margin-bottom:20px;text-align:center">
                <div style="width:80px;height:80px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 16px">👤</div>
                <h2 style="margin:0 0 4px;font-size:1.5rem;color:#f1f5f9">${currentUser.displayName || 'Utilisateur'}</h2>
                <div style="color:#94a3b8;font-size:14px;margin-bottom:8px">${currentUser.email}</div>
                <span style="display:inline-block;padding:4px 16px;background:rgba(16,185,129,0.15);color:#10b981;border-radius:20px;font-size:13px;font-weight:600">${currentUser.roleName || currentUser.role}</span>
            </div>

            ${truck ? `
            <!-- Truck Info -->
            <div class="card" style="padding:24px;margin-bottom:20px">
                <h3 style="margin:0 0 16px;font-size:1rem;color:#f1f5f9">🚛 Mon Camion</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div style="background:rgba(15,23,42,0.4);padding:14px;border-radius:10px">
                        <div style="font-size:11px;color:#64748b;margin-bottom:4px">Matricule</div>
                        <div style="font-size:18px;font-weight:700;color:#f1f5f9">${truck.matricule}</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.4);padding:14px;border-radius:10px">
                        <div style="font-size:11px;color:#64748b;margin-bottom:4px">Type</div>
                        <div style="font-size:18px;font-weight:700;color:#f1f5f9">${truck.type}</div>
                    </div>
                </div>
            </div>` : ''}

            <!-- Stats -->
            <div class="card" style="padding:24px;margin-bottom:20px">
                <h3 style="margin:0 0 16px;font-size:1rem;color:#f1f5f9">📊 Mes Statistiques</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div style="background:rgba(139,92,246,0.1);padding:14px;border-radius:10px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#8b5cf6">${totalTrips}</div>
                        <div style="font-size:12px;color:#94a3b8">Trajets effectués</div>
                    </div>
                    <div style="background:rgba(16,185,129,0.1);padding:14px;border-radius:10px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#10b981">${totalKm.toLocaleString('fr-FR')}</div>
                        <div style="font-size:12px;color:#94a3b8">Kilomètres parcourus</div>
                    </div>
                </div>
            </div>

            <!-- Permissions -->
            <div class="card" style="padding:24px">
                <h3 style="margin:0 0 16px;font-size:1rem;color:#f1f5f9">🔐 Mes Accès</h3>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                    ${currentUser.permissions ? Object.entries(currentUser.permissions).map(([key, val]) => `
                        <span style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:500;
                            background:${val ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'};
                            color:${val ? '#10b981' : '#ef4444'}">${val ? '✅' : '❌'} ${key}</span>
                    `).join('') : ''}
                </div>
            </div>
        </div>
    `;
}

function setupDatePicker() {
    const datePicker = document.getElementById('selectedDate');
    if (datePicker) {
        datePicker.value = selectedDate;
        datePicker.addEventListener('change', async (e) => {
            selectedDate = e.target.value;
            updateDateDisplay();
            await refreshCurrentPage();
        });
    }
}

function updateDateDisplay() {
    const display = document.getElementById('currentDate');
    if (display) {
        // Parse as local date to avoid UTC timezone shift
        const [y, m, d] = selectedDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        display.textContent = date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
}

function setupModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const cancelBtn = document.getElementById('modalCancel');

    closeBtn?.addEventListener('click', hideModal);
    cancelBtn?.addEventListener('click', hideModal);
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) hideModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideModal();
    });
}

function showModal() {
    document.getElementById('modalOverlay')?.classList.add('active');
}

function hideModal() {
    document.getElementById('modalOverlay')?.classList.remove('active');
}

async function setupSettings() {
    document.getElementById('saveFuelPrice')?.addEventListener('click', async () => {
        const price = parseFloat(document.getElementById('defaultFuelPrice').value) || 2;
        const settings = await DataModule.getSettings();
        settings.defaultFuelPrice = price;
        await DataModule.saveSettings(settings);
        alert('Prix gasoil enregistré: ' + price + ' TND/L');
    });

    const settings = await DataModule.getSettings();
    const priceInput = document.getElementById('defaultFuelPrice');
    if (priceInput) priceInput.value = settings.defaultFuelPrice;

    document.getElementById('resetDataBtn')?.addEventListener('click', async () => {
        if (confirm('Cette action va réinitialiser toutes les données aux valeurs par défaut. Continuer ?')) {
            await DataModule.resetData();
            location.reload();
        }
    });
}

function setupDataActions() {
    document.getElementById('exportBtn')?.addEventListener('click', exportData);
    document.getElementById('exportDataBtn')?.addEventListener('click', exportData);

    document.getElementById('importDataInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await DataModule.importData(data);
                alert('Données importées avec succès!');
                location.reload();
            } catch (err) {
                alert('Erreur lors de l\'import: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
}

async function exportData() {
    const data = await DataModule.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `fleettrack_firebase_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export for global access
const App = {
    init,
    navigateTo,
    refreshCurrentPage,
    showModal,
    hideModal
};

window.App = App;

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', init);

export { App };
