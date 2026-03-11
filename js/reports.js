/**
 * REPORTS MODULE
 * Handles monthly recap and data export
 */

const ReportsModule = (() => {
    function init() {
        document.getElementById('reportMonth')?.addEventListener('change', refresh);
        populateMonthSelector();
    }

    function populateMonthSelector() {
        const select = document.getElementById('reportMonth');
        if (!select) return;

        // Get unique months from entries
        const entries = DataModule.getEntries();
        const months = new Set();

        entries.forEach(entry => {
            const date = new Date(entry.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(key);
        });

        const sortedMonths = Array.from(months).sort().reverse();

        select.innerHTML = sortedMonths.map(m => {
            const [year, month] = m.split('-');
            const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            return `<option value="${m}">${monthName}</option>`;
        }).join('');

        // Add current month if no entries
        if (sortedMonths.length === 0) {
            const now = new Date();
            const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            select.innerHTML = `<option value="${current}">${monthName}</option>`;
        }
    }

    function refresh() {
        renderMonthlyReport();
    }

    function renderMonthlyReport() {
        const select = document.getElementById('reportMonth');
        const tbody = document.getElementById('monthlyBody');
        const tfoot = document.getElementById('monthlyFoot');
        if (!select || !tbody) return;

        const selectedMonth = select.value;
        if (!selectedMonth) return;

        const [year, month] = selectedMonth.split('-');
        const entries = DataModule.getEntriesByMonth(parseInt(year), parseInt(month));
        const trucks = DataModule.getTrucks();

        // Aggregate data by truck
        const truckData = {};

        trucks.forEach(truck => {
            truckData[truck.id] = {
                matricule: truck.matricule,
                totalKm: 0,
                totalGasoil: 0,
                totalGasoilCost: 0,
                totalCost: 0,
                totalRevenue: 0,
                result: 0
            };
        });

        entries.forEach(entry => {
            const truck = DataModule.getTruckById(entry.camionId);
            if (!truck || !truckData[truck.id]) return;

            const costs = DataModule.calculateEntryCosts(entry, truck);

            truckData[truck.id].totalKm += entry.kilometrage || 0;
            truckData[truck.id].totalGasoil += entry.quantiteGasoil || 0;
            truckData[truck.id].totalGasoilCost += costs.montantGasoil;
            truckData[truck.id].totalCost += costs.coutTotal;
            truckData[truck.id].totalRevenue += entry.prixLivraison || 0;
            truckData[truck.id].result += costs.resultat;
        });

        // Filter out trucks with no activity
        const activeTrucks = Object.values(truckData).filter(t => t.totalKm > 0 || t.totalRevenue > 0);

        // Calculate totals
        let grandTotalKm = 0, grandTotalGasoil = 0, grandTotalGasoilCost = 0;
        let grandTotalCost = 0, grandTotalRevenue = 0, grandTotalResult = 0;

        tbody.innerHTML = activeTrucks.map(t => {
            grandTotalKm += t.totalKm;
            grandTotalGasoil += t.totalGasoil;
            grandTotalGasoilCost += t.totalGasoilCost;
            grandTotalCost += t.totalCost;
            grandTotalRevenue += t.totalRevenue;
            grandTotalResult += t.result;

            const resultClass = t.result >= 0 ? 'result-positive' : 'result-negative';

            return `<tr>
                <td>${t.matricule}</td>
                <td>${t.totalKm.toLocaleString('fr-FR')}</td>
                <td>${t.totalGasoil.toLocaleString('fr-FR')} L</td>
                <td>${t.totalGasoilCost.toLocaleString('fr-FR')} TND</td>
                <td>${t.totalCost.toLocaleString('fr-FR')} TND</td>
                <td>${t.totalRevenue.toLocaleString('fr-FR')} TND</td>
                <td class="${resultClass}">${t.result.toLocaleString('fr-FR')} TND</td>
            </tr>`;
        }).join('');

        if (activeTrucks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:40px;">Aucune donnée pour ce mois</td></tr>';
        }

        const resultClass = grandTotalResult >= 0 ? 'result-positive' : 'result-negative';
        tfoot.innerHTML = `<tr>
            <td><strong>TOTAL MENSUEL</strong></td>
            <td><strong>${grandTotalKm.toLocaleString('fr-FR')}</strong></td>
            <td><strong>${grandTotalGasoil.toLocaleString('fr-FR')} L</strong></td>
            <td><strong>${grandTotalGasoilCost.toLocaleString('fr-FR')} TND</strong></td>
            <td><strong>${grandTotalCost.toLocaleString('fr-FR')} TND</strong></td>
            <td><strong>${grandTotalRevenue.toLocaleString('fr-FR')} TND</strong></td>
            <td class="${resultClass}"><strong>${grandTotalResult.toLocaleString('fr-FR')} TND</strong></td>
        </tr>`;
    }

    return {
        init,
        refresh,
        populateMonthSelector
    };
})();
