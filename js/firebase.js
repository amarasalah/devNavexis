/**
 * FIREBASE CONFIGURATION
 * Firestore Database + Auth for FleetTrack
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getDatabase,
    ref as dbRef,
    push as dbPush,
    set as dbSet,
    get as dbGet,
    onValue,
    onChildAdded,
    serverTimestamp as rtdbTimestamp,
    query as rtdbQuery,
    orderByChild,
    limitToLast
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB3nKGz8DFBDPfWRy3uhQYJhdad4hoMsic",
    authDomain: "devnavexis.firebaseapp.com",
    databaseURL: "https://devnavexis-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "devnavexis",
    storageBucket: "devnavexis.firebasestorage.app",
    messagingSenderId: "607658047105",
    appId: "1:607658047105:web:9b1925f8340c250d567f80",
    measurementId: "G-WTLEQYGJWP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// Collection names - FleetTrack + ERP Modules
const COLLECTIONS = {
    // Auth
    users: 'users',
    roles: 'roles',

    // FleetTrack Core
    trucks: 'trucks',
    drivers: 'drivers',
    entries: 'entries',
    settings: 'settings',
    logs: 'activity_logs',

    // ERP Core
    suppliers: 'suppliers',
    clients: 'clients',
    articles: 'articles',
    depots: 'depots',

    // Achat Local (Purchasing)
    demandesAchat: 'demandes_achat',
    bonCommandesAchat: 'bon_commandes_achat',
    bonLivraisonsAchat: 'bon_livraisons_achat',
    facturesAchat: 'factures_achat',
    reglementsFournisseurs: 'reglements_fournisseurs',
    bonsSortie: 'bons_sortie_achat',
    bonsRetour: 'bons_retour_achat',

    // Vente Client (Sales)
    offresPrix: 'offres_prix',
    bonCommandesVente: 'bon_commandes_vente',
    bonLivraisonsVente: 'bon_livraisons_vente',
    devisClients: 'devis_clients',
    facturesVente: 'factures_vente',

    // Planning
    planifications: 'planifications',

    // Caisse (Treasury)
    caisse: 'caisse_transactions',

    // Inventory
    stockMovements: 'stock_movements'
};

// R9: Sequential numbering utility — format: PREFIX-MM-YYYY-NNN (resets monthly)
async function getNextNumber(prefix) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const counterKey = `${prefix}-${mm}-${yyyy}`;
    const counterDocRef = doc(db, 'counters', counterKey);
    try {
        const snap = await getDoc(counterDocRef);
        let next = 1;
        if (snap.exists()) {
            next = (snap.data().next || 0) + 1;
        }
        await setDoc(counterDocRef, { next, prefix, month: mm, year: yyyy, updatedAt: now.toISOString() });
        return `${prefix}-${mm}-${yyyy}-${String(next).padStart(3, '0')}`;
    } catch (err) {
        console.error('Error getting next number for', prefix, err);
        return `${prefix}-${mm}-${yyyy}-${Date.now().toString().slice(-3)}`;
    }
}

// Export for use in other modules
export {
    db,
    auth,
    rtdb,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    // Realtime DB
    dbRef,
    dbPush,
    dbSet,
    dbGet,
    onValue,
    onChildAdded,
    rtdbTimestamp,
    rtdbQuery,
    orderByChild,
    limitToLast,
    onSnapshot,
    COLLECTIONS,
    getNextNumber
};

