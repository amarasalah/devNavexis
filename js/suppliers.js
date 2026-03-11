/**
 * SUPPLIERS MODULE
 * Gestion des fournisseurs pour achat local
 */

const SuppliersModule = (() => {
    const STORAGE_KEY = 'fleettrack_suppliers';
    const PURCHASE_ORDERS_KEY = 'fleettrack_purchase_orders';
    const DELIVERY_NOTES_KEY = 'fleettrack_delivery_notes';
    const SUPPLIER_INVOICES_KEY = 'fleettrack_supplier_invoices';
    const PRICE_QUOTES_KEY = 'fleettrack_price_quotes';

    // Sample suppliers based on ERP screenshots
    const DEFAULT_SUPPLIERS = [
        { id: 's1', code: 'BMB', nom: 'BMB', type: 'Pièces détachées', tel: '', email: '', adresse: '' },
        { id: 's2', code: 'DIRALEC', nom: 'Ste Diralec', type: 'Fournitures', tel: '', email: '', adresse: '' },
        { id: 's3', code: 'HYDRAUFLEX', nom: 'STE HYDRAUFLEX KARRA', type: 'Hydraulique', tel: '', email: '', adresse: '' },
        { id: 's4', code: 'SAT', nom: 'Société Acier et Technologie SAT', type: 'Acier', tel: '', email: '', adresse: '' },
        { id: 's5', code: 'MAK', nom: 'MAK LADA', type: 'Pièces détachées', tel: '', email: '', adresse: '' },
        { id: 's6', code: 'SPCF', nom: 'SPCF', type: 'Fournitures', tel: '', email: '', adresse: '' },
        { id: 's7', code: 'SHB', nom: 'Société Hajjej de Bois - SHB', type: 'Bois', tel: '', email: '', adresse: '' },
        { id: 's8', code: 'SIREP', nom: 'SIREP BETON', type: 'Béton', tel: '', email: '', adresse: '' },
        { id: 's9', code: 'CIS', nom: 'COMPTOIR INDUSTRIEL DU SUD - CIS', type: 'Industriel', tel: '', email: '', adresse: '' },
        { id: 's10', code: 'DISCOUNT', nom: 'Ste Discount Informatique', type: 'Informatique', tel: '', email: '', adresse: '' },
        { id: 's11', code: 'ZAIBI', nom: 'STE COMPTOIR ZAIBI MC', type: 'Pièces détachées', tel: '', email: '', adresse: '' },
        { id: 's12', code: 'TSM', nom: 'Tournage et Services Mécanique - TSM', type: 'Mécanique', tel: '', email: '', adresse: '' },
        { id: 's13', code: 'ITALCAR', nom: 'ITALCAR', type: 'Pièces véhicules', tel: '', email: '', adresse: '' },
        { id: 's14', code: 'SPPL', nom: 'Société Pièces Poids Lourds - SPPL', type: 'Poids lourds', tel: '', email: '', adresse: '' },
        { id: 's15', code: 'TMT', nom: 'TUNISIE MOSAIQUE TRANSPORT T.M.T', type: 'Transport', tel: '', email: '', adresse: '' },
        { id: 's16', code: 'STEG', nom: 'STEG', type: 'Services', tel: '', email: '', adresse: '' }
    ];

    // Generate ID
    function generateId(prefix) {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    // Storage helpers
    function getFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading from storage:', e);
            return null;
        }
    }

    function saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to storage:', e);
            return false;
        }
    }

    // Initialize
    function init() {
        if (!getFromStorage(STORAGE_KEY)) {
            saveToStorage(STORAGE_KEY, DEFAULT_SUPPLIERS);
        }
        if (!getFromStorage(PURCHASE_ORDERS_KEY)) {
            saveToStorage(PURCHASE_ORDERS_KEY, []);
        }
        if (!getFromStorage(DELIVERY_NOTES_KEY)) {
            saveToStorage(DELIVERY_NOTES_KEY, []);
        }
        if (!getFromStorage(SUPPLIER_INVOICES_KEY)) {
            saveToStorage(SUPPLIER_INVOICES_KEY, []);
        }
        if (!getFromStorage(PRICE_QUOTES_KEY)) {
            saveToStorage(PRICE_QUOTES_KEY, []);
        }
    }

    // ==================== SUPPLIERS ====================
    function getSuppliers() {
        return getFromStorage(STORAGE_KEY) || [];
    }

    function getSupplierById(id) {
        return getSuppliers().find(s => s.id === id);
    }

    function saveSupplier(supplier) {
        const suppliers = getSuppliers();
        const index = suppliers.findIndex(s => s.id === supplier.id);
        if (index >= 0) {
            suppliers[index] = supplier;
        } else {
            supplier.id = supplier.id || generateId('s');
            suppliers.push(supplier);
        }
        saveToStorage(STORAGE_KEY, suppliers);
        return supplier;
    }

    function deleteSupplier(id) {
        const suppliers = getSuppliers().filter(s => s.id !== id);
        saveToStorage(STORAGE_KEY, suppliers);
    }

    // ==================== PURCHASE ORDERS (BON COMMANDE) ====================
    function getPurchaseOrders() {
        return getFromStorage(PURCHASE_ORDERS_KEY) || [];
    }

    function getPurchaseOrderById(id) {
        return getPurchaseOrders().find(po => po.id === id);
    }

    function savePurchaseOrder(po) {
        const orders = getPurchaseOrders();
        const index = orders.findIndex(o => o.id === po.id);
        if (index >= 0) {
            orders[index] = po;
        } else {
            po.id = po.id || generateId('BC');
            po.date = po.date || new Date().toISOString().split('T')[0];
            orders.push(po);
        }
        saveToStorage(PURCHASE_ORDERS_KEY, orders);
        return po;
    }

    function deletePurchaseOrder(id) {
        const orders = getPurchaseOrders().filter(o => o.id !== id);
        saveToStorage(PURCHASE_ORDERS_KEY, orders);
    }

    function transformToDeliveryNote(poId) {
        const po = getPurchaseOrderById(poId);
        if (!po) return null;

        const bl = {
            id: generateId('BL'),
            poId: po.id,
            poNumber: po.numero,
            date: new Date().toISOString().split('T')[0],
            fournisseurId: po.fournisseurId,
            fournisseur: po.fournisseur,
            depot: po.depot || 'Magasin principal',
            articles: po.articles?.map(a => ({...a, recu: a.quantite})) || [],
            statut: 'Reçu',
            camionId: po.camionId || null,
            maintenanceType: po.maintenanceType || null
        };

        saveDeliveryNote(bl);
        
        // Update PO status
        po.statut = 'Transformé';
        po.blId = bl.id;
        savePurchaseOrder(po);

        return bl;
    }

    // ==================== DELIVERY NOTES (BON LIVRAISON) ====================
    function getDeliveryNotes() {
        return getFromStorage(DELIVERY_NOTES_KEY) || [];
    }

    function getDeliveryNoteById(id) {
        return getDeliveryNotes().find(bl => bl.id === id);
    }

    function saveDeliveryNote(bl) {
        const notes = getDeliveryNotes();
        const index = notes.findIndex(n => n.id === bl.id);
        if (index >= 0) {
            notes[index] = bl;
        } else {
            notes.push(bl);
        }
        saveToStorage(DELIVERY_NOTES_KEY, notes);
        return bl;
    }

    function deleteDeliveryNote(id) {
        const notes = getDeliveryNotes().filter(n => n.id !== id);
        saveToStorage(DELIVERY_NOTES_KEY, notes);
    }

    // ==================== SUPPLIER INVOICES (FACTURE FOURNISSEUR) ====================
    function getSupplierInvoices() {
        return getFromStorage(SUPPLIER_INVOICES_KEY) || [];
    }

    function getSupplierInvoiceById(id) {
        return getSupplierInvoices().find(f => f.id === id);
    }

    function saveSupplierInvoice(invoice) {
        const invoices = getSupplierInvoices();
        const index = invoices.findIndex(i => i.id === invoice.id);
        if (index >= 0) {
            invoices[index] = invoice;
        } else {
            invoice.id = invoice.id || generateId('FC');
            invoice.date = invoice.date || new Date().toISOString().split('T')[0];
            invoice.montantRegle = invoice.montantRegle || 0;
            invoices.push(invoice);
        }
        saveToStorage(SUPPLIER_INVOICES_KEY, invoices);
        return invoice;
    }

    function deleteSupplierInvoice(id) {
        const invoices = getSupplierInvoices().filter(i => i.id !== id);
        saveToStorage(SUPPLIER_INVOICES_KEY, invoices);
    }

    function getPendingInvoices() {
        return getSupplierInvoices().filter(i => i.etat !== 'Payée');
    }

    function getPaidInvoices() {
        return getSupplierInvoices().filter(i => i.etat === 'Payée');
    }

    // ==================== PRICE QUOTES (DEMANDES OFFRES PRIX) ====================
    function getPriceQuotes() {
        return getFromStorage(PRICE_QUOTES_KEY) || [];
    }

    function savePriceQuote(quote) {
        const quotes = getPriceQuotes();
        const index = quotes.findIndex(q => q.id === quote.id);
        if (index >= 0) {
            quotes[index] = quote;
        } else {
            quote.id = quote.id || generateId('DF');
            quote.date = quote.date || new Date().toISOString().split('T')[0];
            quote.statut = quote.statut || 'En cours';
            quotes.push(quote);
        }
        saveToStorage(PRICE_QUOTES_KEY, quotes);
        return quote;
    }

    function deletePriceQuote(id) {
        const quotes = getPriceQuotes().filter(q => q.id !== id);
        saveToStorage(PRICE_QUOTES_KEY, quotes);
    }

    // ==================== REPORTS / STATS ====================
    function getSupplierStats(supplierId) {
        const invoices = getSupplierInvoices().filter(i => i.fournisseurId === supplierId);
        const totalFactures = invoices.reduce((sum, i) => sum + (parseFloat(i.montant) || 0), 0);
        const totalPaye = invoices.reduce((sum, i) => sum + (parseFloat(i.montantRegle) || 0), 0);
        
        return {
            totalFactures,
            totalPaye,
            totalDu: totalFactures - totalPaye,
            nombreFactures: invoices.length
        };
    }

    function getMaintenanceByTruck(camionId) {
        const notes = getDeliveryNotes().filter(n => n.camionId === camionId);
        const invoices = getSupplierInvoices().filter(i => notes.some(n => n.id === i.blId));
        
        return {
            interventions: notes.length,
            totalCost: invoices.reduce((sum, i) => sum + (parseFloat(i.montant) || 0), 0),
            notes,
            invoices
        };
    }

    // Export
    return {
        init,
        // Suppliers
        getSuppliers,
        getSupplierById,
        saveSupplier,
        deleteSupplier,
        // Purchase Orders
        getPurchaseOrders,
        getPurchaseOrderById,
        savePurchaseOrder,
        deletePurchaseOrder,
        transformToDeliveryNote,
        // Delivery Notes
        getDeliveryNotes,
        getDeliveryNoteById,
        saveDeliveryNote,
        deleteDeliveryNote,
        // Invoices
        getSupplierInvoices,
        getSupplierInvoiceById,
        saveSupplierInvoice,
        deleteSupplierInvoice,
        getPendingInvoices,
        getPaidInvoices,
        // Price Quotes
        getPriceQuotes,
        savePriceQuote,
        deletePriceQuote,
        // Stats
        getSupplierStats,
        getMaintenanceByTruck
    };
})();

// Initialize if in browser
if (typeof window !== 'undefined') {
    window.SuppliersModule = SuppliersModule;
}
