# FleetTrack - Analyse Complète du Projet

> **Date d'analyse** : 16 Février 2026  
> **Projet** : FleetTrack — Suivi journalier des camions + ERP (Achat/Vente)  
> **Stack** : Vanilla HTML/JS (Web, sans framework) + React Native/Expo (Mobile) + Firebase (Firestore + Auth + Realtime DB)

---

## 1. Structure du Projet

```
Tableau_suivi_journalier_camions/
│
├── index.html                  # Application web principale (SPA monolithique ~1132 lignes)
├── login.html                  # Page de connexion Firebase Auth
├── css/
│   └── styles.css              # Design system glassmorphism dark mode (~1697 lignes)
│
├── js/                         # 33 modules JavaScript (ES Modules)
│   ├── firebase.js             # Configuration Firebase + exports centralisés
│   ├── app-firebase.js         # Point d'entrée principal (navigation, auth gate, admin panel)
│   ├── auth-firebase.js        # Auth + Rôles dynamiques + Permissions
│   ├── data-firebase.js        # CRUD Firestore + cache local + données par défaut
│   ├── dashboard-firebase.js   # KPIs + Chart.js (tendances, coûts, performance)
│   ├── entries-firebase.js     # Saisie journalière des trajets
│   ├── planification-firebase.js # Planification des trajets
│   ├── trucks-firebase.js      # Gestion des camions
│   ├── drivers-firebase.js     # Gestion des chauffeurs
│   ├── suppliers-firebase.js   # Fournisseurs + données achat (DA, BC, BL, Factures)
│   ├── clients-firebase.js     # Gestion des clients
│   ├── articles-firebase.js    # Articles (achat & vente)
│   ├── achat-local.js          # Module Achat (UI) ~69KB
│   ├── vente-local.js          # Module Vente (UI) ~55KB
│   ├── purchase-orders-firebase.js # Bons de commande achat
│   ├── sales-orders-firebase.js    # Bons de commande vente
│   ├── caisse-firebase.js      # Trésorerie / Caisse
│   ├── reports-firebase.js     # Rapports mensuels + graphiques
│   ├── profile-firebase.js     # Profils détaillés camion/chauffeur
│   ├── messenger-firebase.js   # Chat temps réel (Realtime DB)
│   ├── tracking-firebase.js    # GPS / Leaflet map
│   ├── trajectory-stats-firebase.js # Statistiques par trajet
│   ├── excel-import-firebase.js    # Import Excel → Firebase
│   ├── locations.js            # Coordonnées GPS Tunisie (24 gouvernorats + délégations) ~45KB
│   ├── data-importer.js        # Utilitaire d'import
│   ├── excel_data.js           # Données Excel pré-chargées
│   ├── app.js / data.js / ...  # Anciens modules (localStorage, non-Firebase)
│   └── reports.js / trucks.js / drivers.js / entries.js / suppliers.js / dashboard.js
│                                # Anciens modules pré-Firebase (dupliqués)
│
├── FleetTrackMobile/           # Application mobile React Native / Expo
│   ├── app/                    # Expo Router (file-based routing)
│   │   ├── _layout.tsx         # Root layout avec AuthProvider
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx       # Écran de connexion
│   │   └── (tabs)/
│   │       ├── _layout.tsx     # Tab navigator (7 onglets)
│   │       ├── index.tsx       # Dashboard mobile
│   │       ├── entries.tsx     # Saisie journalière
│   │       ├── trucks.tsx      # Camions
│   │       ├── planning.tsx    # Planification
│   │       ├── admin.tsx       # Panel admin
│   │       ├── profile.tsx     # Profil utilisateur
│   │       └── more.tsx        # Plus d'options
│   ├── src/
│   │   ├── constants/
│   │   │   ├── collections.ts  # Noms des collections Firestore
│   │   │   └── theme.ts        # Thème & couleurs
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Context d'authentification
│   │   ├── services/
│   │   │   ├── firebase.ts     # Config Firebase mobile
│   │   │   ├── auth.ts         # Service d'auth
│   │   │   ├── entries.ts      # Service entries
│   │   │   ├── trucks.ts       # Service trucks
│   │   │   ├── drivers.ts      # Service drivers
│   │   │   ├── clients.ts      # Service clients
│   │   │   ├── planning.ts     # Service planification
│   │   │   └── purchases.ts    # Service achats
│   │   └── types/
│   │       └── index.ts        # Types TypeScript complets
│   ├── package.json            # Expo 54 + React 19 + Firebase 12
│   └── tsconfig.json
│
├── package.json                # Dépendances racine (firebase, xlsx)
├── app.json / eas.json         # Config Expo
└── [fichiers Excel/PDF/PNG]    # Documents source et maquettes
```

---

## 2. Architecture & Logique Métier

### 2.1 Application Web (SPA Vanilla JS)
- **SPA monolithique** : Un seul `index.html` avec toutes les pages comme sections `<section class="page">`, navigation par `data-page`
- **Modules ES6** : Chaque fichier `*-firebase.js` est un module autonome avec `init()`, `refresh()`, et fonctions CRUD
- **Pattern** : Cache local en mémoire + CRUD Firestore asynchrone
- **Auth** : Firebase Auth + profils Firestore avec système de rôles dynamiques et permissions granulaires
- **Admin** : Super Admin peut créer des rôles custom avec permissions par module, créer/gérer des utilisateurs et lier des chauffeurs

### 2.2 Modules Métier
| Module | Description | Collection Firestore |
|--------|-------------|---------------------|
| **Entries** | Saisie journalière (trajet, km, gasoil, coûts, revenu) | `entries` |
| **Planification** | Planification des trajets avec statut | `planifications` |
| **Achat** | Workflow complet : DA → BC → BL → Facture → Règlement | `demandes_achat`, `bon_commandes_achat`, `bon_livraisons_achat`, `factures_achat`, `reglements_fournisseurs` |
| **Vente** | Workflow : Devis → BC → BL → Facture → Règlement | `devis_clients`, `bon_commandes_vente`, `bon_livraisons_vente`, `factures_vente` |
| **Caisse** | Encaissements / Décaissements liés aux modules | `caisse_transactions` |
| **Messenger** | Chat temps réel Admin ↔ Chauffeur | Firebase Realtime DB |
| **Tracking** | Carte GPS Leaflet + OpenStreetMap | Firestore (positions) |
| **Reports** | Rapports mensuels avec graphiques Chart.js | Agrégation entries |

### 2.3 Application Mobile (Expo/React Native)
- **Expo Router** (file-based) avec groupes `(auth)` et `(tabs)`
- **Même Firebase** que le web (même projet `managementsirep`)
- **TypeScript** avec types bien définis
- Authentification partagée via `AuthContext`
- Couverture partielle : Dashboard, Entries, Trucks, Planning, Admin, Profile

### 2.4 Calcul des Coûts (Logique Clé)
```
Coût Gasoil     = quantiteGasoil × prixGasoilLitre
Charges Fixes   = truck.chargesFixes + truck.montantAssurance + truck.montantTaxe + truck.chargePersonnel
Coût Total      = Gasoil + Maintenance + Charges Fixes
Résultat        = Prix Livraison - Coût Total
Coût par Km     = Coût Total / Kilométrage
```

---

## 3. Points Forts

- **Architecture modulaire** bien séparée (1 module = 1 fichier)
- **Système de rôles dynamique** avec permissions granulaires par module
- **Workflow ERP complet** achat et vente avec traçabilité
- **Chat temps réel** Firebase Realtime DB
- **Géolocalisation Tunisia** complète (24 gouvernorats + toutes les délégations avec coordonnées GPS)
- **Calcul automatique des distances** aller-retour avec coordonnées
- **Import Excel** pour migration de données existantes
- **Design cohérent** glassmorphism dark mode
- **App mobile** qui partage le même backend Firebase

---

## 4. Problèmes Identifiés (FIXES)

### 4.1 🔴 CRITIQUE — Sécurité

| # | Problème | Fichier(s) | Impact |
|---|----------|-----------|--------|
| F1 | **Clé API Firebase exposée en clair** dans le code source (web + mobile) | `js/firebase.js:44`, `js/auth-firebase.js:17-22`, `FleetTrackMobile/src/services/firebase.ts:23-29` | Clé publiquement accessible. Bien que les clés Firebase côté client soient semi-publiques, les Firestore Security Rules doivent être strictes |
| F2 | **Config Firebase dupliquée** dans `auth-firebase.js` (pour secondary app) | `js/auth-firebase.js:16-23` | Maintenance difficile, risque de divergence |
| F3 | **Aucune validation côté serveur** — toute la logique métier est côté client | Tous les modules JS | Un utilisateur malveillant peut contourner les permissions en appelant Firestore directement |
| F4 | **Pas de Firestore Security Rules** visibles dans le projet | Racine du projet | Les données sont potentiellement accessibles sans authentification |

### 4.2 🟠 IMPORTANT — Bugs & Problèmes Fonctionnels

| # | Problème | Fichier(s) | Détail |
|---|----------|-----------|--------|
| F5 | **Code dupliqué massif** — anciens modules localStorage coexistent avec les modules Firebase | `js/app.js`, `js/data.js`, `js/trucks.js`, `js/drivers.js`, `js/entries.js`, `js/suppliers.js`, `js/dashboard.js`, `js/reports.js` | ~90KB de code mort qui n'est plus utilisé |
| F6 | **Cache invalide** — `getClients()`, `getSuppliers()`, `getBLs()` retournent le cache vide au lieu de recharger si la collection est réellement vide | `js/clients-firebase.js:27`, `js/suppliers-firebase.js:33`, `js/vente-local.js:69` | `if (cache.length === 0) await load()` ne re-fetch jamais si la collection est vraiment vide |
| F7 | **generateCode() non fiable** — basé sur `cache.length + 1`, ce qui peut générer des doublons si le cache n'est pas complet | `js/clients-firebase.js:41`, `js/suppliers-firebase.js:47` | Codes clients/fournisseurs potentiellement dupliqués en multi-utilisateur |
| F8 | **generateId() faible** — utilise `Date.now()` + `Math.random()` au lieu de UUID v4 ou Firestore auto-ID | `js/data-firebase.js:78` | Risque de collision en cas d'appels simultanés |
| F9 | **Données codées en dur** — 15 camions et 14 chauffeurs pré-chargés dans le code source | `js/data-firebase.js:40-74` | Devrait être géré uniquement via Firebase, pas dans le code |
| F10 | **Collections manquantes sur mobile** — le mobile ne déclare pas `demandes_achat`, `reglements_fournisseurs`, `bons_sortie_achat`, `bons_retour`, `caisse_transactions`, `offres_prix` | `FleetTrackMobile/src/constants/collections.ts` | Désynchronisation web/mobile |

### 4.3 🟡 MINEUR — Code Quality

| # | Problème | Fichier(s) | Détail |
|---|----------|-----------|--------|
| F11 | **HTML inline styles massifs** — des centaines de lignes de styles inline dans `app-firebase.js` pour les panels admin | `js/app-firebase.js:160-900` | Très difficile à maintenir, devrait être en CSS |
| F12 | **innerHTML avec données utilisateur** sans sanitization (XSS potentiel) | `js/achat-local.js`, `js/vente-local.js`, `js/app-firebase.js` | Les noms de fournisseurs/clients sont injectés via innerHTML |
| F13 | **Pas de gestion d'erreurs utilisateur** — beaucoup de `console.error` mais pas de feedback UI | Multiples modules | L'utilisateur ne voit pas les erreurs |
| F14 | **Fichiers inutiles à la racine** — Excel, PDF, PNG, JSON de debug | Racine | Polluent le repo |
| F15 | **`index-localstorage.html`** — ancienne version qui n'est plus utilisée | `index-localstorage.html` | Code mort |
| F16 | **Pas de `.gitignore`** à la racine web (seulement dans FleetTrackMobile) | Racine | `node_modules/`, fichiers temporaires peuvent être commités |

---

## 5. Améliorations Recommandées (ENHANCEMENTS)

### 5.1 🏗️ Architecture

| # | Amélioration | Priorité | Effort |
|---|-------------|----------|--------|
| E1 | **Améliorer l'architecture vanilla JS** — découper `index.html` en templates HTML séparés chargés dynamiquement, organiser les modules JS avec un bundler léger (esbuild/Vite) pour optimiser le chargement | Moyenne | Moyen |
| E2 | **Ajouter Firestore Security Rules** avec validation des rôles et permissions côté serveur | Critique | Moyen |
| E3 | **Créer un fichier `.env`** pour la config Firebase au lieu de la coder en dur | Haute | Faible |
| E4 | **Supprimer les fichiers morts** (anciens modules localStorage, fichiers Excel/PDF/JSON de debug) | Moyenne | Faible |
| E5 | **Unifier les collections** entre web et mobile dans un fichier partagé ou package commun | Moyenne | Faible |

### 5.2 📊 Fonctionnalités

| # | Amélioration | Priorité | Effort |
|---|-------------|----------|--------|
| E6 | **Ajouter la pagination** pour les listes (entries, factures, BL) — actuellement tout est chargé en mémoire | Haute | Moyen |
| E7 | **Recherche et filtrage avancés** sur les tables (par date range, camion, chauffeur, client) | Haute | Moyen |
| E8 | **Export PDF** pour les factures, bons de commande, bons de livraison | Haute | Moyen |
| E9 | **Notifications push** pour les chauffeurs (nouvelles planifications, messages) | Moyenne | Moyen |
| E10 | **Mode hors ligne** (offline-first) avec synchronisation — crucial pour les chauffeurs en zone rurale | Haute | Élevé |
| E11 | **Tableau de bord configurable** avec widgets drag-and-drop | Basse | Élevé |
| E12 | **Historique des modifications** (audit trail) pour toutes les opérations CRUD | Moyenne | Moyen |
| E13 | **Validation des formulaires** plus robuste avec messages d'erreur clairs | Haute | Faible |
| E14 | **Gestion du stock** — suivi des quantités en temps réel lié aux BL achat/vente | Haute | Élevé |

### 5.3 📱 Mobile

| # | Amélioration | Priorité | Effort |
|---|-------------|----------|--------|
| E15 | **Ajouter les modules manquants** sur mobile (Achat, Vente, Caisse, Messenger, Rapports) | Haute | Élevé |
| E16 | **Notifications push** via Firebase Cloud Messaging | Moyenne | Moyen |
| E17 | **Scanner QR/Barcode** pour les articles | Basse | Moyen |
| E18 | **GPS tracking en arrière-plan** pour les chauffeurs | Moyenne | Élevé |

### 5.4 🎨 UI/UX

| # | Amélioration | Priorité | Effort |
|---|-------------|----------|--------|
| E19 | **Responsive design** — le web est semi-responsive, à perfectionner sur tablette | Moyenne | Moyen |
| E20 | **Loading states** et skeleton screens pour les chargements de données | Moyenne | Faible |
| E21 | **Confirmation dialogs** avant les suppressions (actuellement `confirm()` natif) | Basse | Faible |
| E22 | **Thème clair** optionnel (actuellement dark mode uniquement) | Basse | Moyen |
| E23 | **Internationalisation** (i18n) — support arabe en plus du français | Moyenne | Moyen |

---

## 6. Priorités d'Action Recommandées

### Phase 1 — Critique (Immédiat)
1. ✅ Ajouter **Firestore Security Rules** (F3, F4, E2)
2. ✅ Créer un **`.gitignore`** propre (F16)
3. ✅ Corriger la **logique de cache** (F6)
4. ✅ Fixer le **generateCode()** avec compteur Firestore (F7)
5. ✅ Ajouter la **sanitization HTML** (F12)

### Phase 2 — Important (Court terme)
6. Supprimer les **fichiers morts** (F5, F14, F15)
7. Extraire les **styles inline** vers CSS (F11)
8. Synchroniser les **collections mobile/web** (F10)
9. Ajouter **validation formulaires** robuste (E13)
10. Ajouter **pagination** (E6)

### Phase 3 — Amélioration (Moyen terme)
11. Ajouter l'**export PDF** (E8)
12. Implémenter le **mode offline** (E10)
13. Compléter les **modules mobile** (E15)
14. Ajouter les **notifications push** (E9, E16)

### Phase 4 — Évolution (Long terme)
15. **Améliorer architecture vanilla JS** — bundler + templates (E1)
16. **Gestion stock** (E14)
17. **i18n** arabe (E23)
18. **GPS tracking background** mobile (E18)

---

## 7. Statistiques du Projet

| Métrique | Valeur |
|----------|--------|
| **Fichiers JS (web)** | 33 fichiers (~500KB total) |
| **Fichiers TS (mobile)** | ~20 fichiers |
| **Lignes HTML** | ~1,600 (index.html + login.html) |
| **Lignes CSS** | ~1,700 |
| **Collections Firestore** | 20+ |
| **Modules fonctionnels** | 15 (Dashboard, Entries, Planning, Achat×6, Vente×6, Caisse, Messenger, Tracking, Reports, Profile, Admin) |
| **Fichiers morts identifiés** | ~8 fichiers (~90KB) |

---

---

# 8. Analyse Approfondie — Module Achat

## 8.1 Workflow Achat (Flux Complet)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Demande Achat   │────▶│  Bon Commande    │────▶│  Bon Livraison   │────▶│    Facture       │────▶│   Règlement     │
│  (DA)            │     │  (BC)            │     │  (BL)            │     │  Fournisseur     │     │  (Échéances)    │
│                  │     │                  │     │                  │     │                  │     │                 │
│ Statut:          │     │ Statut:          │     │ Statut: Reçu     │     │ Etat:            │     │ Statut:         │
│ Brouillon→       │     │ En cours→        │     │                  │     │ Non Payée→       │     │ En attente→     │
│ En cours→        │     │ Partiellement    │     │ ⬇ Stock +        │     │ Partiel→         │     │ Payé            │
│ Validée→Rejetée  │     │ livré→Livré      │     │                  │     │ Payée            │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                                                                          │
                                                                                                          ▼
                                                                                                  ┌───────────────┐
                                                                                                  │   Caisse       │
                                                                                                  │ (Décaissement) │
                                                                                                  └───────────────┘
```

### 8.1.1 Fichiers Impliqués
| Fichier | Rôle | Lignes |
|---------|------|--------|
| `js/achat-local.js` | UI Achat (DA, BC, BL, Factures, Règlements, Sorties) | ~1401 lignes |
| `js/suppliers-firebase.js` | Data layer (CRUD Firestore pour tous les documents achat + fournisseurs) | ~387 lignes |
| `js/purchase-orders-firebase.js` | Module BC alternatif avec TVA (HT/TVA/TTC) | ~449 lignes |
| `js/articles-firebase.js` | Articles (achat & vente) | ~249 lignes |
| `js/caisse-firebase.js` | Trésorerie (décaissements auto depuis règlements) | ~275 lignes |

### 8.1.2 Calculs Achat

**Lignes DA / BC (achat-local.js):**
```
prixTotal = prixUnitaire × quantité       (simple, sans TVA)
montantTotal = Σ lignes.prixTotal
```

**Lignes BC (purchase-orders-firebase.js) — Format différent !**
```
totalHT  = quantité × prixUnitaire
totalTVA = totalHT × (tva / 100)          (TVA par défaut: 19%)
totalTTC = totalHT + totalTVA
```

**Facture Achat:**
```
montantTotal = calculé depuis BL (quantitéReçue × prixUnitaire de la commande)
Payé  = Σ échéances[statut='Payé'].montant
Etat  = 'Payée'     si Payé ≥ montantTotal
        'Partiel'    si Payé > 0
        'Non Payée'  sinon
```

**Impact Stock (BL Achat → Articles):**
```
article.stock += ligne.quantiteRecue   // À la réception du BL
```

**Impact Camion (BC Achat → Charges Fixes):**
```
truck.chargesFixes += order.totalTTC   // Si camion lié au BC
// En cas de suppression du BC: truck.chargesFixes -= order.totalTTC (min 0)
```

### 8.1.3 Livraison Partielle
Le BL Achat gère la livraison partielle :
- Calcul `déjàReçu` par article en sommant les BLs existants liés au même BC
- `restant = quantitéCommandée - déjàReçu`
- Mise à jour automatique du statut BC : `En cours` → `Partiellement livré` → `Livré`

---

# 9. Analyse Approfondie — Module Vente

## 9.1 Workflow Vente (Flux Complet)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Devis / Offre   │────▶│  Bon Commande    │────▶│  BL Client       │────▶│  Facture Client  │────▶│  Règlement      │
│  Client          │     │  Vente (BCV)     │     │  (BLC)           │     │  (FC)            │     │  Client         │
│                  │     │                  │     │                  │     │                  │     │                 │
│ Statut:          │     │ Statut:          │     │ Statut: Livré    │     │ Etat:            │     │ → Caisse        │
│ Brouillon→       │     │ Brouillon→       │     │                  │     │ Non Payée→       │     │ (Encaissement)  │
│ Envoyé→          │     │ En cours→        │     │                  │     │ Partiel→         │     │                 │
│ Accepté→Refusé   │     │ Confirmé→Validé  │     │                  │     │ Payée            │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                                                               │
        │ Transformer                                                                                   ▼
        └──────────────▶ BCV auto-créé                                                          ┌───────────────┐
                                                                                                │   Caisse       │
                                                                                                │(Encaissement)  │
                                                                                                └───────────────┘
```

### 9.1.1 Fichiers Impliqués
| Fichier | Rôle | Lignes |
|---------|------|--------|
| `js/vente-local.js` | UI Vente (Devis, BL Client, Factures Client, Règlements Client) | ~1098 lignes |
| `js/sales-orders-firebase.js` | BC Vente avec TVA (HT/TVA/TTC) | ~384 lignes |
| `js/clients-firebase.js` | Data layer clients | ~180 lignes |
| `js/caisse-firebase.js` | Trésorerie (encaissements auto) | ~275 lignes |

### 9.1.2 Calculs Vente

**Devis Client:**
```
montantTotal = Σ (ligne.quantité × ligne.prixUnitaire)    (HT simple)
```

**BC Vente (sales-orders-firebase.js):**
```
totalHT  = quantité × prixUnitaire
totalTVA = totalHT × (tva / 100)          (TVA par défaut: 19%)
totalTTC = totalHT + totalTVA
```

**BL Client:**
```
montantTotal = Σ (quantitéLivrée × prixUnitaire)
// Quantité livrée peut être ≤ quantité commandée
```

**Facture Client:**
```
montantTotal = auto-rempli depuis BL montantTotal
Payé  = Σ échéances[statut='Payé'].montant
Etat  = 'Payée'     si Payé ≥ montantTotal
        'Partiel'    si Payé > 0
        'Non Payée'  sinon
```

**Lien Caisse (automatique):**
```
// À chaque échéance marquée 'Payé':
CaisseModule.addAutoTransaction({
    type: 'encaissement',
    tiers: client.nom,
    montant: échéance.montant,
    mode: échéance.typePaiement,
    reference: facture.numero,
    source: 'vente'
})
```

### 9.1.3 Transformation Devis → BC
```
Devis (Accepté) → BC Vente auto-créé (statut: Confirmé)
   - Les lignes du devis sont copiées vers le BC
   - Le devis est marqué avec bcId
```

---

# 10. Interconnexion des Modules

## 10.1 Graphe de Dépendances

```
                    ┌──────────────┐
                    │  firebase.js  │  (Config + exports centralisés)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──┐   ┌────▼─────┐  ┌──▼──────────┐
     │ data-     │   │ auth-    │  │ caisse-     │
     │ firebase  │   │ firebase │  │ firebase    │
     └────┬──────┘   └──────────┘  └──────┬──────┘
          │                                │
    ┌─────┼─────────────┐          ┌───────┼────────┐
    │     │             │          │       │        │
┌───▼──┐ ┌▼────────┐ ┌─▼──────┐  │  ┌────▼────┐   │
│trucks│ │suppliers│ │clients │  │  │achat-   │   │
│      │ │         │ │        │  │  │local    │   │
└──┬───┘ └──┬──────┘ └──┬─────┘  │  └────┬────┘   │
   │        │           │        │       │        │
   │   ┌────▼──────┐ ┌──▼──────┐ │  ┌────▼────┐   │
   │   │purchase-  │ │sales-   │ │  │vente-   │───┘
   │   │orders     │ │orders   │ │  │local    │
   │   └───────────┘ └─────────┘ │  └─────────┘
   │                             │
   ▼                             │
┌──────────┐   ┌────────────┐    │
│entries-  │   │articles-   │◀───┘  (stock update via BL Achat)
│firebase  │   │firebase    │
└──────────┘   └────────────┘
```

## 10.2 Liens de Données Clés

| Lien | Module Source | Module Cible | Mécanisme |
|------|-------------|-------------|-----------|
| BC Achat → Charges Camion | `purchase-orders-firebase.js` | `trucks` collection | `truck.chargesFixes += order.totalTTC` |
| BL Achat → Stock Articles | `achat-local.js:684-700` | `articles` collection | `article.stock += quantiteRecue` |
| Règlement Achat → Caisse | `achat-local.js` (manquant!) | `caisse_transactions` | **NON IMPLÉMENTÉ** côté Achat |
| Règlement Vente → Caisse | `vente-local.js:547-570` | `caisse_transactions` | `CaisseModule.addAutoTransaction()` encaissement |
| Devis → BC Vente | `vente-local.js:851-887` | `bon_commandes_vente` | Copie lignes, statut Confirmé |
| DA → BC Achat | `achat-local.js:428-456` | UI (copie manuelle) | Lignes pré-remplies depuis DA |
| BC Achat → BL Achat | `achat-local.js:617-646` | UI (copie manuelle) | Quantités avec suivi partiel |
| BL Achat → Facture | `achat-local.js:783-797` | UI (montant auto) | Montant = Σ(qté reçue × prix BC) |
| BC Vente → BL Vente | `vente-local.js:233-258` | UI (copie manuelle) | Quantités livrées depuis BC |
| BL Vente → Facture Client | `vente-local.js:507-521` | UI (montant auto) | Montant = BL montantTotal |
| Entries → Dashboard | `entries-firebase.js` | `dashboard-firebase.js` | KPIs calculés par date |
| Entries → Profil Camion/Chauffeur | `entries-firebase.js` | `profile-firebase.js` | Stats filtrées par entité |

---

# 11. Problèmes Profonds Identifiés (Achat/Vente)

## 11.1 🔴 Bugs Critiques

| # | Problème | Détail | Fichier(s) |
|---|----------|--------|-----------|
| **D1** | **Deux systèmes de BC Achat parallèles et incompatibles** | `achat-local.js` crée des BC **sans TVA** (prixTotal simple) tandis que `purchase-orders-firebase.js` crée des BC **avec TVA** (HT/TVA/TTC). Les deux écrivent dans la **même collection** `bon_commandes_achat` mais avec des **structures différentes**. | `achat-local.js:474-511` vs `purchase-orders-firebase.js:301-363` |
| **D2** | **Règlement Achat ne crée PAS de décaissement en Caisse** | Contrairement au module Vente qui crée automatiquement un encaissement dans la Caisse à chaque paiement, le module Achat **ne crée aucun décaissement**. La Caisse ne reflète donc pas les sorties liées aux achats. | `achat-local.js:923-962` (absent), vs `vente-local.js:547-570` (présent) |
| **D3** | **Le BC Achat (purchase-orders) modifie directement `chargesFixes` du camion** | Chaque BC lié à un camion ajoute `totalTTC` aux charges fixes. Problème : les charges fixes sont censées être fixes (assurance, taxe, personnel). Les achats devraient être des **charges variables** ou un champ séparé. Cela fausse les calculs de coût par km dans le Dashboard. | `purchase-orders-firebase.js:334-354` |
| **D4** | **BL Vente ne réduit PAS le stock** | Contrairement au BL Achat qui **augmente** le stock, le BL Vente (client) **ne réduit pas** le stock des articles livrés. Le stock ne fait qu'augmenter. | `vente-local.js:277-321` (absent) vs `achat-local.js:684-700` (présent) |
| **D5** | **`transformToBL` est un stub** | Les boutons "Transformer en BL" sur les BC Achat et BC Vente affichent juste `alert('Fonctionnalité en développement')`. | `purchase-orders-firebase.js:412-414`, `sales-orders-firebase.js:364-366` |

## 11.2 🟠 Incohérences de Calcul

| # | Problème | Détail | Impact |
|---|----------|--------|--------|
| **D6** | **TVA incohérente** | `achat-local.js` et `vente-local.js` calculent en TTC simple (prixTotal = PU × qté), tandis que `purchase-orders-firebase.js` et `sales-orders-firebase.js` calculent HT + TVA%. Les deux formats coexistent dans Firestore. | Factures achat/vente montants potentiellement incorrects |
| **D7** | **Montant facture achat = BL × prix BC, pas prix DA** | La facture achat calcule le montant depuis les prix du BC, pas depuis les prix réellement facturés par le fournisseur. Le champ `montantTotal` est en `readonly`. | Le montant réel de la facture fournisseur peut différer |
| **D8** | **Pas de TVA sur les factures** | Les factures (achat et vente) n'ont **aucun** champ TVA, timbre fiscal, ou remise. Le montant est un simple total. | Non conforme à la législation fiscale tunisienne |
| **D9** | **Solde fournisseur/client jamais mis à jour** | Les fournisseurs et clients ont un champ `solde` mais celui-ci n'est **jamais recalculé** automatiquement lors des factures ou règlements. Il reste à la valeur initiale saisie. | `suppliers-firebase.js:154`, `clients-firebase.js` |
| **D10** | **Numérotation non séquentielle** | Les numéros DA, BC, BL, FA utilisent `Date.now().toString().slice(-6)` ce qui donne des numéros aléatoires (ex: `DA-456789`), pas des séquences (ex: `DA-2026-0001`). | Impossible de suivre la séquence des documents |
| **D11** | **Pas de lien retour DA → BC** | Quand un BC est créé depuis une DA, la DA n'est pas mise à jour (statut "Transformée"). Elle reste "Validée" et peut être utilisée pour créer un autre BC. | Doublons possibles |

## 11.3 🟡 Données Manquantes

| # | Problème | Détail |
|---|----------|--------|
| **D12** | **Pas de Bon de Retour Achat** | Le workflow achat ne gère pas les retours fournisseur (articles non conformes) |
| **D13** | **Pas de gestion des avoirs** | Ni côté achat ni côté vente |
| **D14** | **Pas de numéro de série / lot** | Les articles n'ont pas de traçabilité par lot |
| **D15** | **Pas de remise par ligne ou globale** | Aucun mécanisme de remise commerciale |
| **D16** | **`window._orderLines` / `window._orderArticles`** | Les BC Achat et Vente stockent les lignes dans des variables globales `window.*`, ce qui peut causer des conflits si deux modals sont ouverts | 

---

# 12. Calculs du Module Transport (Entries)

## 12.1 Formules de Coût par Trajet

```javascript
// data-firebase.js - calculateEntryCosts(entry, truck)

montantGasoil = entry.quantiteGasoil × entry.prixGasoilLitre
chargesFixes  = truck.chargesFixes + truck.montantAssurance + truck.montantTaxe + truck.chargePersonnel
                // ⚠️ chargesFixes est CUMULÉ avec les BC Achat (voir D3)
coutTotal     = montantGasoil + entry.maintenance + chargesFixes
resultat      = entry.prixLivraison - coutTotal
```

## 12.2 Distance Aller-Retour

```javascript
// Utilise locations.js (GPS coords de chaque délégation tunisienne)
distanceAller  = haversine(origine, destination)
distanceRetour = distanceAller  // Même distance (simplifié)
kilometrage    = distanceAller + distanceRetour  // Ou saisie manuelle
```

## 12.3 KPIs Dashboard

```javascript
totalKm      = Σ entries.kilometrage
totalGasoil  = Σ entries.quantiteGasoil
totalCost    = Σ calculateEntryCosts(entry).coutTotal
totalRevenue = Σ entries.prixLivraison
result       = totalRevenue - totalCost
costPerKm    = totalCost / totalKm
```

---

# 13. Recommandations Spécifiques Achat/Vente

## 13.1 Fixes Critiques à Implémenter

| # | Action | Priorité | Fichier(s) |
|---|--------|----------|-----------|
| **R1** | **Unifier le système de BC Achat** — Supprimer le doublon `purchase-orders-firebase.js` ou fusionner avec `achat-local.js`. Un seul format de BC avec TVA. | 🔴 Critique | `purchase-orders-firebase.js`, `achat-local.js` |
| **R2** | **Ajouter le décaissement automatique en Caisse** pour les règlements achat (comme c'est fait pour la vente) | 🔴 Critique | `achat-local.js` |
| **R3** | **Réduire le stock** lors du BL Vente (comme le BL Achat augmente le stock) | 🔴 Critique | `vente-local.js` |
| **R4** | **Séparer les charges BC des charges fixes camion** — Les achats liés à un camion ne doivent pas modifier `chargesFixes`. Créer un champ `chargesAchat` ou une collection séparée. | 🔴 Critique | `purchase-orders-firebase.js`, `data-firebase.js` |
| **R5** | **Mettre à jour le solde fournisseur/client** automatiquement à chaque facture et règlement | 🟠 Important | `suppliers-firebase.js`, `clients-firebase.js`, `achat-local.js`, `vente-local.js` |
| **R6** | **Mettre à jour la DA quand un BC est créé** (statut → "Transformée", lien vers BC) | 🟠 Important | `achat-local.js` |
| **R7** | **Ajouter TVA + Timbre Fiscal** aux factures achat et vente | 🟠 Important | `achat-local.js`, `vente-local.js` |
| **R8** | **Implémenter `transformToBL()`** pour les deux modules BC (achat + vente) | 🟠 Important | `purchase-orders-firebase.js`, `sales-orders-firebase.js` |
| **R9** | **Numérotation séquentielle** persistante via un compteur Firestore (ex: `counters/DA → {next: 145}`) | 🟠 Important | Tous les modules |
| **R10** | **Éliminer `window._orderLines`** — utiliser des closures ou un state local au module | 🟡 Qualité | `purchase-orders-firebase.js`, `sales-orders-firebase.js` |

## 13.2 Améliorations Fonctionnelles Achat/Vente

| # | Amélioration | Priorité |
|---|-------------|----------|
| **R11** | **Gestion des Bons de Retour** Achat (retour fournisseur) avec impact stock inverse | Moyenne |
| **R12** | **Avoir / Note de crédit** pour les factures erronées | Moyenne |
| **R13** | **Remise par ligne et remise globale** avec recalcul automatique | Haute |
| **R14** | **Impression / Export PDF** des documents (DA, BC, BL, Facture) au format officiel tunisien | Haute |
| **R15** | **Historique / Timeline** de chaque document (qui a créé, modifié, validé, quand) | Moyenne |
| **R16** | **Alertes échéances** — notification quand une échéance arrive à terme | Moyenne |
| **R17** | **Rapprochement bancaire** dans la Caisse | Basse |
| **R18** | **Tableau de bord Achat/Vente** avec KPIs spécifiques (volume achat mensuel, top fournisseurs, marge brute par client, etc.) | Haute |

---

# 14. Résumé des Priorités d'Action Mises à Jour

## Phase 0 — Correction Urgente (Avant Utilisation Production)
1. **R1** — Unifier les BC Achat (doublon critique)
2. **R2** — Décaissement Caisse pour Achat
3. **R3** — Réduction stock sur BL Vente
4. **R4** — Séparer charges BC / charges fixes camion
5. **D8/R7** — Ajouter TVA aux factures

## Phase 1 — Intégrité des Données
6. **R5** — Mise à jour soldes fournisseurs/clients
7. **R6** — Lien retour DA → BC
8. **R9** — Numérotation séquentielle
9. **R8** — Implémenter transformToBL()
10. **D4/R10** — Nettoyage variables globales

## Phase 2 — Conformité & Fonctionnel
11. **R7** — TVA + Timbre Fiscal (conformité tunisienne)
12. **R14** — Export PDF documents officiels
13. **R13** — Remises commerciales
14. **R18** — Dashboard Achat/Vente

## Phase 3 — Améliorations
15. **R11** — Bons de Retour
16. **R12** — Avoirs
17. **R15** — Historique documents
18. **R16** — Alertes échéances

---

> **✅ Fixes appliqués le 16/02/2026 — Session 2**

## Corrections Appliquées (Session 2)

### Bugs Storage/Display Corrigés
| Fix | Description | Fichier |
|-----|-------------|---------|
| **F1** | `await` manquant sur `ArticlesModule.getArticles()` — stock fallback silencieusement échoué | `achat-local.js:701` |
| **F2** | Bug cache F6 (`_loaded` flag) dans `articles-firebase.js` — re-fetch infini sur collection vide | `articles-firebase.js` |
| **F3** | Imports dynamiques redondants dans boucle BL Vente — remplacés par imports directs `getDoc/setDoc` | `vente-local.js` |
| **F4** | Bug cache F6 dans `sales-orders-firebase.js` | `sales-orders-firebase.js` |
| **F5** | Bug cache F6 dans `purchase-orders-firebase.js` | `purchase-orders-firebase.js` |
| **F6** | Bug cache F6 dans `planification-firebase.js` | `planification-firebase.js` |
| **F7** | Bug cache F6 dans `caisse-firebase.js` | `caisse-firebase.js` |
| **F8** | Tous les `await import()` dynamiques dans `achat-local.js` remplacés par imports directs | `achat-local.js` |

### Liaison Achat/Vente ↔ Caisse
| Fix | Description | Fichier |
|-----|-------------|---------|
| **C1** | Achat Facture: échéances payées créent auto-décaissements Caisse avec `caisseId` stocké | `achat-local.js` |
| **C2** | Achat Règlement: crée auto-décaissement Caisse avant ajout échéance | `achat-local.js` |
| **C3** | Vente Facture: échéances payées créent auto-encaissements Caisse avec `caisseId` stocké | `vente-local.js` |
| **C4** | Vente Règlement: crée auto-encaissement Caisse avant ajout échéance | `vente-local.js` |
| **C5** | Suppression facture Achat: nettoie les transactions Caisse liées + recalcule solde fournisseur | `achat-local.js` |
| **C6** | Suppression facture Vente: nettoie les transactions Caisse liées + recalcule solde client | `vente-local.js` |
| **C7** | `removeAutoTransaction()` ajouté au module Caisse | `caisse-firebase.js` |
| **C8** | Badge source (Achat/Vente) affiché dans table Caisse + protection édition auto-tx | `caisse-firebase.js` |

### Flux Caisse Complet
```
ACHAT:  Facture/Règlement → CaisseModule.addAutoTransaction(décaissement) → caisseId stocké sur échéance
VENTE:  Facture/Règlement → CaisseModule.addAutoTransaction(encaissement) → caisseId stocké sur échéance
DELETE: Facture supprimée → CaisseModule.removeAutoTransaction(caisseId) pour chaque échéance
```
