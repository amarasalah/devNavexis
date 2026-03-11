/**
 * PROFILE MODULE - ENHANCED VERSION
 * Detailed profile view for trucks and drivers with charts and filters
 */

import { DataModule } from './data-firebase.js';

let profileCharts = {};
let currentEntity = null;
let currentType = null;
let currentFilters = {
    startDate: null,
    endDate: null,
    destination: 'all'
};

function init() {
    console.log('📊 ProfileModule initialized');
}

// ==================== TRUCK PROFILE ====================
async function openTruckProfile(truckId) {
    const truck = DataModule.getTruckById(truckId);
    if (!truck) return;

    currentEntity = truck;
    currentType = 'truck';

    const allEntries = await DataModule.getEntries();
    // Match entries by truck ID or old-format ID containing matricule
    const matNorm = truck.matricule?.replace(/\s+/g, '_') || '';
    const entries = allEntries.filter(e =>
        e.camionId === truckId || (matNorm && e.camionId === `truck_${matNorm}`)
    );

    // Set default date range from actual data
    const today = new Date();
    const entryDates = entries.map(e => e.date).filter(Boolean).sort();
    const earliest = entryDates[0] ? new Date(entryDates[0].replace(/-/g, '/')) : new Date(today);
    earliest.setDate(1); // Start of month

    currentFilters = {
        startDate: toLocalDateStr(earliest),
        endDate: toLocalDateStr(today),
        destination: 'all'
    };

    showProfileModal('truck', truck, entries);
}

// ==================== DRIVER PROFILE ====================
async function openDriverProfile(driverId) {
    const driver = DataModule.getDriverById(driverId);
    if (!driver) return;

    currentEntity = driver;
    currentType = 'driver';

    const truck = driver.camionId ? DataModule.getTruckById(driver.camionId) : null;
    driver.truck = truck;

    const allEntries = await DataModule.getEntries();
    // Match entries by driver ID or old-format ID containing name
    const nomNorm = driver.nom?.replace(/\s+/g, '_') || '';
    const entries = allEntries.filter(e =>
        e.chauffeurId === driverId || (nomNorm && e.chauffeurId === `driver_${nomNorm}`)
    );

    // Set default date range from actual data
    const today = new Date();
    const entryDates = entries.map(e => e.date).filter(Boolean).sort();
    const earliest = entryDates[0] ? new Date(entryDates[0].replace(/-/g, '/')) : new Date(today);
    earliest.setDate(1);

    currentFilters = {
        startDate: toLocalDateStr(earliest),
        endDate: toLocalDateStr(today),
        destination: 'all'
    };

    showProfileModal('driver', driver, entries);
}

// ==================== FILTER ENTRIES ====================
function filterEntries(entries) {
    return entries.filter(entry => {
        // Date filter
        if (currentFilters.startDate && entry.date < currentFilters.startDate) return false;
        if (currentFilters.endDate && entry.date > currentFilters.endDate) return false;

        // Destination filter
        if (currentFilters.destination !== 'all') {
            const dest = entry.destination || entry.gouvernorat || '';
            if (!dest.includes(currentFilters.destination)) return false;
        }

        return true;
    });
}

// ==================== CALCULATE STATS ====================
function calculateDetailedStats(entries, truck) {
    if (entries.length === 0) {
        return {
            totalKm: 0, totalGasoil: 0, totalCout: 0, totalRevenue: 0,
            resultat: 0, coutParKm: 0, consommation: 0, nbTrajets: 0, performance: 0,
            avgKmPerTrip: 0, avgCostPerTrip: 0, avgProfitPerTrip: 0, avgGasoilPerTrip: 0,
            monthlyData: [], weeklyData: [], dailyData: [],
            routesData: [], bestMonth: '-', worstMonth: '-', topDestinations: [],
            firstTrip: '-', lastTrip: '-', activeDays: 0, totalMaintenance: 0
        };
    }

    let totalKm = 0, totalGasoil = 0, totalCout = 0, totalRevenue = 0, totalMaintenance = 0;
    let totalGasoilCost = 0, totalChargesFixes = 0, totalAssurance = 0, totalTaxe = 0, totalPersonnel = 0;
    const monthlyMap = {}, weeklyMap = {}, dailyMap = {}, routesMap = {};
    const dates = new Set();

    // Track first trip per truck per day (fixed charges only once)
    const truckDaySeen = new Set();

    entries.forEach(entry => {
        const key = `${entry.camionId}_${entry.date}`;
        const isFirstTrip = !truckDaySeen.has(key);
        truckDaySeen.add(key);

        totalKm += entry.kilometrage || 0;
        totalGasoil += entry.quantiteGasoil || 0;
        totalRevenue += entry.prixLivraison || 0;
        totalMaintenance += entry.maintenance || 0;

        // Accumulate cost breakdown (fixed charges only on first trip of day)
        const entryGasoilCost = entry.montantGasoil || ((entry.quantiteGasoil || 0) * (entry.prixGasoilLitre || 2));
        totalGasoilCost += entryGasoilCost;
        if (isFirstTrip) {
            totalChargesFixes += entry.chargesFixes != null ? entry.chargesFixes : (truck?.chargesFixes || 0);
            totalAssurance += entry.montantAssurance != null ? entry.montantAssurance : (truck?.montantAssurance || 0);
            totalTaxe += entry.montantTaxe != null ? entry.montantTaxe : (truck?.montantTaxe || 0);
            totalPersonnel += entry.chargePersonnel != null ? entry.chargePersonnel : (truck?.chargePersonnel || 0);
        }

        const costs = DataModule.calculateEntryCosts(entry, truck, isFirstTrip);
        totalCout += costs.coutTotal;

        if (entry.date) dates.add(entry.date);

        // Monthly aggregation
        const monthKey = entry.date?.substring(0, 7) || 'Unknown';
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { km: 0, gasoil: 0, cout: 0, revenue: 0, count: 0 };
        monthlyMap[monthKey].km += entry.kilometrage || 0;
        monthlyMap[monthKey].gasoil += entry.quantiteGasoil || 0;
        monthlyMap[monthKey].cout += costs.coutTotal;
        monthlyMap[monthKey].revenue += entry.prixLivraison || 0;
        monthlyMap[monthKey].count++;

        // Weekly aggregation
        const weekNum = getWeekNumber(entry.date);
        const weekKey = `${entry.date?.substring(0, 4)}-W${String(weekNum).padStart(2, '0')}`;
        if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { km: 0, gasoil: 0, cout: 0, revenue: 0, count: 0 };
        weeklyMap[weekKey].km += entry.kilometrage || 0;
        weeklyMap[weekKey].revenue += entry.prixLivraison || 0;
        weeklyMap[weekKey].count++;

        // Routes aggregation  
        const dest = entry.destination || entry.gouvernorat || 'Inconnu';
        if (!routesMap[dest]) routesMap[dest] = { count: 0, km: 0, revenue: 0, gasoil: 0 };
        routesMap[dest].count++;
        routesMap[dest].km += entry.kilometrage || 0;
        routesMap[dest].revenue += entry.prixLivraison || 0;
        routesMap[dest].gasoil += entry.quantiteGasoil || 0;
    });

    const resultat = totalRevenue - totalCout;
    const coutParKm = totalKm > 0 ? totalCout / totalKm : 0;
    const consommation = totalKm > 0 ? (totalGasoil / totalKm) * 100 : 0;
    const performance = totalRevenue > 0 ? (resultat / totalRevenue) * 100 : 0;

    // Monthly data sorted
    const monthlyData = Object.entries(monthlyMap)
        .map(([month, data]) => ({ month, ...data, profit: data.revenue - data.cout }))
        .sort((a, b) => a.month.localeCompare(b.month));

    // Weekly data
    const weeklyData = Object.entries(weeklyMap)
        .map(([week, data]) => ({ week, ...data, profit: data.revenue - data.cout }))
        .sort((a, b) => a.week.localeCompare(b.week))
        .slice(-12);

    // Best/worst months
    let bestMonth = '-', worstMonth = '-', bestProfit = -Infinity, worstProfit = Infinity;
    monthlyData.forEach(m => {
        if (m.profit > bestProfit) { bestProfit = m.profit; bestMonth = m.month; }
        if (m.profit < worstProfit) { worstProfit = m.profit; worstMonth = m.month; }
    });

    // Top destinations with revenues
    const topDestinations = Object.entries(routesMap)
        .map(([dest, data]) => ({ destination: dest, ...data, avgRevenue: data.count > 0 ? data.revenue / data.count : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    // Date range
    const sortedDates = [...dates].sort();
    const firstTrip = sortedDates[0] || '-';
    const lastTrip = sortedDates[sortedDates.length - 1] || '-';

    return {
        totalKm, totalGasoil, totalCout, totalRevenue, resultat, coutParKm, consommation,
        totalGasoilCost, totalChargesFixes, totalAssurance, totalTaxe, totalPersonnel,
        nbTrajets: entries.length, performance, totalMaintenance,
        avgKmPerTrip: entries.length > 0 ? totalKm / entries.length : 0,
        avgCostPerTrip: entries.length > 0 ? totalCout / entries.length : 0,
        avgProfitPerTrip: entries.length > 0 ? resultat / entries.length : 0,
        avgGasoilPerTrip: entries.length > 0 ? totalGasoil / entries.length : 0,
        monthlyData, weeklyData, topDestinations, bestMonth, worstMonth,
        firstTrip, lastTrip, activeDays: dates.size
    };
}

function getWeekNumber(dateStr) {
    // Parse as local date to avoid timezone issues
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==================== SHOW PROFILE MODAL ====================
function showProfileModal(type, entity, allEntries) {
    const isDriver = type === 'driver';
    const title = isDriver ? entity.nom : entity.matricule;
    const subtitle = isDriver ? (entity.truck?.matricule || 'Non assigné') : entity.type;
    const icon = isDriver ? '👤' : '🚛';

    const filteredEntries = filterEntries(allEntries);
    const truck = isDriver ? entity.truck : entity;
    const stats = calculateDetailedStats(filteredEntries, truck);

    const performanceClass = stats.performance >= 20 ? 'perf-excellent' :
        stats.performance >= 10 ? 'perf-good' :
            stats.performance >= 0 ? 'perf-average' : 'perf-bad';
    const resultatClass = stats.resultat >= 0 ? 'result-positive' : 'result-negative';

    // Get unique destinations for filter
    const destinations = [...new Set(allEntries.map(e => e.gouvernorat || e.destination).filter(Boolean))];

    document.getElementById('modalTitle').textContent = `${icon} Profil: ${title}`;
    document.getElementById('modalBody').innerHTML = `
        <div class="profile-container">
            <!-- Header -->
            <div class="profile-header">
                <div class="profile-avatar">${icon}</div>
                <div class="profile-info">
                    <h2>${title}</h2>
                    <span class="profile-badge">${subtitle}</span>
                    <div class="profile-date-range">
                        📅 ${formatDate(stats.firstTrip)} → ${formatDate(stats.lastTrip)}
                    </div>
                </div>
                <div class="profile-main-stat">
                    <div class="main-stat-value ${resultatClass}">${stats.resultat.toLocaleString('fr-FR')} TND</div>
                    <div class="main-stat-label">Résultat Total</div>
                </div>
            </div>
            
            <!-- Filters -->
            <div class="profile-filters">
                <div class="filter-item">
                    <label>📅 Du:</label>
                    <input type="date" id="filterStartDate" value="${currentFilters.startDate}" onchange="ProfileModule.applyFilters()">
                </div>
                <div class="filter-item">
                    <label>Au:</label>
                    <input type="date" id="filterEndDate" value="${currentFilters.endDate}" onchange="ProfileModule.applyFilters()">
                </div>
                <div class="filter-item">
                    <label>📍 Destination:</label>
                    <select id="filterDestination" onchange="ProfileModule.applyFilters()">
                        <option value="all">Toutes</option>
                        ${destinations.map(d => `<option value="${d}" ${currentFilters.destination === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-sm btn-outline" onclick="ProfileModule.resetFilters()">🔄 Réinitialiser</button>
            </div>
            
            <!-- Quick Stats Cards -->
            <div class="profile-quick-stats">
                <div class="quick-stat">
                    <div class="quick-stat-icon">🛣️</div>
                    <div class="quick-stat-value">${stats.totalKm.toLocaleString('fr-FR')}</div>
                    <div class="quick-stat-label">Km Total</div>
                </div>
                <div class="quick-stat">
                    <div class="quick-stat-icon">📍</div>
                    <div class="quick-stat-value">${stats.nbTrajets}</div>
                    <div class="quick-stat-label">Trajets</div>
                </div>
                <div class="quick-stat">
                    <div class="quick-stat-icon">⛽</div>
                    <div class="quick-stat-value">${stats.totalGasoil.toLocaleString('fr-FR')}</div>
                    <div class="quick-stat-label">Litres</div>
                </div>
                <div class="quick-stat">
                    <div class="quick-stat-icon">📊</div>
                    <div class="quick-stat-value ${performanceClass}">${stats.performance.toFixed(1)}%</div>
                    <div class="quick-stat-label">Performance</div>
                </div>
                <div class="quick-stat">
                    <div class="quick-stat-icon">📈</div>
                    <div class="quick-stat-value result-positive">${stats.totalRevenue.toLocaleString('fr-FR')}</div>
                    <div class="quick-stat-label">Revenus TND</div>
                </div>
                <div class="quick-stat">
                    <div class="quick-stat-icon">📉</div>
                    <div class="quick-stat-value result-negative">${stats.totalCout.toLocaleString('fr-FR')}</div>
                    <div class="quick-stat-label">Coûts TND</div>
                </div>
            </div>
            
            <!-- Performance Bar -->
            <div class="profile-perf-bar">
                <div class="perf-track">
                    <div class="perf-fill ${performanceClass}" style="width: ${Math.max(0, Math.min(100, stats.performance + 50))}%"></div>
                </div>
            </div>
            
            <!-- Charts Section -->
            <div class="profile-charts-section">
                <div class="profile-chart-card wide">
                    <h4>📈 Évolution des Profits</h4>
                    <div class="chart-tabs">
                        <button class="chart-tab active" onclick="ProfileModule.switchChart('monthly')">Mensuel</button>
                        <button class="chart-tab" onclick="ProfileModule.switchChart('weekly')">Hebdo</button>
                    </div>
                    <div class="chart-container" style="height: 250px;"><canvas id="profileTrendChart"></canvas></div>
                </div>
                <div class="profile-chart-card">
                    <h4>💰 Répartition Coûts</h4>
                    <div class="chart-container"><canvas id="profileCostsChart"></canvas></div>
                </div>
                <div class="profile-chart-card">
                    <h4>🗺️ Km par Destination</h4>
                    <div class="chart-container"><canvas id="profileRoutesChart"></canvas></div>
                </div>
            </div>
            
            <!-- Stats Grid -->
            <div class="profile-stats-grid">
                <div class="stat-card">
                    <h4>💵 Bilan Financier</h4>
                    <div class="stat-row"><span>Revenus:</span><span class="result-positive">${stats.totalRevenue.toLocaleString('fr-FR')} TND</span></div>
                    <div class="stat-row"><span>Coûts:</span><span class="result-negative">${stats.totalCout.toLocaleString('fr-FR')} TND</span></div>
                    <div class="stat-row"><span>Maintenance:</span><span>${stats.totalMaintenance.toLocaleString('fr-FR')} TND</span></div>
                    <div class="stat-row highlight"><span>Résultat Net:</span><span class="${resultatClass}">${stats.resultat.toLocaleString('fr-FR')} TND</span></div>
                </div>
                <div class="stat-card">
                    <h4>📊 Moyennes / Trajet</h4>
                    <div class="stat-row"><span>Distance:</span><span>${stats.avgKmPerTrip.toFixed(0)} km</span></div>
                    <div class="stat-row"><span>Gasoil:</span><span>${stats.avgGasoilPerTrip.toFixed(1)} L</span></div>
                    <div class="stat-row"><span>Coût:</span><span>${stats.avgCostPerTrip.toFixed(0)} TND</span></div>
                    <div class="stat-row"><span>Profit:</span><span class="${stats.avgProfitPerTrip >= 0 ? 'result-positive' : 'result-negative'}">${stats.avgProfitPerTrip.toFixed(0)} TND</span></div>
                </div>
                <div class="stat-card">
                    <h4>⛽ Efficacité</h4>
                    <div class="stat-row"><span>Consommation:</span><span>${stats.consommation.toFixed(1)} L/100km</span></div>
                    <div class="stat-row"><span>Coût/Km:</span><span>${stats.coutParKm.toFixed(2)} TND</span></div>
                    <div class="stat-row"><span>Revenue/Km:</span><span>${(stats.totalKm > 0 ? stats.totalRevenue / stats.totalKm : 0).toFixed(2)} TND</span></div>
                    <div class="stat-row"><span>Profit/Km:</span><span class="${resultatClass}">${(stats.totalKm > 0 ? stats.resultat / stats.totalKm : 0).toFixed(2)} TND</span></div>
                </div>
                <div class="stat-card">
                    <h4>📅 Activité</h4>
                    <div class="stat-row"><span>Premier trajet:</span><span>${formatDate(stats.firstTrip)}</span></div>
                    <div class="stat-row"><span>Dernier trajet:</span><span>${formatDate(stats.lastTrip)}</span></div>
                    <div class="stat-row"><span>Jours actifs:</span><span>${stats.activeDays}</span></div>
                    <div class="stat-row"><span>Trajets/Jour:</span><span>${stats.activeDays > 0 ? (stats.nbTrajets / stats.activeDays).toFixed(1) : 0}</span></div>
                </div>
            </div>
            
            <!-- Top Destinations Table -->
            <div class="profile-table-section">
                <h4>🗺️ Top Destinations</h4>
                <table class="profile-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Destination</th>
                            <th>Trajets</th>
                            <th>Km Total</th>
                            <th>Gasoil</th>
                            <th>Revenue Total</th>
                            <th>Moy. Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.topDestinations.map((d, i) => `
                            <tr>
                                <td><span class="rank-badge">${i + 1}</span></td>
                                <td><strong>${d.destination}</strong></td>
                                <td>${d.count}</td>
                                <td>${d.km.toLocaleString('fr-FR')} km</td>
                                <td>${d.gasoil.toLocaleString('fr-FR')} L</td>
                                <td class="result-positive">${d.revenue.toLocaleString('fr-FR')} TND</td>
                                <td>${d.avgRevenue.toFixed(0)} TND</td>
                            </tr>
                        `).join('') || '<tr><td colspan="7" class="no-data">Aucune destination</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <!-- Recent Activity -->
            <div class="profile-table-section">
                <h4>📝 Historique des Trajets (${filteredEntries.length} trajets)</h4>
                <div class="activity-scroll">
                    <table class="profile-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Origine</th>
                                <th>Destination</th>
                                <th>Km</th>
                                <th>Gasoil</th>
                                <th>Livraison</th>
                                <th>Coût</th>
                                <th>Résultat</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
            const histDaySeen = new Set(); return filteredEntries.slice().reverse().slice(0, 20).map(e => {
                const hKey = `${e.camionId}_${e.date}`;
                const hFirst = !histDaySeen.has(hKey);
                histDaySeen.add(hKey);
                const costs = DataModule.calculateEntryCosts(e, truck, hFirst);
                return `
                                    <tr>
                                        <td>${formatDate(e.date)}</td>
                                        <td>${e.origine || e.origineGouvernorat || '-'}</td>
                                        <td>${e.destination || e.gouvernorat || '-'}</td>
                                        <td>${e.kilometrage || 0} km</td>
                                        <td>${e.quantiteGasoil || 0} L</td>
                                        <td class="result-positive">${(e.prixLivraison || 0).toLocaleString('fr-FR')} TND</td>
                                        <td class="result-negative">${costs.coutTotal.toLocaleString('fr-FR')} TND</td>
                                        <td class="${costs.resultat >= 0 ? 'result-positive' : 'result-negative'}">${costs.resultat.toFixed(0)} TND</td>
                                    </tr>
                                `;
            }).join('');
        })() || '<tr><td colspan="8" class="no-data">Aucun trajet</td></tr>'}
                        </tbody>
                    </table>
                </div>
                ${filteredEntries.length > 20 ? `<p class="more-info">Affichage des 20 derniers trajets sur ${filteredEntries.length}</p>` : ''}
            </div>
        </div>
    `;

    // Configure modal
    document.getElementById('modalSave').style.display = 'none';
    document.getElementById('modalCancel').textContent = 'Fermer';
    document.getElementById('modal').classList.add('modal-large');

    App.showModal();

    // Draw charts
    setTimeout(() => renderProfileCharts(stats), 150);
}

// ==================== APPLY FILTERS ====================
async function applyFilters() {
    currentFilters.startDate = document.getElementById('filterStartDate').value;
    currentFilters.endDate = document.getElementById('filterEndDate').value;
    currentFilters.destination = document.getElementById('filterDestination').value;

    if (currentType === 'truck') {
        const matNorm = currentEntity.matricule?.replace(/\s+/g, '_') || '';
        const allEntries = (await DataModule.getEntries()).filter(e =>
            e.camionId === currentEntity.id || (matNorm && e.camionId === `truck_${matNorm}`)
        );
        showProfileModal('truck', currentEntity, allEntries);
    } else {
        const nomNorm = currentEntity.nom?.replace(/\s+/g, '_') || '';
        const allEntries = (await DataModule.getEntries()).filter(e =>
            e.chauffeurId === currentEntity.id || (nomNorm && e.chauffeurId === `driver_${nomNorm}`)
        );
        showProfileModal('driver', currentEntity, allEntries);
    }
}

async function resetFilters() {
    currentFilters = { startDate: null, endDate: null, destination: 'all' };

    if (currentType === 'truck') {
        await openTruckProfile(currentEntity.id);
    } else {
        await openDriverProfile(currentEntity.id);
    }
}

// ==================== CHART TABS ====================
let currentChartType = 'monthly';

function switchChart(type) {
    currentChartType = type;
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.toLowerCase().includes(type === 'monthly' ? 'mensuel' : 'hebdo'));
    });

    // Redraw with current data
    const filteredEntries = filterEntries(currentType === 'truck' ?
        window._profileEntries : window._profileEntries);
    const truck = currentType === 'driver' ? currentEntity.truck : currentEntity;
    const stats = calculateDetailedStats(filteredEntries, truck);
    renderTrendChart(stats);
}

// ==================== RENDER CHARTS ====================
function renderProfileCharts(stats) {
    // Store for chart switching
    window._profileStats = stats;

    // Destroy existing
    Object.values(profileCharts).forEach(chart => chart?.destroy());

    renderTrendChart(stats);
    renderCostsChart(stats);
    renderRoutesChart(stats);
}

function renderTrendChart(stats) {
    const ctx = document.getElementById('profileTrendChart')?.getContext('2d');
    if (!ctx) return;

    profileCharts.trend?.destroy();

    const data = currentChartType === 'monthly' ? stats.monthlyData : stats.weeklyData;
    const labels = data.map(d => currentChartType === 'monthly' ? formatMonth(d.month) : d.week);

    profileCharts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Profit',
                    data: data.map(d => d.profit),
                    backgroundColor: data.map(d => d.profit >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderRadius: 4
                },
                {
                    label: 'Revenus',
                    data: data.map(d => d.revenue),
                    type: 'line',
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
            }
        }
    });
}

function renderCostsChart(stats) {
    const ctx = document.getElementById('profileCostsChart')?.getContext('2d');
    if (!ctx) return;

    // Use actual breakdown from stats
    const gasoilCost = stats.totalGasoilCost || 0;
    const fixedCosts = stats.totalChargesFixes || 0;
    const assurance = stats.totalAssurance || 0;
    const taxe = stats.totalTaxe || 0;
    const personnel = stats.totalPersonnel || 0;
    const maintenance = stats.totalMaintenance || 0;

    profileCharts.costs = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Gasoil', 'Ch. Fixes', 'Assurance', 'Taxe', 'Personnel', 'Maintenance'],
            datasets: [{
                data: [gasoilCost, fixedCosts, assurance, taxe, personnel, maintenance],
                backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } } }
        }
    });
}

function renderRoutesChart(stats) {
    const ctx = document.getElementById('profileRoutesChart')?.getContext('2d');
    if (!ctx) return;

    const top5 = stats.topDestinations.slice(0, 5);

    profileCharts.routes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top5.map(d => d.destination.substring(0, 10)),
            datasets: [{
                label: 'Km',
                data: top5.map(d => d.km),
                backgroundColor: ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });
}

// ==================== UTILITIES ====================
function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    // Parse as local date to avoid timezone shift
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonth(monthStr) {
    if (!monthStr || monthStr === '-') return '-';
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return `${months[parseInt(month) - 1]} ${year?.substring(2)}`;
}

export const ProfileModule = {
    init,
    openTruckProfile,
    openDriverProfile,
    applyFilters,
    resetFilters,
    switchChart
};

window.ProfileModule = ProfileModule;
