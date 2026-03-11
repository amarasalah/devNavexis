/**
 * REPORTS MODULE - ENHANCED VERSION V3
 * ALL trucks, detailed charges, drivers cost, efficiency, stacked charts, PDF export
 */

import { DataModule } from './data-firebase.js';
import { db, collection, getDocs, query, orderBy, where, COLLECTIONS } from './firebase.js';

let monthlyCharts = {};

function init() {
    document.getElementById('reportMonth')?.addEventListener('change', () => {
        const ds = document.getElementById('reportDateStart');
        const de = document.getElementById('reportDateEnd');
        if (ds) ds.value = '';
        if (de) de.value = '';
        refresh();
    });
    document.getElementById('reportFilterBtn')?.addEventListener('click', () => {
        const ds = document.getElementById('reportDateStart')?.value;
        const de = document.getElementById('reportDateEnd')?.value;
        if (ds || de) {
            const monthSel = document.getElementById('reportMonth');
            if (monthSel) monthSel.value = '';
        }
        refresh();
    });
    document.getElementById('reportExportPDFBtn')?.addEventListener('click', exportPDF);
    populateMonthSelector();
}

function getDateRange() {
    const dateStart = document.getElementById('reportDateStart')?.value;
    const dateEnd = document.getElementById('reportDateEnd')?.value;
    const selectedMonth = document.getElementById('reportMonth')?.value;

    if (dateStart || dateEnd) {
        const start = dateStart || '2000-01-01';
        const end = dateEnd || '2099-12-31';
        const startLabel = dateStart ? new Date(dateStart + 'T00:00').toLocaleDateString('fr-FR') : '...';
        const endLabel = dateEnd ? new Date(dateEnd + 'T00:00').toLocaleDateString('fr-FR') : '...';
        return { startDate: start, endDate: end, label: `${startLabel} → ${endLabel}` };
    }

    if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        return { startDate, endDate, label };
    }
    return null;
}

async function populateMonthSelector() {
    const select = document.getElementById('reportMonth');
    if (!select) return;

    const entries = await DataModule.getEntries();
    const months = new Set();
    entries.forEach(entry => {
        if (!entry.date) return;
        const parts = entry.date.split('-');
        if (parts.length === 3) months.add(`${parts[0]}-${parts[1]}`);
    });

    const sortedMonths = Array.from(months).sort().reverse();
    select.innerHTML = '<option value="">-- Mois --</option>' + sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        return `<option value="${m}">${monthName}</option>`;
    }).join('');

    if (sortedMonths.length > 0) select.value = sortedMonths[0];
}

async function refresh() {
    await renderTransportKPIs();
    await renderMonthlyReport();
    await renderCharts();
    await renderDriverCosts();
    await renderERPSummary();
}

// ==================== AGGREGATE DATA ====================
async function getAggregatedData() {
    const range = getDateRange();
    if (!range) return null;

    const entries = (await DataModule.getEntries()).filter(e =>
        e.date && e.date >= range.startDate && e.date <= range.endDate
    );
    const trucks = await DataModule.getTrucks();
    const drivers = await DataModule.getDrivers();

    const truckData = {};
    trucks.forEach(truck => {
        truckData[truck.id] = {
            matricule: truck.matricule,
            totalKm: 0, totalGasoil: 0, totalGasoilCost: 0,
            totalLeasing: 0, totalAssurance: 0, totalTaxe: 0,
            totalPersonnel: 0, totalMaintenance: 0, totalChargesFixes: 0,
            totalCost: 0, totalRevenue: 0, totalRevenueTTC: 0, result: 0,
            chauffeurs: new Set(), destinations: {}, nbVoyages: 0
        };
    });

    // Driver aggregation
    const driverData = {};
    drivers.forEach(d => {
        driverData[d.id] = {
            nom: d.nom, totalKm: 0, totalGasoil: 0, totalGasoilCost: 0,
            totalCost: 0, totalRevenueTTC: 0, result: 0, nbVoyages: 0,
            totalMaintenance: 0, totalPersonnel: 0
        };
    });

    // Pre-fetch Bons de Sortie for dynamic maintenance cost
    let allSorties = [];
    try { const SM = window.SuppliersModule; const AM = window.ArticlesModule; if (AM) await AM.getArticles(); if (SM) { await SM.getLivraisons(); await SM.getCommandes(); allSorties = await SM.getSorties(); } } catch (e) { }


    const truckDaySeen = new Set();

    entries.forEach(entry => {
        const truck = DataModule.getTruckById(entry.camionId);
        if (!truck || !truckData[truck.id]) return;
        const td = truckData[truck.id];

        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);

        const bsM = DataModule.getMaintenanceCostFromBSSync(allSorties, entry.camionId, entry.date);
        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip, bsM > 0 ? bsM : null);
        const tauxTVA = entry.tauxTVA || 0;
        const prixLivraisonTTC = (entry.prixLivraison || 0) + ((entry.prixLivraison || 0) * tauxTVA / 100);

        td.totalKm += entry.kilometrage || 0;
        td.totalGasoil += entry.quantiteGasoil || 0;
        td.totalGasoilCost += costs.montantGasoil;
        td.totalCost += costs.coutTotal;
        td.totalRevenue += entry.prixLivraison || 0;
        td.totalRevenueTTC += prixLivraisonTTC;
        td.result += costs.resultat;

        if (isFirstTrip) {
            td.totalLeasing += entry.fraisLeasing != null ? entry.fraisLeasing : (truck.fraisLeasing || 0);
            td.totalAssurance += entry.montantAssurance != null ? entry.montantAssurance : (truck.montantAssurance || 0);
            td.totalTaxe += entry.montantTaxe != null ? entry.montantTaxe : (truck.montantTaxe || 0);
            td.totalPersonnel += entry.chargePersonnel != null ? entry.chargePersonnel : (truck.chargePersonnel || 0);
            td.totalChargesFixes += entry.chargesFixes != null ? entry.chargesFixes : (truck.chargesFixes || 0);
        }
        td.totalMaintenance += bsM > 0 ? bsM : (entry.maintenance || 0);

        if (entry.chauffeurId) {
            const driver = drivers.find(d => d.id === entry.chauffeurId);
            if (driver) td.chauffeurs.add(driver.nom);
        }

        if (entry.source !== 'idle_day') {
            const dest = entry.delegation || entry.gouvernorat || entry.destination || 'N/A';
            td.destinations[dest] = (td.destinations[dest] || 0) + 1;
            td.nbVoyages++;
        }

        // Driver aggregation
        if (entry.chauffeurId && driverData[entry.chauffeurId]) {
            const dd = driverData[entry.chauffeurId];
            dd.totalKm += entry.kilometrage || 0;
            dd.totalGasoil += entry.quantiteGasoil || 0;
            dd.totalGasoilCost += costs.montantGasoil;
            dd.totalCost += costs.coutTotal;
            dd.totalRevenueTTC += prixLivraisonTTC;
            dd.result += costs.resultat;
            dd.totalMaintenance += bsM > 0 ? bsM : (entry.maintenance || 0);
            if (isFirstTrip) {
                dd.totalPersonnel += entry.chargePersonnel != null ? entry.chargePersonnel : (truck.chargePersonnel || 0);
            }
            if (entry.source !== 'idle_day') dd.nbVoyages++;
        }
    });

    return { truckData, driverData, range, entries, trucks, drivers };
}

// ==================== KPI CARDS + EFFICIENCY ====================
async function renderTransportKPIs() {
    const kpiContainer = document.getElementById('transportKPIContainer');
    if (!kpiContainer) return;

    const data = await getAggregatedData();
    if (!data) { kpiContainer.innerHTML = ''; return; }

    const { truckData, range } = data;
    const all = Object.values(truckData);

    const totRevTTC = all.reduce((s, t) => s + t.totalRevenueTTC, 0);
    const totCost = all.reduce((s, t) => s + t.totalCost, 0);
    const totResult = all.reduce((s, t) => s + t.result, 0);
    const totKm = all.reduce((s, t) => s + t.totalKm, 0);
    const totVoyages = all.reduce((s, t) => s + t.nbVoyages, 0);
    const activeTrucks = all.filter(t => t.nbVoyages > 0).length;
    const totGasoil = all.reduce((s, t) => s + t.totalGasoilCost, 0);
    const totLeasing = all.reduce((s, t) => s + t.totalLeasing, 0);
    const totAssurance = all.reduce((s, t) => s + t.totalAssurance, 0);
    const totTaxe = all.reduce((s, t) => s + t.totalTaxe, 0);
    const totPersonnel = all.reduce((s, t) => s + t.totalPersonnel, 0);
    const totMaintenance = all.reduce((s, t) => s + t.totalMaintenance, 0);
    const totChargesFixes = all.reduce((s, t) => s + t.totalChargesFixes, 0);
    const totGasoilL = all.reduce((s, t) => s + t.totalGasoil, 0);

    // Efficiency
    const consommation = totKm > 0 ? (totGasoilL / totKm * 100).toFixed(1) : '0';
    const coutKm = totKm > 0 ? (totCost / totKm).toFixed(2) : '0';
    const revKm = totKm > 0 ? (totRevTTC / totKm).toFixed(2) : '0';
    const profitKm = totKm > 0 ? (totResult / totKm).toFixed(2) : '0';

    const f = n => n.toLocaleString('fr-FR');

    kpiContainer.innerHTML = `
        <div style="margin-bottom:20px">
            <h4 style="margin:0 0 16px;color:#8b5cf6">🚛 KPIs Transport — ${range.label}</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px">
                <div style="background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1));border-radius:12px;padding:14px;text-align:center">
                    <div style="font-size:0.73rem;color:#94a3b8">💵 Revenu TTC</div>
                    <div style="font-size:1.3rem;font-weight:bold;color:#10b981">${f(totRevTTC)} TND</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.1));border-radius:12px;padding:14px;text-align:center">
                    <div style="font-size:0.73rem;color:#94a3b8">📊 Total Charges</div>
                    <div style="font-size:1.3rem;font-weight:bold;color:#ef4444">${f(totCost)} TND</div>
                </div>
                <div style="background:linear-gradient(135deg,${totResult >= 0 ? 'rgba(16,185,129,0.2),rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.2),rgba(239,68,68,0.1)'});border-radius:12px;padding:14px;text-align:center">
                    <div style="font-size:0.73rem;color:#94a3b8">📈 Résultat Net</div>
                    <div style="font-size:1.3rem;font-weight:bold;color:${totResult >= 0 ? '#10b981' : '#ef4444'}">${f(totResult)} TND</div>
                </div>
                <div style="background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(139,92,246,0.1));border-radius:12px;padding:14px;text-align:center">
                    <div style="font-size:0.73rem;color:#94a3b8">🚛 Camions / Voyages</div>
                    <div style="font-size:1.3rem;font-weight:bold;color:#8b5cf6">${activeTrucks} / ${totVoyages}</div>
                    <div style="font-size:0.68rem;color:#64748b">${f(totKm)} km</div>
                </div>
            </div>

            <h5 style="margin:0 0 10px;color:#06b6d4;font-size:0.85rem">⛽ Efficacité</h5>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:16px">
                <div style="background:rgba(6,182,212,0.1);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(6,182,212,0.2)">
                    <div style="font-size:0.65rem;color:#94a3b8">🛢️ Consommation</div>
                    <div style="font-size:1.1rem;font-weight:700;color:#06b6d4">${consommation} L/100km</div>
                </div>
                <div style="background:rgba(239,68,68,0.08);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(239,68,68,0.15)">
                    <div style="font-size:0.65rem;color:#94a3b8">💸 Coût/Km</div>
                    <div style="font-size:1.1rem;font-weight:700;color:#ef4444">${coutKm} TND</div>
                </div>
                <div style="background:rgba(16,185,129,0.08);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(16,185,129,0.15)">
                    <div style="font-size:0.65rem;color:#94a3b8">💰 Revenue/Km</div>
                    <div style="font-size:1.1rem;font-weight:700;color:#10b981">${revKm} TND</div>
                </div>
                <div style="background:rgba(139,92,246,0.08);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(139,92,246,0.15)">
                    <div style="font-size:0.65rem;color:#94a3b8">🏆 Profit/Km</div>
                    <div style="font-size:1.1rem;font-weight:700;color:${parseFloat(profitKm) >= 0 ? '#8b5cf6' : '#ef4444'}">${profitKm} TND</div>
                </div>
            </div>

            <h5 style="margin:0 0 10px;color:#f59e0b;font-size:0.85rem">💰 Détail des Charges</h5>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">
                <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(148,163,184,0.1)">
                    <div style="font-size:0.65rem;color:#94a3b8">⛽ Gasoil</div>
                    <div style="font-size:1rem;font-weight:600;color:#f59e0b">${f(totGasoil)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(148,163,184,0.1)">
                    <div style="font-size:0.65rem;color:#94a3b8">🏦 Leasing</div>
                    <div style="font-size:1rem;font-weight:600;color:#3b82f6">${f(totLeasing)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(148,163,184,0.1)">
                    <div style="font-size:0.65rem;color:#94a3b8">🛡️ Assurance</div>
                    <div style="font-size:1rem;font-weight:600;color:#06b6d4">${f(totAssurance)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(148,163,184,0.1)">
                    <div style="font-size:0.65rem;color:#94a3b8">📋 Taxes</div>
                    <div style="font-size:1rem;font-weight:600;color:#a855f7">${f(totTaxe)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(148,163,184,0.1)">
                    <div style="font-size:0.65rem;color:#94a3b8">👷 Personnel</div>
                    <div style="font-size:1rem;font-weight:600;color:#ec4899">${f(totPersonnel)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(148,163,184,0.1)">
                    <div style="font-size:0.65rem;color:#94a3b8">🔧 Maintenance</div>
                    <div style="font-size:1rem;font-weight:600;color:#f97316">${f(totMaintenance)}</div>
                </div>
            </div>
        </div>
    `;
}

// ==================== DETAILED TABLE ====================
async function renderMonthlyReport() {
    const tbody = document.getElementById('monthlyBody');
    const tfoot = document.getElementById('monthlyFoot');
    if (!tbody) return;

    const data = await getAggregatedData();
    if (!data) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#64748b;padding:40px;">Sélectionnez un mois ou une plage de dates</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    const { truckData, range } = data;
    const allTrucks = Object.values(truckData);
    const f = n => n.toLocaleString('fr-FR');

    let gKm = 0, gGasoilCost = 0, gLeasing = 0, gAssurance = 0, gTaxe = 0, gPersonnel = 0, gMaintenance = 0;
    let gCost = 0, gRevenue = 0, gResult = 0;

    tbody.innerHTML = allTrucks.map(t => {
        gKm += t.totalKm; gGasoilCost += t.totalGasoilCost;
        gLeasing += t.totalLeasing; gAssurance += t.totalAssurance; gTaxe += t.totalTaxe;
        gPersonnel += t.totalPersonnel; gMaintenance += t.totalMaintenance;
        gCost += t.totalCost; gRevenue += t.totalRevenueTTC; gResult += t.result;

        const resultClass = t.result >= 0 ? 'result-positive' : 'result-negative';
        const driversStr = Array.from(t.chauffeurs).join(', ') || '<span style="color:#64748b">-</span>';
        const destsArr = Object.entries(t.destinations).sort((a, b) => b[1] - a[1]);
        const destsStr = destsArr.length > 0
            ? destsArr.slice(0, 3).map(([d, c]) => `${d} <small style="color:#94a3b8">(${c})</small>`).join(', ') + (destsArr.length > 3 ? ` <small style="color:#64748b">+${destsArr.length - 3}</small>` : '')
            : '<span style="color:#64748b">-</span>';

        return `<tr>
            <td><strong>${t.matricule}</strong></td>
            <td>${driversStr}</td>
            <td>${f(t.totalKm)}</td>
            <td>${f(t.totalGasoilCost)}</td>
            <td>${f(t.totalLeasing)}</td>
            <td>${f(t.totalAssurance)}</td>
            <td>${f(t.totalTaxe)}</td>
            <td>${f(t.totalPersonnel)}</td>
            <td>${f(t.totalMaintenance)}</td>
            <td><strong>${f(t.totalCost)}</strong></td>
            <td>${f(t.totalRevenueTTC)}</td>
            <td class="${resultClass}"><strong>${f(t.result)}</strong></td>
            <td style="font-size:0.75rem">${destsStr}</td>
        </tr>`;
    }).join('');

    if (allTrucks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#64748b;padding:40px;">Aucune donnée</td></tr>';
    }

    const rClass = gResult >= 0 ? 'result-positive' : 'result-negative';
    if (tfoot) {
        tfoot.innerHTML = `<tr>
            <td><strong>TOTAL (${range.label})</strong></td><td></td>
            <td><strong>${f(gKm)}</strong></td><td><strong>${f(gGasoilCost)}</strong></td>
            <td><strong>${f(gLeasing)}</strong></td><td><strong>${f(gAssurance)}</strong></td>
            <td><strong>${f(gTaxe)}</strong></td><td><strong>${f(gPersonnel)}</strong></td>
            <td><strong>${f(gMaintenance)}</strong></td><td><strong>${f(gCost)}</strong></td>
            <td><strong>${f(gRevenue)}</strong></td><td class="${rClass}"><strong>${f(gResult)}</strong></td><td></td>
        </tr>`;
    }
}

// ==================== CHARTS (MULTI-CHART WITH VALUE LABELS) ====================
async function renderCharts() {
    const chartsContainer = document.getElementById('chartsContainer');
    if (!chartsContainer) return;

    const data = await getAggregatedData();
    if (!data) { chartsContainer.innerHTML = ''; return; }

    const { truckData, driverData } = data;
    const all = Object.values(truckData);
    if (all.length === 0) {
        chartsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">📊 Aucune donnée</div>';
        return;
    }

    const f = n => n.toLocaleString('fr-FR');
    const fk = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0);
    const maxValue = Math.max(...all.map(t => Math.max(t.totalRevenueTTC, t.totalCost)), 1);
    const barW = Math.max(18, Math.min(40, 550 / all.length));
    const barH = 170;
    const sorted = [...all].sort((a, b) => b.result - a.result);
    const cc = { gas: '#f59e0b', lea: '#3b82f6', ass: '#06b6d4', tax: '#a855f7', per: '#ec4899', mai: '#f97316' };
    const activeDrivers = Object.values(driverData).filter(d => d.nbVoyages > 0).sort((a, b) => b.result - a.result);

    // Donut data
    const totGas = all.reduce((s, t) => s + t.totalGasoilCost, 0), totLea = all.reduce((s, t) => s + t.totalLeasing, 0);
    const totAss = all.reduce((s, t) => s + t.totalAssurance, 0), totTax = all.reduce((s, t) => s + t.totalTaxe, 0);
    const totPer = all.reduce((s, t) => s + t.totalPersonnel, 0), totMai = all.reduce((s, t) => s + t.totalMaintenance, 0);
    const totCost = totGas + totLea + totAss + totTax + totPer + totMai;
    const pct = v => totCost > 0 ? (v / totCost * 100).toFixed(1) : '0';
    const segs = [{ l: 'Gasoil', v: totGas, c: cc.gas }, { l: 'Leasing', v: totLea, c: cc.lea }, { l: 'Assurance', v: totAss, c: cc.ass }, { l: 'Taxes', v: totTax, c: cc.tax }, { l: 'Personnel', v: totPer, c: cc.per }, { l: 'Maintenance', v: totMai, c: cc.mai }].filter(s => s.v > 0);
    let ca = 0; const conic = segs.map(s => { const st = ca; ca += (s.v / totCost) * 360; return `${s.c} ${st}deg ${ca}deg` }).join(',');

    // Efficiency
    const actT = all.filter(t => t.totalKm > 0);
    const maxEff = Math.max(...actT.map(t => Math.max(t.totalRevenueTTC / t.totalKm, t.totalCost / t.totalKm)), 1);

    chartsContainer.innerHTML = `
    <!-- ROW 1: Stacked Cost + Donut -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px">
            <h4 style="margin:0 0 12px;color:#8b5cf6">📊 Revenus vs Coûts Détaillés</h4>
            <div style="overflow-x:auto">
                <div style="display:flex;align-items:flex-end;gap:4px;height:${barH + 40}px;border-bottom:1px solid #333;min-width:${all.length * (barW * 2 + 14)}px;padding-bottom:18px">
                    ${all.map(t => {
        const sc = barH / maxValue; const revH = Math.max(2, t.totalRevenueTTC * sc);
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                        <div style="display:flex;gap:2px;align-items:flex-end">
                            <div style="display:flex;flex-direction:column;align-items:center">
                                <span style="font-size:0.5rem;color:#34d399;font-weight:bold">${fk(t.totalRevenueTTC)}</span>
                                <div style="width:${barW}px;height:${revH}px;background:linear-gradient(to top,#10b981,#34d399);border-radius:3px 3px 0 0"></div>
                            </div>
                            <div style="display:flex;flex-direction:column;align-items:center">
                                <span style="font-size:0.5rem;color:#f87171;font-weight:bold">${fk(t.totalCost)}</span>
                                <div style="display:flex;flex-direction:column;width:${barW}px">
                                    <div style="height:${t.totalMaintenance * sc}px;background:${cc.mai}"></div>
                                    <div style="height:${t.totalPersonnel * sc}px;background:${cc.per}"></div>
                                    <div style="height:${t.totalTaxe * sc}px;background:${cc.tax}"></div>
                                    <div style="height:${t.totalAssurance * sc}px;background:${cc.ass}"></div>
                                    <div style="height:${t.totalLeasing * sc}px;background:${cc.lea}"></div>
                                    <div style="height:${t.totalGasoilCost * sc}px;background:${cc.gas}"></div>
                                </div>
                            </div>
                        </div>
                        <span style="font-size:0.58rem;color:#e2e8f0;font-weight:bold;white-space:nowrap;transform:rotate(-45deg);margin-top:4px">${t.matricule.slice(-6)}</span>
                    </div>`}).join('')}
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:8px;font-size:0.7rem">
                <span><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px"></span> Revenus</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:${cc.gas};border-radius:2px"></span> Gasoil</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:${cc.lea};border-radius:2px"></span> Leasing</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:${cc.ass};border-radius:2px"></span> Assurance</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:${cc.tax};border-radius:2px"></span> Taxes</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:${cc.per};border-radius:2px"></span> Personnel</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:${cc.mai};border-radius:2px"></span> Maintenance</span>
            </div>
        </div>
        <!-- Donut: Cost Distribution -->
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center">
            <h4 style="margin:0 0 16px;color:#f59e0b;text-align:center">🍩 Répartition des Charges</h4>
            <div style="position:relative;width:180px;height:180px">
                <div style="width:180px;height:180px;border-radius:50%;background:conic-gradient(${conic})"></div>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100px;height:100px;border-radius:50%;background:#1e293b;display:flex;flex-direction:column;align-items:center;justify-content:center">
                    <span style="font-size:0.65rem;color:#94a3b8">Total</span>
                    <span style="font-size:1rem;font-weight:bold;color:#fff">${fk(totCost)}</span>
                    <span style="font-size:0.6rem;color:#94a3b8">TND</span>
                </div>
            </div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px;width:100%">
                ${segs.map(s => `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem">
                    <span style="width:10px;height:10px;border-radius:2px;background:${s.c};flex-shrink:0"></span>
                    <span style="flex:1;color:#cbd5e1">${s.l}</span>
                    <span style="font-weight:bold;color:#fff">${pct(s.v)}%</span>
                    <span style="color:#94a3b8;font-size:0.65rem">${f(s.v)}</span>
                </div>`).join('')}
            </div>
        </div>
    </div>

    <!-- ROW 2: Profitability + Efficiency -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px">
            <h4 style="margin:0 0 12px;color:#10b981">🏆 Rentabilité</h4>
            <div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto">
                ${sorted.map((t, i) => {
            const maxR = Math.max(...sorted.map(x => Math.abs(x.result)), 1); const bp = Math.abs(t.result) / maxR * 100;
            return `<div style="display:flex;align-items:center;gap:6px">
                    <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;background:${i < 3 ? '#10b981' : t.result >= 0 ? '#334155' : '#7f1d1d'};border-radius:50%;font-size:0.65rem;font-weight:bold;flex-shrink:0">${i + 1}</span>
                    <span style="width:70px;font-size:0.78rem;font-weight:bold;flex-shrink:0">${t.matricule}</span>
                    <div style="flex:1;height:16px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden">
                        <div style="height:100%;width:${bp}%;background:${t.result >= 0 ? 'linear-gradient(to right,#10b981,#34d399)' : 'linear-gradient(to right,#ef4444,#f87171)'};border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:4px">
                            <span style="font-size:0.6rem;font-weight:bold;color:#fff">${f(t.result)}</span>
                        </div>
                    </div>
                </div>`}).join('')}
            </div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px">
            <h4 style="margin:0 0 12px;color:#06b6d4">⛽ Efficacité par Camion (TND/Km)</h4>
            <div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto">
                ${actT.sort((a, b) => (b.totalRevenueTTC / b.totalKm) - (a.totalRevenueTTC / a.totalKm)).map(t => {
                const rkm = t.totalRevenueTTC / t.totalKm, ckm = t.totalCost / t.totalKm;
                return `<div style="display:flex;flex-direction:column;gap:2px">
                    <span style="font-size:0.7rem;font-weight:bold;color:#e2e8f0">${t.matricule}</span>
                    <div style="display:flex;gap:4px;align-items:center">
                        <span style="width:55px;font-size:0.6rem;color:#34d399">Rev/Km</span>
                        <div style="flex:1;height:12px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${(rkm / maxEff) * 100}%;background:linear-gradient(to right,#10b981,#34d399);border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:3px">
                                <span style="font-size:0.5rem;font-weight:bold;color:#fff">${rkm.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;gap:4px;align-items:center">
                        <span style="width:55px;font-size:0.6rem;color:#f87171">Coût/Km</span>
                        <div style="flex:1;height:12px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${(ckm / maxEff) * 100}%;background:linear-gradient(to right,#ef4444,#f87171);border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:3px">
                                <span style="font-size:0.5rem;font-weight:bold;color:#fff">${ckm.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>`}).join('')}
            </div>
        </div>
    </div>

    <!-- ROW 3: Driver Performance -->
    ${activeDrivers.length > 0 ? `<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:20px">
        <h4 style="margin:0 0 12px;color:#ec4899">👷 Performance par Chauffeur</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:12px">
            ${activeDrivers.map(d => {
                    const mx = Math.max(...activeDrivers.map(x => Math.max(x.totalRevenueTTC, x.totalCost)), 1);
                    return `<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;border:1px solid rgba(148,163,184,0.1)">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-weight:bold;font-size:0.85rem">${d.nom}</span>
                    <span style="font-size:0.7rem;color:#94a3b8">${d.nbVoyages} voy. · ${f(d.totalKm)} km</span>
                </div>
                <div style="display:flex;gap:4px;align-items:center;margin-bottom:3px">
                    <span style="width:50px;font-size:0.6rem;color:#34d399">Revenu</span>
                    <div style="flex:1;height:14px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${(d.totalRevenueTTC / mx) * 100}%;background:linear-gradient(to right,#10b981,#34d399);border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:4px">
                            <span style="font-size:0.55rem;font-weight:bold;color:#fff">${f(d.totalRevenueTTC)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
                    <span style="width:50px;font-size:0.6rem;color:#f87171">Coûts</span>
                    <div style="flex:1;height:14px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${(d.totalCost / mx) * 100}%;background:linear-gradient(to right,#ef4444,#f87171);border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:4px">
                            <span style="font-size:0.55rem;font-weight:bold;color:#fff">${f(d.totalCost)}</span>
                        </div>
                    </div>
                </div>
                <div style="text-align:right;font-weight:bold;color:${d.result >= 0 ? '#10b981' : '#ef4444'};font-size:0.8rem">Résultat: ${f(d.result)} TND</div>
            </div>`}).join('')}
        </div>
    </div>`: ''} `;
}


// ==================== DRIVER COST DISTRIBUTION ====================
async function renderDriverCosts() {
    const container = document.getElementById('driverCostsContainer');
    if (!container) return;

    const data = await getAggregatedData();
    if (!data) { container.innerHTML = ''; return; }

    const { driverData, range } = data;
    const activeDrivers = Object.values(driverData).filter(d => d.nbVoyages > 0);
    activeDrivers.sort((a, b) => b.result - a.result);
    const f = n => n.toLocaleString('fr-FR');

    if (activeDrivers.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">Aucun chauffeur actif pour cette période</div>';
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom:20px">
            <h4 style="margin:0 0 16px;color:#ec4899">👷 Répartition Coûts par Chauffeur — ${range.label}</h4>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Chauffeur</th>
                            <th>Voyages</th>
                            <th>Km</th>
                            <th>⛽ Gasoil</th>
                            <th>👷 Personnel</th>
                            <th>🔧 Maint.</th>
                            <th>Total Coûts</th>
                            <th>Revenu TTC</th>
                            <th>Résultat</th>
                            <th>Consommation</th>
                            <th>Coût/Km</th>
                            <th>Revenue/Km</th>
                            <th>Profit/Km</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activeDrivers.map(d => {
        const conso = d.totalKm > 0 ? (d.totalGasoil / d.totalKm * 100).toFixed(1) : '-';
        const coutKm = d.totalKm > 0 ? (d.totalCost / d.totalKm).toFixed(2) : '-';
        const revKm = d.totalKm > 0 ? (d.totalRevenueTTC / d.totalKm).toFixed(2) : '-';
        const profitKm = d.totalKm > 0 ? (d.result / d.totalKm).toFixed(2) : '-';
        const rc = d.result >= 0 ? 'result-positive' : 'result-negative';
        return `<tr>
                                <td><strong>${d.nom}</strong></td>
                                <td>${d.nbVoyages}</td>
                                <td>${f(d.totalKm)}</td>
                                <td>${f(d.totalGasoilCost)}</td>
                                <td>${f(d.totalPersonnel)}</td>
                                <td>${f(d.totalMaintenance)}</td>
                                <td><strong>${f(d.totalCost)}</strong></td>
                                <td>${f(d.totalRevenueTTC)}</td>
                                <td class="${rc}"><strong>${f(d.result)}</strong></td>
                                <td>${conso} L/100km</td>
                                <td>${coutKm}</td>
                                <td>${revKm}</td>
                                <td style="color:${parseFloat(profitKm) >= 0 ? '#10b981' : '#ef4444'};font-weight:bold">${profitKm}</td>
                            </tr>`;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ==================== ERP SUMMARY ====================
async function renderERPSummary() {
    const erpContainer = document.getElementById('erpSummaryContainer');
    if (!erpContainer) return;

    const range = getDateRange();
    if (!range) { erpContainer.innerHTML = ''; return; }

    try {
        const purchaseOrders = await getOrdersByDateRange(COLLECTIONS.bonCommandesAchat, range.startDate, range.endDate);
        const salesOrders = await getOrdersByDateRange(COLLECTIONS.bonCommandesVente, range.startDate, range.endDate);

        const purchaseTotal = purchaseOrders.reduce((sum, o) => sum + (o.montantTTC || o.montantTotal || 0), 0);
        const salesTotal = salesOrders.reduce((sum, o) => sum + (o.montantTTC || o.montantTotal || 0), 0);
        const margin = salesTotal - purchaseTotal;

        erpContainer.innerHTML = `
            <div style="margin-bottom:20px">
                <h4 style="margin:0 0 16px;color:#f59e0b">📦 Résumé ERP — ${range.label}</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
                    <div style="background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.1));border-radius:12px;padding:16px;text-align:center">
                        <div style="font-size:0.75rem;color:#94a3b8">📥 Achats (${purchaseOrders.length} BC)</div>
                        <div style="font-size:1.5rem;font-weight:bold;color:#3b82f6">${purchaseTotal.toLocaleString('fr-FR')} TND</div>
                    </div>
                    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1));border-radius:12px;padding:16px;text-align:center">
                        <div style="font-size:0.75rem;color:#94a3b8">📤 Ventes (${salesOrders.length} BC)</div>
                        <div style="font-size:1.5rem;font-weight:bold;color:#10b981">${salesTotal.toLocaleString('fr-FR')} TND</div>
                    </div>
                    <div style="background:linear-gradient(135deg,${margin >= 0 ? 'rgba(16,185,129,0.2),rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.2),rgba(239,68,68,0.1)'});border-radius:12px;padding:16px;text-align:center">
                        <div style="font-size:0.75rem;color:#94a3b8">📈 Marge (Ventes - Achats)</div>
                        <div style="font-size:1.5rem;font-weight:bold;color:${margin >= 0 ? '#10b981' : '#ef4444'}">${margin.toLocaleString('fr-FR')} TND</div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error rendering ERP summary:', error);
        erpContainer.innerHTML = '';
    }
}

async function getOrdersByDateRange(collectionName, startDate, endDate) {
    try {
        const snap = await getDocs(collection(db, collectionName));
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(o => o.date && o.date >= startDate && o.date <= endDate);
    } catch (error) {
        console.error('Error getting orders:', error);
        return [];
    }
}

// ==================== PDF EXPORT ====================
async function exportPDF() {
    const data = await getAggregatedData();
    if (!data) { alert('Sélectionnez un mois ou une plage de dates'); return; }

    const { truckData, driverData, range } = data;
    const all = Object.values(truckData);
    const title = `Rapport Transport — ${range.label}`;
    const f = n => n.toLocaleString('fr-FR');

    const totRevTTC = all.reduce((s, t) => s + t.totalRevenueTTC, 0);
    const totCost = all.reduce((s, t) => s + t.totalCost, 0);
    const totResult = all.reduce((s, t) => s + t.result, 0);
    const totKm = all.reduce((s, t) => s + t.totalKm, 0);
    const totVoyages = all.reduce((s, t) => s + t.nbVoyages, 0);
    const totGasoil = all.reduce((s, t) => s + t.totalGasoilCost, 0);
    const totLeasing = all.reduce((s, t) => s + t.totalLeasing, 0);
    const totAssurance = all.reduce((s, t) => s + t.totalAssurance, 0);
    const totTaxe = all.reduce((s, t) => s + t.totalTaxe, 0);
    const totPersonnel = all.reduce((s, t) => s + t.totalPersonnel, 0);
    const totMaintenance = all.reduce((s, t) => s + t.totalMaintenance, 0);
    const totGasoilL = all.reduce((s, t) => s + t.totalGasoil, 0);

    const consommation = totKm > 0 ? (totGasoilL / totKm * 100).toFixed(1) : '0';
    const coutKm = totKm > 0 ? (totCost / totKm).toFixed(2) : '0';
    const revKm = totKm > 0 ? (totRevTTC / totKm).toFixed(2) : '0';
    const profitKm = totKm > 0 ? (totResult / totKm).toFixed(2) : '0';

    const maxVal = Math.max(...all.map(t => Math.max(t.totalRevenueTTC, t.totalCost)), 1);
    const barH = 80;
    const bw = Math.max(5, Math.min(20, 550 / all.length));
    const sorted = [...all].sort((a, b) => b.result - a.result);
    const activeDrivers = Object.values(driverData).filter(d => d.nbVoyages > 0).sort((a, b) => b.result - a.result);

    const cc = { gas: '#f59e0b', lea: '#3b82f6', ass: '#06b6d4', tax: '#a855f7', per: '#ec4899', mai: '#f97316' };

    const pw = window.open('', '_blank');
    pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { size: A4 landscape; margin: 6mm; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } }
body { font-family: 'Segoe UI',Arial,sans-serif; color: #111; font-size: 7px; padding: 4px; }
h2 { font-size: 13px; border-bottom: 2px solid #333; padding-bottom: 3px; margin-bottom: 5px; }
h4 { font-size: 9px; margin: 6px 0 4px; color: #333; }
.row { display: flex; gap: 4px; margin-bottom: 4px; }
.kpi { flex: 1; border: 1px solid #ccc; border-radius: 3px; padding: 3px; text-align: center; background: #f9f9f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.kl { display: block; font-size: 5.5px; color: #666; }
.kv { display: block; font-size: 9px; font-weight: bold; }
.g { color: #059669; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .r { color: #dc2626; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
[style] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.charts { display: flex; gap: 8px; margin-bottom: 6px; }
.cb { flex: 1; border: 1px solid #ddd; border-radius: 3px; padding: 5px; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.bars { display: flex; align-items: flex-end; gap: 1px; height: ${barH + 14}px; border-bottom: 1px solid #999; }
.bg { display: flex; flex-direction: column; align-items: center; }
.bp { display: flex; gap: 1px; align-items: flex-end; }
.stk { display: flex; flex-direction: column; }
.stk div { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.b { border-radius: 2px 2px 0 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.bl { font-size: 4.5px; color: #666; margin-top: 1px; transform: rotate(-45deg); white-space: nowrap; font-weight: bold; }
.lg { font-size: 5px; text-align: center; margin-top: 2px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
.ld { display: inline-block; width: 6px; height: 6px; border-radius: 1px; margin: 0 1px; vertical-align: middle; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ri { display: flex; align-items: center; gap: 3px; margin-bottom: 1px; font-size: 6.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ri span, .ri div { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rn { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-size: 5px; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
table { width: 100%; border-collapse: collapse; font-size: 6.5px; margin-top: 3px; }
th { background: #d1d5db; padding: 2px; border: 1px solid #999; font-size: 6px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
td { padding: 1px 2px; border: 1px solid #ccc; }
tfoot td { background: #e5e7eb; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pb { page-break-before: always; }
.donut-wrap { position: relative; width: 100px; height: 100px; margin: 0 auto; }
.donut { width: 100px; height: 100px; border-radius: 50%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 55px; height: 55px; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.donut-center span { display: block; }
.vl { font-size: 4.5px; font-weight: bold; text-align: center; }
.dl { display: flex; align-items: center; gap: 2px; font-size: 5.5px; margin-bottom: 1px; }
.dl-dot { width: 5px; height: 5px; border-radius: 1px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<h2>${title}</h2>
<div class="row">
  <div class="kpi"><span class="kl">Revenu TTC</span><span class="kv g">${f(totRevTTC)} TND</span></div>
  <div class="kpi"><span class="kl">Total Charges</span><span class="kv r">${f(totCost)} TND</span></div>
  <div class="kpi"><span class="kl">Résultat</span><span class="kv ${totResult >= 0 ? 'g' : 'r'}">${f(totResult)} TND</span></div>
  <div class="kpi"><span class="kl">Voyages/Km</span><span class="kv">${totVoyages}/${f(totKm)}km</span></div>
  <div class="kpi"><span class="kl">Consommation</span><span class="kv">${consommation} L/100km</span></div>
  <div class="kpi"><span class="kl">Coût/Km</span><span class="kv r">${coutKm}</span></div>
  <div class="kpi"><span class="kl">Revenue/Km</span><span class="kv g">${revKm}</span></div>
  <div class="kpi"><span class="kl">Profit/Km</span><span class="kv ${parseFloat(profitKm) >= 0 ? 'g' : 'r'}">${profitKm}</span></div>
</div>
<div class="row">
  <div class="kpi"><span class="kl">Gasoil</span><span class="kv">${f(totGasoil)}</span></div>
  <div class="kpi"><span class="kl">Leasing</span><span class="kv">${f(totLeasing)}</span></div>
  <div class="kpi"><span class="kl">Assurance</span><span class="kv">${f(totAssurance)}</span></div>
  <div class="kpi"><span class="kl">Taxes</span><span class="kv">${f(totTaxe)}</span></div>
  <div class="kpi"><span class="kl">Personnel</span><span class="kv">${f(totPersonnel)}</span></div>
  <div class="kpi"><span class="kl">Maintenance</span><span class="kv">${f(totMaintenance)}</span></div>
</div>

<div style="display:flex;gap:8px;margin-bottom:6px">
  <div class="cb" style="flex:2">
    <h4>Revenus vs Coûts Détaillés</h4>
    <div class="bars">${all.map(t => {
        const sc = barH / maxVal;
        const fk = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0);
        return `<div class="bg"><div class="vl" style="color:#059669">${fk(t.totalRevenueTTC)}</div><div class="bp"><div class="b" style="height:${Math.max(1, t.totalRevenueTTC * sc)}px;width:${bw}px;background:#10b981"></div><div class="stk" style="width:${bw}px"><div style="height:${t.totalMaintenance * sc}px;background:${cc.mai}"></div><div style="height:${t.totalPersonnel * sc}px;background:${cc.per}"></div><div style="height:${t.totalTaxe * sc}px;background:${cc.tax}"></div><div style="height:${t.totalAssurance * sc}px;background:${cc.ass}"></div><div style="height:${t.totalLeasing * sc}px;background:${cc.lea}"></div><div style="height:${t.totalGasoilCost * sc}px;background:${cc.gas}"></div></div></div><div class="vl" style="color:#dc2626">${fk(t.totalCost)}</div><span class="bl">${t.matricule.slice(-5)}</span></div>`;
    }).join('')}</div>
    <div class="lg"><span class="ld" style="background:#10b981"></span>Rev <span class="ld" style="background:${cc.gas}"></span>Gas <span class="ld" style="background:${cc.lea}"></span>Lea <span class="ld" style="background:${cc.ass}"></span>Ass <span class="ld" style="background:${cc.tax}"></span>Tax <span class="ld" style="background:${cc.per}"></span>Per <span class="ld" style="background:${cc.mai}"></span>Mai</div>
  </div>
  <div class="cb" style="flex:1;text-align:center">
    <h4>Répartition Charges</h4>
    ${(() => {
            const totC = totGasoil + totLeasing + totAssurance + totTaxe + totPersonnel + totMaintenance;
            const pctF = v => totC > 0 ? (v / totC * 100).toFixed(1) : '0';
            const sg = [{ l: 'Gasoil', v: totGasoil, c: cc.gas }, { l: 'Leasing', v: totLeasing, c: cc.lea }, { l: 'Assurance', v: totAssurance, c: cc.ass }, { l: 'Taxes', v: totTaxe, c: cc.tax }, { l: 'Personnel', v: totPersonnel, c: cc.per }, { l: 'Maint.', v: totMaintenance, c: cc.mai }].filter(s => s.v > 0);
            let a = 0; const con = sg.map(s => { const st = a; a += (s.v / totC) * 360; return `${s.c} ${st}deg ${a}deg` }).join(',');
            return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${con})"></div><div class="donut-center"><span style="font-size:5px;color:#666">Total</span><span style="font-size:8px;font-weight:bold">${(totC / 1000).toFixed(1)}k</span></div></div>
        <div style="margin-top:4px">${sg.map(s => `<div class="dl"><span class="dl-dot" style="background:${s.c}"></span><span style="flex:1;text-align:left">${s.l}</span><span style="font-weight:bold">${pctF(s.v)}%</span></div>`).join('')}</div>`;
        })()}
  </div>
</div>

<div class="charts">
  <div class="cb">
    <h4>🏆 Rentabilité</h4>
    ${(() => { const maxR = Math.max(...sorted.map(x => Math.abs(x.result)), 1); return sorted.map((t, i) => { const bp = Math.min(100, Math.abs(t.result) / maxR * 100); const bg = t.result >= 0 ? '#059669' : '#dc2626'; return `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;font-size:6.5px"><span style="width:12px;height:12px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:${i < 3 ? '#059669' : '#94a3b8'};color:#fff;font-size:5px;font-weight:bold;flex-shrink:0">${i + 1}</span><span style="width:55px;font-weight:bold;flex-shrink:0">${t.matricule}</span><div style="flex:1;height:10px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="height:100%;width:${bp}%;background:${bg};border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:2px"><span style="font-size:4.5px;color:#fff;font-weight:bold">${f(t.result)}</span></div></div></div>`; }).join('') })()}
  </div>
  <div class="cb">
    <h4>⛽ Efficacité (TND/Km)</h4>
    ${(() => { const eff = all.filter(t => t.totalKm > 0).sort((a, b) => (b.totalRevenueTTC / b.totalKm) - (a.totalRevenueTTC / a.totalKm)); const mxE = Math.max(...eff.map(t => Math.max(t.totalRevenueTTC / t.totalKm, t.totalCost / t.totalKm)), 1); return eff.map(t => { const rkm = t.totalRevenueTTC / t.totalKm; const ckm = t.totalCost / t.totalKm; return `<div style="margin-bottom:3px"><div style="font-size:6px;font-weight:bold;margin-bottom:1px">${t.matricule}</div><div style="display:flex;gap:2px;align-items:center;margin-bottom:1px"><span style="width:30px;font-size:5px;color:#059669">Rev/Km</span><div style="flex:1;height:8px;background:#e5e7eb;border-radius:2px;overflow:hidden"><div style="height:100%;width:${(rkm / mxE) * 100}%;background:#059669;border-radius:2px;display:flex;align-items:center;justify-content:flex-end;padding-right:2px"><span style="font-size:4px;color:#fff;font-weight:bold">${rkm.toFixed(2)}</span></div></div></div><div style="display:flex;gap:2px;align-items:center"><span style="width:30px;font-size:5px;color:#dc2626">Coût/Km</span><div style="flex:1;height:8px;background:#e5e7eb;border-radius:2px;overflow:hidden"><div style="height:100%;width:${(ckm / mxE) * 100}%;background:#dc2626;border-radius:2px;display:flex;align-items:center;justify-content:flex-end;padding-right:2px"><span style="font-size:4px;color:#fff;font-weight:bold">${ckm.toFixed(2)}</span></div></div></div></div>`; }).join('') })()}
  </div>
</div>

${activeDrivers.length > 0 ? `
<h4 style="margin-top:6px">👷 Performance par Chauffeur</h4>
<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
${(() => { const mxD = Math.max(...activeDrivers.map(d => Math.max(d.totalRevenueTTC, d.totalCost)), 1); return activeDrivers.map(d => { const rw = (d.totalRevenueTTC / mxD) * 100; const cw = (d.totalCost / mxD) * 100; return `<div style="width:calc(25% - 3px);border:1px solid #ddd;border-radius:3px;padding:3px;background:#fafafa;font-size:6px"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><b>${d.nom}</b><span style="color:#666">${d.nbVoyages}v · ${f(d.totalKm)}km</span></div><div style="display:flex;gap:2px;align-items:center;margin-bottom:1px"><span style="width:25px;color:#059669;font-size:5px">Rev</span><div style="flex:1;height:8px;background:#e5e7eb;border-radius:2px;overflow:hidden"><div style="height:100%;width:${rw}%;background:#059669;border-radius:2px;display:flex;align-items:center;justify-content:flex-end;padding-right:1px"><span style="font-size:4px;color:#fff;font-weight:bold">${f(d.totalRevenueTTC)}</span></div></div></div><div style="display:flex;gap:2px;align-items:center;margin-bottom:1px"><span style="width:25px;color:#dc2626;font-size:5px">Coût</span><div style="flex:1;height:8px;background:#e5e7eb;border-radius:2px;overflow:hidden"><div style="height:100%;width:${cw}%;background:#dc2626;border-radius:2px;display:flex;align-items:center;justify-content:flex-end;padding-right:1px"><span style="font-size:4px;color:#fff;font-weight:bold">${f(d.totalCost)}</span></div></div></div><div style="text-align:right;font-weight:bold;color:${d.result >= 0 ? '#059669' : '#dc2626'};font-size:5.5px">Résultat: ${f(d.result)}</div></div>`; }).join('') })()}
</div>` : ''}

<h4>Détail par Camion</h4>
<table>
<thead><tr><th>Camion</th><th>Chauffeur(s)</th><th>Km</th><th>Gasoil</th><th>Leasing</th><th>Assur.</th><th>Taxes</th><th>Pers.</th><th>Maint.</th><th>Tot.Coûts</th><th>Rev.TTC</th><th>Résultat</th><th>Dest.</th></tr></thead>
<tbody>${all.map(t => {
            const dr = Array.from(t.chauffeurs).join(', ') || '-';
            const ds = Object.entries(t.destinations).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => `${d}(${c})`).join(', ') || '-';
            return `<tr><td><b>${t.matricule}</b></td><td>${dr}</td><td>${f(t.totalKm)}</td><td>${f(t.totalGasoilCost)}</td><td>${f(t.totalLeasing)}</td><td>${f(t.totalAssurance)}</td><td>${f(t.totalTaxe)}</td><td>${f(t.totalPersonnel)}</td><td>${f(t.totalMaintenance)}</td><td><b>${f(t.totalCost)}</b></td><td>${f(t.totalRevenueTTC)}</td><td class="${t.result >= 0 ? 'g' : 'r'}"><b>${f(t.result)}</b></td><td style="font-size:5px">${ds}</td></tr>`;
        }).join('')}</tbody>
<tfoot><tr><td><b>TOTAL</b></td><td></td><td><b>${f(totKm)}</b></td><td><b>${f(totGasoil)}</b></td><td><b>${f(totLeasing)}</b></td><td><b>${f(totAssurance)}</b></td><td><b>${f(totTaxe)}</b></td><td><b>${f(totPersonnel)}</b></td><td><b>${f(totMaintenance)}</b></td><td><b>${f(totCost)}</b></td><td><b>${f(totRevTTC)}</b></td><td class="${totResult >= 0 ? 'g' : 'r'}"><b>${f(totResult)}</b></td><td></td></tr></tfoot>
</table>

${activeDrivers.length > 0 ? `
<h4 style="margin-top:8px">Répartition par Chauffeur</h4>
<table>
<thead><tr><th>Chauffeur</th><th>Voy.</th><th>Km</th><th>Gasoil</th><th>Pers.</th><th>Maint.</th><th>Tot.Coûts</th><th>Rev.TTC</th><th>Résultat</th><th>Conso</th><th>Coût/Km</th><th>Rev/Km</th><th>Profit/Km</th></tr></thead>
<tbody>${activeDrivers.map(d => {
            const conso = d.totalKm > 0 ? (d.totalGasoil / d.totalKm * 100).toFixed(1) : '-';
            const ckm = d.totalKm > 0 ? (d.totalCost / d.totalKm).toFixed(2) : '-';
            const rkm = d.totalKm > 0 ? (d.totalRevenueTTC / d.totalKm).toFixed(2) : '-';
            const pkm = d.totalKm > 0 ? (d.result / d.totalKm).toFixed(2) : '-';
            return `<tr><td><b>${d.nom}</b></td><td>${d.nbVoyages}</td><td>${f(d.totalKm)}</td><td>${f(d.totalGasoilCost)}</td><td>${f(d.totalPersonnel)}</td><td>${f(d.totalMaintenance)}</td><td><b>${f(d.totalCost)}</b></td><td>${f(d.totalRevenueTTC)}</td><td class="${d.result >= 0 ? 'g' : 'r'}"><b>${f(d.result)}</b></td><td>${conso}</td><td>${ckm}</td><td>${rkm}</td><td style="font-weight:bold;color:${parseFloat(pkm) >= 0 ? '#059669' : '#dc2626'}">${pkm}</td></tr>`;
        }).join('')}</tbody>
</table>
` : ''}

</body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 400);
}



export const ReportsModule = {
    init,
    refresh,
    populateMonthSelector,
    renderCharts,
    renderERPSummary,
    renderTransportKPIs,
    renderDriverCosts,
    exportPDF
};

window.ReportsModule = ReportsModule;
