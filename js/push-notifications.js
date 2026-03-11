/**
 * PUSH NOTIFICATIONS UTILITY - WEB SIDE
 * Sends push notifications to mobile drivers via Expo Push API
 * Called from planification, messenger, etc.
 * 
 * Flow:
 * 1. Mobile app registers on login: saves expoPushToken to Firestore users/{uid}
 * 2. Web reads users where driverId === chauffeurId → gets expoPushToken
 * 3. Web POSTs to exp.host/--/api/v2/push/send → Expo delivers to device even when closed
 */

import { db, collection, getDocs, query, where } from './firebase.js';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Fetch the Expo push token for a driver by their driverId
 */
async function getDriverPushToken(driverId) {
    try {
        const q = query(collection(db, 'users'), where('driverId', '==', driverId));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log(`[Push] No user found with driverId=${driverId}`);
            return null;
        }

        const userData = snap.docs[0].data();
        const token = userData.expoPushToken;

        if (!token) {
            console.log(`[Push] User ${snap.docs[0].id} has no expoPushToken yet`);
            return null;
        }

        console.log(`[Push] Token found for driverId=${driverId}`);
        return token;
    } catch (err) {
        console.warn('[Push] Error fetching push token:', err);
        return null;
    }
}

/**
 * Internal: send a push via Expo Push API
 */
async function sendExpoPush(expoPushToken, title, body, data = {}) {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
        console.warn('[Push] Invalid Expo push token:', expoPushToken);
        return false;
    }

    try {
        const response = await fetch(EXPO_PUSH_API, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: expoPushToken,
                title,
                body,
                data,
                sound: 'default',
                priority: 'high',
                channelId: 'default',
            }),
        });

        const result = await response.json();

        if (result.data?.status === 'ok') {
            console.log('[Push] ✅ Delivered:', title);
            return true;
        } else {
            console.warn('[Push] Non-ok response:', JSON.stringify(result));
            return false;
        }
    } catch (err) {
        console.warn('[Push] ❌ Fetch failed:', err.message);
        return false;
    }
}

/**
 * Send a trip update notification to a driver
 */
export async function notifyDriverTrip(chauffeurId, type, plan) {
    if (!chauffeurId) return;

    const token = await getDriverPushToken(chauffeurId);
    if (!token) return;

    const titles = {
        planifie: '📅 Nouveau voyage planifié',
        en_cours: '🚚 Voyage en cours !',
        update: '🔄 Voyage mis à jour',
    };

    const bodies = {
        planifie: `Voyage vers ${plan.destination || 'destination'} le ${plan.date || ''}`,
        en_cours: `Votre voyage vers ${plan.destination || 'destination'} a démarré`,
        update: `Voyage vers ${plan.destination || 'destination'} mis à jour`,
    };

    await sendExpoPush(
        token,
        titles[type] || '🔔 FleetTrack',
        bodies[type] || 'Mise à jour',
        { type, planId: plan.id, screen: 'planning' }
    );
}

/**
 * Send a new message notification to a driver
 */
export async function notifyDriverMessage(chauffeurId, senderName, messageText) {
    if (!chauffeurId) return;

    const token = await getDriverPushToken(chauffeurId);
    if (!token) return;

    await sendExpoPush(
        token,
        `💬 Message de ${senderName}`,
        messageText.substring(0, 150),
        { type: 'message', screen: 'messenger' }
    );
}
