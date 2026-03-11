/**
 * MAIN APPLICATION
 * Handles navigation, initialization, and global functions
 */

const App = (() => {
    let currentPage = 'dashboard';
    let selectedDate = new Date().toISOString().split('T')[0];

    function init() {
        // Initialize data
        DataModule.init();

        // Initialize modules
        DashboardModule.init();
        TrucksModule.init();
        DriversModule.init();
        EntriesModule.init();
        ReportsModule.init();

        // Setup navigation
        setupNavigation();

        // Setup date picker
        setupDatePicker();

        // Setup modal
        setupModal();

        // Setup settings
        setupSettings();

        // Setup export/import
        setupDataActions();

        // Update current date display
        updateDateDisplay();

        // Navigate to dashboard
        navigateTo('dashboard');
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                navigateTo(page);
            });
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
    }

    function navigateTo(page) {
        currentPage = page;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Hide all pages, show current
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        document.getElementById(`page-${page}`)?.classList.add('active');

        // Update page title
        const titles = {
            dashboard: 'Tableau de bord',
            entries: 'Saisie journalière',
            trucks: 'Gestion des Camions',
            drivers: 'Gestion des Chauffeurs',
            reports: 'Rapports Mensuels',
            settings: 'Paramètres'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // Refresh page data
        refreshCurrentPage();
    }

    function refreshCurrentPage() {
        switch (currentPage) {
            case 'dashboard':
                DashboardModule.refresh(selectedDate);
                break;
            case 'entries':
                EntriesModule.refresh(selectedDate);
                break;
            case 'trucks':
                TrucksModule.refresh();
                break;
            case 'drivers':
                DriversModule.refresh();
                break;
            case 'reports':
                ReportsModule.refresh();
                break;
        }
    }

    function setupDatePicker() {
        const datePicker = document.getElementById('selectedDate');
        if (datePicker) {
            datePicker.value = selectedDate;
            datePicker.addEventListener('change', (e) => {
                selectedDate = e.target.value;
                updateDateDisplay();
                refreshCurrentPage();
            });
        }
    }

    function updateDateDisplay() {
        const display = document.getElementById('currentDate');
        if (display) {
            const date = new Date(selectedDate);
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

        // Close on Escape key
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

    function setupSettings() {
        // Save fuel price
        document.getElementById('saveFuelPrice')?.addEventListener('click', () => {
            const price = parseFloat(document.getElementById('defaultFuelPrice').value) || 2;
            const settings = DataModule.getSettings();
            settings.defaultFuelPrice = price;
            DataModule.saveSettings(settings);
            alert('Prix gasoil enregistré: ' + price + ' TND/L');
        });

        // Load current fuel price
        const settings = DataModule.getSettings();
        const priceInput = document.getElementById('defaultFuelPrice');
        if (priceInput) priceInput.value = settings.defaultFuelPrice;

        // Reset data
        document.getElementById('resetDataBtn')?.addEventListener('click', () => {
            if (confirm('Cette action va réinitialiser toutes les données aux valeurs par défaut. Continuer ?')) {
                DataModule.resetData();
                location.reload();
            }
        });
    }

    function setupDataActions() {
        // Export button in sidebar
        document.getElementById('exportBtn')?.addEventListener('click', exportData);

        // Export button in settings
        document.getElementById('exportDataBtn')?.addEventListener('click', exportData);

        // Import
        document.getElementById('importDataInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    DataModule.importData(data);
                    alert('Données importées avec succès!');
                    location.reload();
                } catch (err) {
                    alert('Erreur lors de l\'import: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    function exportData() {
        const data = DataModule.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `fleettrack_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return {
        init,
        navigateTo,
        refreshCurrentPage,
        showModal,
        hideModal
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
