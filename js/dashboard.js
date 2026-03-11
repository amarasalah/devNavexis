/**
 * DASHBOARD MODULE
 * Handles KPI cards and Chart.js visualizations
 */

const DashboardModule = (() => {
    let trendChart = null;
    let costsChart = null;
    let performanceChart = null;

    // Chart.js default config
    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#94a3b8',
                    font: { family: 'Inter' }
                }
            }
        },
        scales: {
            x: {
                ticks: { color: '#64748b' },
                grid: { color: 'rgba(148, 163, 184, 0.1)' }
            },
            y: {
                ticks: { color: '#64748b' },
                grid: { color: 'rgba(148, 163, 184, 0.1)' }
            }
        }
    };

    function init() {
        createCharts();
    }

    function refresh(selectedDate) {
        updateKPIs(selectedDate);
        updateDailySummaryTable(selectedDate);
        updateCharts(selectedDate);
    }

    function updateKPIs(selectedDate) {
        const entries = DataModule.getEntriesByDate(selectedDate);

        let totalKm = 0, totalFuel = 0, totalFuelCost = 0;
        let totalCost = 0, totalRevenue = 0, tripCount = 0;

        entries.forEach(entry => {
            const truck = DataModule.getTruckById(entry.camionId);
            const costs = DataModule.calculateEntryCosts(entry, truck);

            totalKm += entry.kilometrage || 0;
            totalFuel += entry.quantiteGasoil || 0;
            totalFuelCost += costs.montantGasoil;
            totalCost += costs.coutTotal;
            totalRevenue += entry.prixLivraison || 0;
            if (entry.kilometrage > 0) tripCount++;
        });

        const result = totalRevenue - totalCost;
        const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;

        // Update KPI cards
        document.getElementById('kpi-result').textContent = `${result.toLocaleString('fr-FR')} TND`;
        document.getElementById('kpi-result').parentElement.querySelector('.kpi-trend').className =
            `kpi-trend ${result >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('kpi-result-trend').textContent = result >= 0 ? '↑ Profit' : '↓ Perte';

        document.getElementById('kpi-fuel').textContent = `${totalFuel.toLocaleString('fr-FR')} L`;
        document.getElementById('kpi-fuel-cost').textContent = `${totalFuelCost.toLocaleString('fr-FR')} TND`;

        document.getElementById('kpi-km').textContent = `${totalKm.toLocaleString('fr-FR')} km`;
        document.getElementById('kpi-trips').textContent = `${tripCount} trajets`;

        document.getElementById('kpi-cost-km').textContent = `${costPerKm.toFixed(2)} TND/km`;
        document.getElementById('kpi-efficiency').textContent = costPerKm < 2 ? '✓ Efficace' : '⚠ Élevé';
    }

    function updateDailySummaryTable(selectedDate) {
        const entries = DataModule.getEntriesByDate(selectedDate);
        const tbody = document.getElementById('dailySummaryBody');
        const tfoot = document.getElementById('dailySummaryFoot');

        let totalKm = 0, totalFuel = 0, totalCost = 0, totalRevenue = 0, totalResult = 0;

        tbody.innerHTML = entries.map(entry => {
            const truck = DataModule.getTruckById(entry.camionId);
            const driver = DataModule.getDriverById(entry.chauffeurId);
            const costs = DataModule.calculateEntryCosts(entry, truck);

            totalKm += entry.kilometrage || 0;
            totalFuel += entry.quantiteGasoil || 0;
            totalCost += costs.coutTotal;
            totalRevenue += entry.prixLivraison || 0;
            totalResult += costs.resultat;

            const resultClass = costs.resultat >= 0 ? 'result-positive' : 'result-negative';

            return `<tr>
                <td>${truck?.matricule || '-'}</td>
                <td>${driver?.nom || '-'}</td>
                <td>${entry.destination || '-'}</td>
                <td>${entry.kilometrage || 0}</td>
                <td>${entry.quantiteGasoil || 0}</td>
                <td>${costs.coutTotal.toLocaleString('fr-FR')}</td>
                <td>${entry.prixLivraison.toLocaleString('fr-FR')}</td>
                <td class="${resultClass}">${costs.resultat.toLocaleString('fr-FR')}</td>
            </tr>`;
        }).join('');

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:40px;">Aucune saisie pour cette date</td></tr>';
        }

        const resultClass = totalResult >= 0 ? 'result-positive' : 'result-negative';
        tfoot.innerHTML = `<tr>
            <td colspan="3"><strong>TOTAL JOUR</strong></td>
            <td><strong>${totalKm.toLocaleString('fr-FR')}</strong></td>
            <td><strong>${totalFuel.toLocaleString('fr-FR')}</strong></td>
            <td><strong>${totalCost.toLocaleString('fr-FR')}</strong></td>
            <td><strong>${totalRevenue.toLocaleString('fr-FR')}</strong></td>
            <td class="${resultClass}"><strong>${totalResult.toLocaleString('fr-FR')}</strong></td>
        </tr>`;
    }

    function createCharts() {
        // Trend Chart (Line)
        const trendCtx = document.getElementById('trendChart')?.getContext('2d');
        if (trendCtx) {
            trendChart = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Résultat (TND)',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    ...chartDefaults,
                    plugins: {
                        ...chartDefaults.plugins,
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#f1f5f9',
                            bodyColor: '#94a3b8',
                            borderColor: 'rgba(139, 92, 246, 0.3)',
                            borderWidth: 1
                        }
                    }
                }
            });
        }

        // Costs Pie Chart
        const costsCtx = document.getElementById('costsChart')?.getContext('2d');
        if (costsCtx) {
            costsChart = new Chart(costsCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Gasoil', 'Charges Fixes', 'Assurance', 'Taxes', 'Maintenance', 'Personnel'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0, 0],
                        backgroundColor: [
                            '#ef4444',
                            '#8b5cf6',
                            '#3b82f6',
                            '#06b6d4',
                            '#f59e0b',
                            '#10b981'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94a3b8',
                                padding: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }

        // Performance Bar Chart
        const perfCtx = document.getElementById('performanceChart')?.getContext('2d');
        if (perfCtx) {
            performanceChart = new Chart(perfCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Résultat (TND)',
                        data: [],
                        backgroundColor: [],
                        borderRadius: 6,
                        barThickness: 24
                    }]
                },
                options: {
                    ...chartDefaults,
                    indexAxis: 'y',
                    plugins: {
                        ...chartDefaults.plugins,
                        legend: { display: false }
                    }
                }
            });
        }
    }

    function updateCharts(selectedDate) {
        updateTrendChart(selectedDate);
        updateCostsChart(selectedDate);
        updatePerformanceChart(selectedDate);
    }

    function updateTrendChart(selectedDate) {
        if (!trendChart) return;

        // Get last 30 days of data
        const dates = [];
        const results = [];
        const baseDate = new Date(selectedDate);

        for (let i = 29; i >= 0; i--) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dates.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));

            const entries = DataModule.getEntriesByDate(dateStr);
            let dayResult = 0;
            entries.forEach(entry => {
                const costs = DataModule.calculateEntryCosts(entry);
                dayResult += costs.resultat;
            });
            results.push(dayResult);
        }

        trendChart.data.labels = dates;
        trendChart.data.datasets[0].data = results;
        trendChart.update();
    }

    function updateCostsChart(selectedDate) {
        if (!costsChart) return;

        const entries = DataModule.getEntriesByDate(selectedDate);
        let totalGasoil = 0, totalCharges = 0, totalAssurance = 0;
        let totalTaxe = 0, totalMaintenance = 0, totalPersonnel = 0;

        entries.forEach(entry => {
            const truck = DataModule.getTruckById(entry.camionId);
            if (!truck) return;

            totalGasoil += entry.quantiteGasoil * entry.prixGasoilLitre;
            totalCharges += truck.chargesFixes;
            totalAssurance += truck.montantAssurance;
            totalTaxe += truck.montantTaxe;
            totalMaintenance += entry.maintenance || 0;
            totalPersonnel += truck.chargePersonnel;
        });

        costsChart.data.datasets[0].data = [
            totalGasoil, totalCharges, totalAssurance,
            totalTaxe, totalMaintenance, totalPersonnel
        ];
        costsChart.update();
    }

    function updatePerformanceChart(selectedDate) {
        if (!performanceChart) return;

        const entries = DataModule.getEntriesByDate(selectedDate);
        const truckResults = {};

        entries.forEach(entry => {
            const truck = DataModule.getTruckById(entry.camionId);
            if (!truck) return;

            const costs = DataModule.calculateEntryCosts(entry, truck);
            if (!truckResults[truck.matricule]) {
                truckResults[truck.matricule] = 0;
            }
            truckResults[truck.matricule] += costs.resultat;
        });

        const sortedTrucks = Object.entries(truckResults)
            .sort((a, b) => b[1] - a[1]);

        performanceChart.data.labels = sortedTrucks.map(t => t[0]);
        performanceChart.data.datasets[0].data = sortedTrucks.map(t => t[1]);
        performanceChart.data.datasets[0].backgroundColor = sortedTrucks.map(t =>
            t[1] >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
        );
        performanceChart.update();
    }

    return {
        init,
        refresh
    };
})();
