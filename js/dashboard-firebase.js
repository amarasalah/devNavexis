/**
 * DASHBOARD MODULE
 * Handles KPI updates and Chart.js visualizations
 * Updated for async Firebase operations
 */

import { DataModule } from './data-firebase.js';

let trendChart = null;
let costsChart = null;
let performanceChart = null;

function init() {
    initCharts();
}

async function refresh(selectedDate) {
    await updateKPIs(selectedDate);
    await updateTrendChart(selectedDate);
    await updateCostsChart(selectedDate);
    await updatePerformanceChart(selectedDate);
    await updateDailySummary(selectedDate);
}

async function updateKPIs(selectedDate) {
    let entries = DataModule.getEntriesByDate(selectedDate);
    // Chauffeur data scope
    const cu = window.currentUser;
    if (cu?.driverId) entries = entries.filter(e => e.chauffeurId === cu.driverId);
    const trucks = await DataModule.getTrucks();

    let totalKm = 0;
    let totalGasoil = 0;
    let totalCost = 0;
    let totalRevenue = 0;

    // Track first trip per truck per day (fixed charges only once)
    const truckDaySeen = new Set();

    // Pre-fetch Bons de Sortie for dynamic maintenance
    let allSorties = [];
    try { const SM = window.SuppliersModule; const AM = window.ArticlesModule; if (AM) await AM.getArticles(); if (SM) { await SM.getLivraisons(); await SM.getCommandes(); allSorties = await SM.getSorties(); } } catch (e) { }

    entries.forEach(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);
        const bsM = DataModule.getMaintenanceCostFromBSSync(allSorties, entry.camionId, entry.date);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip, bsM > 0 ? bsM : null);

        totalKm += entry.kilometrage || 0;
        totalGasoil += entry.quantiteGasoil || 0;
        totalCost += costs.coutTotal;
        totalRevenue += entry.prixLivraison || 0;
    });

    const result = totalRevenue - totalCost;
    const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;

    // Update KPI cards
    const kpiResult = document.getElementById('kpi-result');
    const kpiGasoil = document.getElementById('kpi-gasoil');
    const kpiKm = document.getElementById('kpi-km');
    const kpiCostKm = document.getElementById('kpi-costkm');

    if (kpiResult) {
        kpiResult.textContent = `${result.toLocaleString('fr-FR')} TND`;
        kpiResult.classList.toggle('result-positive', result >= 0);
        kpiResult.classList.toggle('result-negative', result < 0);
    }
    if (kpiGasoil) kpiGasoil.textContent = `${totalGasoil.toLocaleString('fr-FR')} L`;
    if (kpiKm) kpiKm.textContent = `${totalKm.toLocaleString('fr-FR')} km`;
    if (kpiCostKm) kpiCostKm.textContent = `${costPerKm.toFixed(2)} TND`;

    // Update trend indicator
    const indicator = document.getElementById('result-indicator');
    if (indicator) {
        indicator.textContent = result >= 0 ? '📈' : '📉';
    }
}

function initCharts() {
    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    const costsCtx = document.getElementById('costsChart')?.getContext('2d');
    const performanceCtx = document.getElementById('performanceChart')?.getContext('2d');

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
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    if (costsCtx) {
        costsChart = new Chart(costsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Gasoil', 'Charges Fixes', 'Assurance', 'Taxe', 'Personnel', 'Maintenance'],
                datasets: [{
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                        '#ef4444',
                        '#f97316',
                        '#eab308',
                        '#22c55e',
                        '#3b82f6',
                        '#8b5cf6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', padding: 15 }
                    }
                },
                cutout: '60%'
            }
        });
    }

    if (performanceCtx) {
        performanceChart = new Chart(performanceCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Résultat par Camion',
                    data: [],
                    backgroundColor: '#8b5cf6',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function updateTrendChart(selectedDate) {
    if (!trendChart) return;

    const allEntries = await DataModule.getEntries();
    // Chauffeur data scope
    const cu = window.currentUser;
    const entries = cu?.driverId ? allEntries.filter(e => e.chauffeurId === cu.driverId) : allEntries;
    // Parse selectedDate as local (avoid UTC shift)
    const [sy, sm, sd] = selectedDate.split('-').map(Number);
    const baseDate = new Date(sy, sm - 1, sd);
    const dates = [];
    const results = [];

    // Pre-fetch Bons de Sortie for dynamic maintenance
    let allSorties = [];
    try { const SM = window.SuppliersModule; const AM = window.ArticlesModule; if (AM) await AM.getArticles(); if (SM) { await SM.getLivraisons(); await SM.getCommandes(); allSorties = await SM.getSorties(); } } catch (e) { }

    // Last 30 days
    for (let i = 29; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dateStr = toLocalDateStr(d);
        dates.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);

        const dayEntries = entries.filter(e => e.date === dateStr);
        let dayResult = 0;
        const dayTruckSeen = new Set();
        dayEntries.forEach(entry => {
            const truck = DataModule.getTruckById(entry.camionId);
            const isFirstTrip = !dayTruckSeen.has(entry.camionId);
            dayTruckSeen.add(entry.camionId);
            const bsM = DataModule.getMaintenanceCostFromBSSync(allSorties, entry.camionId, entry.date);
            const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip, bsM > 0 ? bsM : null);
            dayResult += costs.resultat;
        });
        results.push(dayResult);
    }

    trendChart.data.labels = dates;
    trendChart.data.datasets[0].data = results;
    trendChart.update();
}

async function updateCostsChart(selectedDate) {
    if (!costsChart) return;

    let entries = DataModule.getEntriesByDate(selectedDate);
    // Chauffeur data scope
    const cu2 = window.currentUser;
    if (cu2?.driverId) entries = entries.filter(e => e.chauffeurId === cu2.driverId);

    let gasoil = 0, chargesFixes = 0, assurance = 0, taxe = 0, personnel = 0, maintenance = 0;

    // Pre-fetch Bons de Sortie for dynamic maintenance
    let allSorties = [];
    try { const SM = window.SuppliersModule; const AM = window.ArticlesModule; if (AM) await AM.getArticles(); if (SM) { await SM.getLivraisons(); await SM.getCommandes(); allSorties = await SM.getSorties(); } } catch (e) { }

    entries.forEach(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        gasoil += entry.montantGasoil || ((entry.quantiteGasoil || 0) * (entry.prixGasoilLitre || 2));
        chargesFixes += entry.chargesFixes != null ? entry.chargesFixes : (truck?.chargesFixes || 0);
        assurance += entry.montantAssurance != null ? entry.montantAssurance : (truck?.montantAssurance || 0);
        taxe += entry.montantTaxe != null ? entry.montantTaxe : (truck?.montantTaxe || 0);
        personnel += entry.chargePersonnel != null ? entry.chargePersonnel : (truck?.chargePersonnel || 0);
        const bsM = DataModule.getMaintenanceCostFromBSSync(allSorties, entry.camionId, entry.date);
        maintenance += bsM > 0 ? bsM : (entry.maintenance || 0);
    });

    costsChart.data.datasets[0].data = [gasoil, chargesFixes, assurance, taxe, personnel, maintenance];
    costsChart.update();
}

async function updatePerformanceChart(selectedDate) {
    if (!performanceChart) return;

    let entries = DataModule.getEntriesByDate(selectedDate);
    // Chauffeur data scope
    const cu3 = window.currentUser;
    if (cu3?.driverId) entries = entries.filter(e => e.chauffeurId === cu3.driverId);
    const trucks = await DataModule.getTrucks();

    const truckResults = {};
    trucks.forEach(t => { truckResults[t.id] = { matricule: t.matricule, result: 0 }; });

    // Track first trip per truck per day (fixed charges only once)
    const truckDaySeen = new Set();

    // Pre-fetch Bons de Sortie for dynamic maintenance
    let allSorties2 = [];
    try { const SM = window.SuppliersModule; const AM = window.ArticlesModule; if (AM) await AM.getArticles(); if (SM) { await SM.getLivraisons(); await SM.getCommandes(); allSorties2 = await SM.getSorties(); } } catch (e) { }

    entries.forEach(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        if (!truck) return;

        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);
        const bsM = DataModule.getMaintenanceCostFromBSSync(allSorties2, entry.camionId, entry.date);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip, bsM > 0 ? bsM : null);
        if (truckResults[truck.id]) {
            truckResults[truck.id].result += costs.resultat;
        }
    });

    const activeResults = Object.values(truckResults).filter(t => t.result !== 0);
    activeResults.sort((a, b) => b.result - a.result);

    performanceChart.data.labels = activeResults.map(t => t.matricule.split(' ')[0]);
    performanceChart.data.datasets[0].data = activeResults.map(t => t.result);
    performanceChart.data.datasets[0].backgroundColor = activeResults.map(t => t.result >= 0 ? '#10b981' : '#ef4444');
    performanceChart.update();
}

async function updateDailySummary(selectedDate) {
    let entries = DataModule.getEntriesByDate(selectedDate);
    // Chauffeur data scope
    const cu4 = window.currentUser;
    if (cu4?.driverId) entries = entries.filter(e => e.chauffeurId === cu4.driverId);
    const tbody = document.getElementById('dailySummaryBody');
    if (!tbody) return;

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;">Aucune donnée pour cette date</td></tr>';
        return;
    }

    // Track first trip per truck per day (fixed charges only once)
    const truckDaySeen = new Set();

    // Pre-fetch Bons de Sortie for dynamic maintenance
    let allSorties3 = [];
    try { const SM = window.SuppliersModule; const AM = window.ArticlesModule; if (AM) await AM.getArticles(); if (SM) { await SM.getLivraisons(); await SM.getCommandes(); allSorties3 = await SM.getSorties(); } } catch (e) { }

    tbody.innerHTML = entries.map(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        const driver = DataModule.getDriverById(entry.chauffeurId);
        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);
        const bsM = DataModule.getMaintenanceCostFromBSSync(allSorties3, entry.camionId, entry.date);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip, bsM > 0 ? bsM : null);
        const resultClass = costs.resultat >= 0 ? 'result-positive' : 'result-negative';
        const isIdle = entry.source === 'idle_day';

        let destination = entry.destination || '-';
        if (entry.gouvernorat && entry.delegation) {
            destination = `${entry.delegation}`;
        }
        if (isIdle) destination = '🚫 Sans voyage';

        const rowStyle = isIdle
            ? 'style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(251, 191, 36, 0.08)); border-left: 4px solid #f59e0b;"'
            : '';

        return `<tr ${rowStyle}>
            <td>${truck?.matricule || '-'}</td>
            <td>${driver?.nom || (isIdle ? '<span style="color:#f59e0b;font-size:0.8rem">-</span>' : '-')}</td>
            <td ${isIdle ? 'style="color:#f59e0b;font-weight:600"' : ''}>${destination}</td>
            <td>${entry.kilometrage || 0}</td>
            <td>${entry.quantiteGasoil || 0}L</td>
            <td>${(entry.prixLivraison || 0).toLocaleString('fr-FR')}</td>
            <td class="${resultClass}">${costs.resultat.toLocaleString('fr-FR')}</td>
        </tr>`;
    }).join('');
}

export const DashboardModule = {
    init,
    refresh
};

window.DashboardModule = DashboardModule;
