/**
 * TRAJECTORY STATISTICS MODULE
 * Provides historical stats for drivers/trucks on specific routes
 */

import { DataModule } from './data-firebase.js';

/**
 * Get driver's historical statistics for a specific trajectory
 * @param {string} driverId - Driver ID
 * @param {string} fromGouv - Origin governorate
 * @param {string} fromDeleg - Origin delegation
 * @param {string} toGouv - Destination governorate
 * @param {string} toDeleg - Destination delegation
 * @returns {Object} Statistics for this driver on this route
 */
async function getDriverTrajectoryStats(driverId, fromGouv, fromDeleg, toGouv, toDeleg) {
    const entries = await DataModule.getEntries();

    // Filter entries for this driver on this route
    const matchingEntries = entries.filter(e =>
        e.chauffeurId === driverId &&
        e.origineGouvernorat === fromGouv &&
        e.origineDelegation === fromDeleg &&
        e.gouvernorat === toGouv &&
        e.delegation === toDeleg
    );

    if (matchingEntries.length === 0) {
        return {
            tripCount: 0,
            avgKm: 0,
            avgFuel: 0,
            avgCost: 0,
            avgRevenue: 0,
            avgResult: 0,
            bestResult: null,
            worstResult: null,
            lastTrip: null,
            rank: null, // Rank among all drivers for this route
            driverName: null
        };
    }

    // Get driver info
    const driver = DataModule.getDriverById(driverId);
    const driverName = driver?.nom || 'Inconnu';

    // Calculate stats
    const tripCount = matchingEntries.length;
    const totalKm = matchingEntries.reduce((sum, e) => sum + (e.kilometrage || 0), 0);
    const totalFuel = matchingEntries.reduce((sum, e) => sum + (e.quantiteGasoil || 0), 0);
    const truckDaySeen1 = new Set();
    const totalCost = matchingEntries.reduce((sum, e) => {
        const truck = DataModule.getTruckById(e.camionId);
        if (!truck) return sum;
        const key = `${e.camionId}_${e.date}`;
        const isFirst = !truckDaySeen1.has(key);
        truckDaySeen1.add(key);
        const costs = DataModule.calculateEntryCosts(e, truck, isFirst);
        return sum + costs.coutTotal;
    }, 0);
    const totalRevenue = matchingEntries.reduce((sum, e) => sum + (e.prixLivraison || 0), 0);

    const avgKm = totalKm / tripCount;
    const avgFuel = totalFuel / tripCount;
    const avgCost = totalCost / tripCount;
    const avgRevenue = totalRevenue / tripCount;
    const avgResult = avgRevenue - avgCost;

    // Find best and worst trips
    const truckDaySeen2 = new Set();
    const results = matchingEntries.map(e => {
        const truck = DataModule.getTruckById(e.camionId);
        const key = `${e.camionId}_${e.date}`;
        const isFirst = !truckDaySeen2.has(key);
        truckDaySeen2.add(key);
        const costs = truck ? DataModule.calculateEntryCosts(e, truck, isFirst) : { coutTotal: 0 };
        return {
            date: e.date,
            result: (e.prixLivraison || 0) - costs.coutTotal,
            km: e.kilometrage || 0,
            fuel: e.quantiteGasoil || 0
        };
    }).sort((a, b) => b.result - a.result);

    const bestResult = results[0];
    const worstResult = results[results.length - 1];
    const lastTrip = matchingEntries.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    // Get ranking among all drivers for this route
    const rank = await getDriverRankForRoute(driverId, fromGouv, fromDeleg, toGouv, toDeleg);

    return {
        tripCount,
        avgKm: Math.round(avgKm),
        avgFuel: Math.round(avgFuel * 10) / 10,
        avgCost: Math.round(avgCost * 100) / 100,
        avgRevenue: Math.round(avgRevenue * 100) / 100,
        avgResult: Math.round(avgResult * 100) / 100,
        bestResult,
        worstResult,
        lastTrip: lastTrip?.date || null,
        rank,
        driverName
    };
}

/**
 * Get truck's historical statistics for a specific trajectory
 */
async function getTruckTrajectoryStats(truckId, fromGouv, fromDeleg, toGouv, toDeleg) {
    const entries = await DataModule.getEntries();
    const truck = DataModule.getTruckById(truckId);

    const matchingEntries = entries.filter(e =>
        e.camionId === truckId &&
        e.origineGouvernorat === fromGouv &&
        e.origineDelegation === fromDeleg &&
        e.gouvernorat === toGouv &&
        e.delegation === toDeleg
    );

    if (matchingEntries.length === 0) {
        return {
            tripCount: 0,
            avgKm: 0,
            avgFuel: 0,
            avgConsumption: 0,
            truckMatricule: truck?.matricule || 'Inconnu'
        };
    }

    const tripCount = matchingEntries.length;
    const totalKm = matchingEntries.reduce((sum, e) => sum + (e.kilometrage || 0), 0);
    const totalFuel = matchingEntries.reduce((sum, e) => sum + (e.quantiteGasoil || 0), 0);

    const avgKm = totalKm / tripCount;
    const avgFuel = totalFuel / tripCount;
    const avgConsumption = totalKm > 0 ? (totalFuel / totalKm) * 100 : 0;

    return {
        tripCount,
        avgKm: Math.round(avgKm),
        avgFuel: Math.round(avgFuel * 10) / 10,
        avgConsumption: Math.round(avgConsumption * 100) / 100, // L/100km
        truckMatricule: truck?.matricule || 'Inconnu'
    };
}

/**
 * Get driver's ranking for a specific route based on average result
 */
async function getDriverRankForRoute(driverId, fromGouv, fromDeleg, toGouv, toDeleg) {
    const entries = await DataModule.getEntries();
    const drivers = await DataModule.getDrivers();

    // Get entries for this route
    const routeEntries = entries.filter(e =>
        e.origineGouvernorat === fromGouv &&
        e.origineDelegation === fromDeleg &&
        e.gouvernorat === toGouv &&
        e.delegation === toDeleg
    );

    if (routeEntries.length === 0) return null;

    // Calculate average result per driver
    const driverResults = {};
    const truckDaySeen3 = new Set();
    routeEntries.forEach(e => {
        const truck = DataModule.getTruckById(e.camionId);
        if (!truck) return;
        const key = `${e.camionId}_${e.date}`;
        const isFirst = !truckDaySeen3.has(key);
        truckDaySeen3.add(key);
        const costs = DataModule.calculateEntryCosts(e, truck, isFirst);
        const result = (e.prixLivraison || 0) - costs.coutTotal;

        if (!driverResults[e.chauffeurId]) {
            driverResults[e.chauffeurId] = { total: 0, count: 0 };
        }
        driverResults[e.chauffeurId].total += result;
        driverResults[e.chauffeurId].count++;
    });

    // Calculate averages and sort
    const rankings = Object.entries(driverResults)
        .map(([id, data]) => ({
            driverId: id,
            avgResult: data.total / data.count
        }))
        .sort((a, b) => b.avgResult - a.avgResult);

    const rank = rankings.findIndex(r => r.driverId === driverId) + 1;
    return { rank, total: rankings.length };
}

/**
 * Get comparison with other drivers on the same route
 */
async function getRouteComparison(fromGouv, fromDeleg, toGouv, toDeleg) {
    const entries = await DataModule.getEntries();
    const drivers = await DataModule.getDrivers();

    const routeEntries = entries.filter(e =>
        e.origineGouvernorat === fromGouv &&
        e.origineDelegation === fromDeleg &&
        e.gouvernorat === toGouv &&
        e.delegation === toDeleg
    );

    if (routeEntries.length === 0) {
        return { data: [], routeStats: null };
    }

    // Aggregate by driver
    const driverStats = {};
    const truckDaySeen4 = new Set();
    routeEntries.forEach(e => {
        if (!driverStats[e.chauffeurId]) {
            const driver = drivers.find(d => d.id === e.chauffeurId);
            driverStats[e.chauffeurId] = {
                driverId: e.chauffeurId,
                driverName: driver?.nom || 'Inconnu',
                tripCount: 0,
                totalKm: 0,
                totalFuel: 0,
                totalRevenue: 0,
                totalCost: 0
            };
        }

        const truck = DataModule.getTruckById(e.camionId);
        const key = `${e.camionId}_${e.date}`;
        const isFirst = !truckDaySeen4.has(key);
        truckDaySeen4.add(key);
        const costs = truck ? DataModule.calculateEntryCosts(e, truck, isFirst) : { coutTotal: 0 };

        driverStats[e.chauffeurId].tripCount++;
        driverStats[e.chauffeurId].totalKm += e.kilometrage || 0;
        driverStats[e.chauffeurId].totalFuel += e.quantiteGasoil || 0;
        driverStats[e.chauffeurId].totalRevenue += e.prixLivraison || 0;
        driverStats[e.chauffeurId].totalCost += costs.coutTotal;
    });

    // Calculate averages
    const comparison = Object.values(driverStats).map(d => ({
        ...d,
        avgKm: Math.round(d.totalKm / d.tripCount),
        avgFuel: Math.round((d.totalFuel / d.tripCount) * 10) / 10,
        avgRevenue: Math.round((d.totalRevenue / d.tripCount) * 100) / 100,
        avgCost: Math.round((d.totalCost / d.tripCount) * 100) / 100,
        avgResult: Math.round(((d.totalRevenue - d.totalCost) / d.tripCount) * 100) / 100
    })).sort((a, b) => b.avgResult - a.avgResult);

    // Route overall stats
    const routeStats = {
        totalTrips: routeEntries.length,
        totalDrivers: comparison.length,
        avgKm: Math.round(comparison.reduce((s, d) => s + d.avgKm, 0) / comparison.length),
        avgResult: Math.round((comparison.reduce((s, d) => s + d.avgResult, 0) / comparison.length) * 100) / 100
    };

    return { data: comparison, routeStats };
}

/**
 * Render trajectory stats panel for entry modal
 */
function renderTrajectoryStatsPanel(driverStats, truckStats) {
    if (driverStats.tripCount === 0 && truckStats.tripCount === 0) {
        return `
            <div class="trajectory-stats empty" style="background: rgba(100, 116, 139, 0.1); border-radius: 8px; padding: 12px; margin-top: 12px;">
                <p style="color: #64748b; text-align: center; margin: 0;">
                    📊 Aucun historique pour ce trajet
                </p>
            </div>
        `;
    }

    const rankBadge = driverStats.rank ?
        `<span class="rank-badge" style="background: ${driverStats.rank.rank <= 3 ? '#10b981' : '#64748b'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">
            #${driverStats.rank.rank}/${driverStats.rank.total}
        </span>` : '';

    return `
        <div class="trajectory-stats" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1)); border-radius: 12px; padding: 16px; margin-top: 16px; border: 1px solid rgba(59, 130, 246, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="color: #3b82f6; margin: 0;">📈 Statistiques Trajet</h4>
                ${rankBadge}
            </div>
            
            ${driverStats.tripCount > 0 ? `
            <div style="margin-bottom: 12px;">
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">🚶 Chauffeur: ${driverStats.driverName}</div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                    <div style="text-align: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 1.1rem;">${driverStats.tripCount}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Trajets</div>
                    </div>
                    <div style="text-align: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 1.1rem;">${driverStats.avgKm}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Km moy.</div>
                    </div>
                    <div style="text-align: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 1.1rem;">${driverStats.avgFuel} L</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Gasoil moy.</div>
                    </div>
                    <div style="text-align: center; padding: 8px; background: ${driverStats.avgResult >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; border-radius: 6px;">
                        <div style="font-weight: bold; font-size: 1.1rem; color: ${driverStats.avgResult >= 0 ? '#10b981' : '#ef4444'};">${driverStats.avgResult} TND</div>
                        <div style="font-size: 0.7rem; color: #94a3b8;">Résultat moy.</div>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${truckStats.tripCount > 0 ? `
            <div style="font-size: 0.75rem; color: #64748b;">
                🚚 Camion ${truckStats.truckMatricule}: ${truckStats.tripCount} trajets, ${truckStats.avgConsumption} L/100km
            </div>
            ` : ''}
        </div>
    `;
}

export const TrajectoryStatsModule = {
    getDriverTrajectoryStats,
    getTruckTrajectoryStats,
    getDriverRankForRoute,
    getRouteComparison,
    renderTrajectoryStatsPanel
};

window.TrajectoryStatsModule = TrajectoryStatsModule;
