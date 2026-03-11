/**
 * AUTH MODULE - Firebase Authentication + Dynamic Roles & Permissions
 * Super Admin creates custom roles with permission checkboxes, then assigns to users
 */

import {
    db, auth, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
    query, where, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged, COLLECTIONS
} from './firebase.js';

// Secondary app for creating users without signing out admin
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword as createSecondaryUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

firebaseConfig = {
  apiKey: "AIzaSyB3nKGz8DFBDPfWRy3uhQYJhdad4hoMsic",
  authDomain: "devnavexis.firebaseapp.com",
  projectId: "devnavexis",
  storageBucket: "devnavexis.firebasestorage.app",
  messagingSenderId: "607658047105",
  appId: "1:607658047105:web:9b1925f8340c250d567f80",
  measurementId: "G-WTLEQYGJWP"
};

// ============================================================
// PERMISSION KEYS — all available module permissions
// ============================================================

const PERMISSION_KEYS = [
    { key: 'dashboard', label: '📊 Tableau de bord', group: 'core' },
    { key: 'entries', label: '📝 Saisie journalière', group: 'core' },
    { key: 'planification', label: '📅 Planification', group: 'core' },
    { key: 'trucks', label: '🚚 Camions', group: 'fleet' },
    { key: 'drivers', label: '👤 Chauffeurs', group: 'fleet' },
    { key: 'reports', label: '📈 Rapports', group: 'core' },
    { key: 'achat', label: '🛒 Achat Local', group: 'erp' },
    { key: 'vente', label: '💰 Vente Client', group: 'erp' },
    { key: 'articles', label: '📦 Articles', group: 'erp' },
    { key: 'settings', label: '⚙️ Paramètres', group: 'system' }
];

// Empty permissions template
function emptyPermissions() {
    const p = {};
    PERMISSION_KEYS.forEach(k => p[k.key] = false);
    return p;
}

// Full permissions (for super_admin)
function fullPermissions() {
    const p = {};
    PERMISSION_KEYS.forEach(k => p[k.key] = true);
    return p;
}

// ============================================================
// AUTH FUNCTIONS
// ============================================================

async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(cred.user.uid);
    if (!profile) throw new Error('Profil utilisateur introuvable');
    return profile;
}

async function createUser(email, password, displayName, roleId, roleName, permissions, extraFields = {}) {
    const secondaryApp = initializeApp(firebaseConfig, 'secondary_' + Date.now());
    const secondaryAuth = getSecondaryAuth(secondaryApp);

    try {
        const cred = await createSecondaryUser(secondaryAuth, email, password);

        const user = {
            uid: cred.user.uid,
            email: email,
            displayName: displayName,
            roleId: roleId,
            roleName: roleName,
            role: roleId === 'super_admin' ? 'super_admin' : 'custom',
            permissions: permissions || emptyPermissions(),
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdBy: auth.currentUser?.uid || 'system',
            ...extraFields
        };

        await setDoc(doc(db, COLLECTIONS.users, cred.user.uid), user);
        return user;
    } finally {
        await deleteApp(secondaryApp);
    }
}

// Chauffeur default permissions
const CHAUFFEUR_PERMISSIONS = {
    dashboard: true,
    entries: true,
    planification: true,
    trucks: true,
    drivers: false,
    reports: false,
    achat: true,
    vente: false,
    articles: false,
    settings: false,
    caisse: false,
    messagerie: true,
    tracking: true
};

/**
 * Ensure the default "Chauffeur" role exists in Firestore
 */
async function ensureChauffeurRole() {
    const roleId = 'role_chauffeur';
    const existing = await getRoleById(roleId);
    if (!existing) {
        await setDoc(doc(db, COLLECTIONS.roles, roleId), {
            id: roleId,
            name: 'Chauffeur',
            permissions: CHAUFFEUR_PERMISSIONS,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        });
    }
    return roleId;
}

/**
 * Create a chauffeur account linked to an existing driver
 */
async function createChauffeurAccount(driverId, camionId, driverName, email, password) {
    const roleId = await ensureChauffeurRole();
    return createUser(
        email, password, driverName,
        roleId, 'Chauffeur', CHAUFFEUR_PERMISSIONS,
        { driverId, camionId }
    );
}

async function logout() {
    await signOut(auth);
}

function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

function getCurrentUser() {
    return auth.currentUser;
}

function waitForAuth() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

// ============================================================
// ROLES CRUD
// ============================================================

async function createRole(name, permissions) {
    const id = 'role_' + Date.now();
    const role = {
        id,
        name,
        permissions: permissions || emptyPermissions(),
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'system'
    };
    await setDoc(doc(db, COLLECTIONS.roles, id), role);
    return role;
}

async function getAllRoles() {
    const snap = await getDocs(collection(db, COLLECTIONS.roles));
    return snap.docs.map(d => d.data());
}

async function getRoleById(roleId) {
    const snap = await getDoc(doc(db, COLLECTIONS.roles, roleId));
    if (!snap.exists()) return null;
    return snap.data();
}

async function updateRole(roleId, name, permissions) {
    await updateDoc(doc(db, COLLECTIONS.roles, roleId), { name, permissions });
}

async function deleteRole(roleId) {
    await deleteDoc(doc(db, COLLECTIONS.roles, roleId));
}

// ============================================================
// USER PROFILE FUNCTIONS
// ============================================================

async function getUserProfile(uid) {
    const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
    if (!snap.exists()) return null;
    return snap.data();
}

async function getAllUsers() {
    const snap = await getDocs(collection(db, COLLECTIONS.users));
    return snap.docs.map(d => d.data());
}

async function updateUserRole(uid, roleId, roleName, permissions) {
    await updateDoc(doc(db, COLLECTIONS.users, uid), {
        roleId,
        roleName,
        permissions
    });
}

async function updateUserPermissions(uid, permissions) {
    await updateDoc(doc(db, COLLECTIONS.users, uid), { permissions });
}

async function updateDisplayName(uid, displayName) {
    await updateDoc(doc(db, COLLECTIONS.users, uid), { displayName });
}

async function deleteUser(uid) {
    await deleteDoc(doc(db, COLLECTIONS.users, uid));
}

// ============================================================
// PERMISSION CHECK
// ============================================================

function hasPermission(user, page) {
    if (!user) return false;
    // Super admin always has full access
    if (user.role === 'super_admin' || user.roleId === 'super_admin') return true;

    // Map page names to permission keys
    const pageToPermission = {
        dashboard: 'dashboard',
        entries: 'entries',
        planification: 'planification',
        trucks: 'trucks',
        drivers: 'drivers',
        reports: 'reports',
        articles: 'articles',
        settings: 'settings',
        admin: '__admin__', // Only super_admin
        profil: '__always__', // Always allowed
        messagerie: '__always__', // Always allowed
        caisse: 'caisse',
        tracking: '__always__', // GPS tracking available to all authenticated users
        // Achat group
        'offres-prix': 'achat',
        'bon-commandes': 'achat',
        'bon-livraisons': 'achat',
        'factures': 'achat',
        'reglements': 'achat',
        'fournisseurs': 'achat',
        // Vente group
        'devis-clients': 'vente',
        'commandes-clients': 'vente',
        'livraisons-clients': 'vente',
        'retours-clients': 'vente',
        'factures-clients': 'vente',
        'clients': 'vente'
    };

    const permKey = pageToPermission[page];
    if (!permKey) return true; // Unknown page → allow
    if (permKey === '__admin__') return false; // Admin → super_admin only
    if (permKey === '__always__') return true; // Always allowed (profil)

    return user.permissions?.[permKey] === true;
}

// ============================================================
// EXPORT
// ============================================================

const AuthModule = {
    // Auth
    login, createUser, logout, onAuthChange, getCurrentUser, waitForAuth,
    // Roles
    createRole, getAllRoles, getRoleById, updateRole, deleteRole,
    // Users
    getUserProfile, getAllUsers, updateUserRole, updateUserPermissions,
    updateDisplayName, deleteUser,
    // Chauffeur
    createChauffeurAccount, ensureChauffeurRole,
    // Permissions
    hasPermission, PERMISSION_KEYS, emptyPermissions, fullPermissions
};

export { AuthModule };
