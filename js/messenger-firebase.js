/**
 * MESSENGER MODULE - FIREBASE REALTIME DATABASE
 * Real-time chat between Chauffeurs and Admin
 */

import { rtdb, dbRef, dbPush, dbSet, onValue, onChildAdded, rtdbQuery, orderByChild, limitToLast } from './firebase.js';
import { AuthModule } from './auth-firebase.js';
import { notifyDriverMessage } from './push-notifications.js';

let currentConversationId = null;
let messagesListener = null;
let conversationsListener = null;
let messages = [];
let conversations = [];
let chauffeurUsers = []; // users with driverId

function init() {
    // Static bindings if elements exist in HTML
}

function getUserInfo() {
    const user = window.currentUser;
    if (!user) return null;
    return {
        uid: user.uid || user.id,
        name: user.displayName || user.email,
        role: user.role || user.roleName || 'user',
        driverId: user.driverId || null,
        isAdmin: user.role === 'super_admin' || !user.driverId
    };
}

async function refresh() {
    const user = getUserInfo();
    if (!user) return;

    // Load chauffeur accounts for "new message" button
    try {
        const allUsers = await AuthModule.getAllUsers();
        chauffeurUsers = allUsers.filter(u => u.driverId);
    } catch (e) { chauffeurUsers = []; }

    if (user.isAdmin) {
        loadConversationsList();
    } else {
        // Chauffeur: auto-open their conversation
        currentConversationId = `conv_${user.driverId || user.uid}`;
        ensureConversation(currentConversationId, user);
        renderChatView();
        listenToMessages(currentConversationId);
    }
}

function loadConversationsList() {
    const convRef = dbRef(rtdb, 'conversations');

    if (conversationsListener) conversationsListener();

    onValue(convRef, (snapshot) => {
        const data = snapshot.val();
        conversations = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        conversations.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        renderConversationsList();
    });
}

function renderConversationsList() {
    const container = document.getElementById('messengerContent');
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex;height:calc(100vh - 160px);gap:0;border-radius:12px;overflow:hidden;border:1px solid rgba(148,163,184,0.1)">
            <!-- Conversations List -->
            <div id="convList" style="width:320px;background:rgba(15,23,42,0.5);border-right:1px solid rgba(148,163,184,0.1);overflow-y:auto;display:flex;flex-direction:column">
                <div style="padding:16px;border-bottom:1px solid rgba(148,163,184,0.1)">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <h3 style="margin:0;font-size:16px;color:#f1f5f9">💬 Conversations</h3>
                        <button onclick="MessengerModule.showNewChat()" style="padding:6px 12px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">📝 Nouveau</button>
                    </div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px">${conversations.length} conversation(s)</div>
                </div>
                <!-- New chat panel (hidden by default) -->
                <div id="newChatPanel" style="display:none;padding:12px;border-bottom:1px solid rgba(148,163,184,0.1);background:rgba(99,102,241,0.05)">
                    <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:600">Choisir un chauffeur:</div>
                    ${chauffeurUsers.length === 0 ? '<div style="font-size:12px;color:#64748b;padding:8px 0">Aucun chauffeur avec compte</div>' : ''}
                    ${chauffeurUsers.map(u => `
                        <div onclick="MessengerModule.startChatWith('${u.driverId}','${(u.displayName || u.email || '').replace(/'/g, "\\'")}')"
                            style="padding:10px 12px;cursor:pointer;border-radius:8px;margin-bottom:4px;display:flex;align-items:center;gap:10px;transition:background 0.2s;background:rgba(15,23,42,0.3)"
                            onmouseover="this.style.background='rgba(99,102,241,0.15)'" onmouseout="this.style.background='rgba(15,23,42,0.3)'">
                            <div style="width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">👤</div>
                            <div>
                                <div style="font-weight:600;color:#f1f5f9;font-size:13px">${u.displayName || u.email}</div>
                                <div style="font-size:11px;color:#64748b">${u.roleName || 'Chauffeur'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="flex:1;overflow-y:auto">
                    ${conversations.length === 0 ? '<div style="padding:40px 16px;text-align:center;color:#64748b;font-size:13px">Aucune conversation<br><br>Cliquez <strong>📝 Nouveau</strong> pour commencer</div>' : ''}
                    ${conversations.map(c => `
                        <div class="conv-item ${currentConversationId === c.id ? 'conv-active' : ''}"
                            onclick="MessengerModule.openConversation('${c.id}')"
                            style="padding:14px 16px;cursor:pointer;border-bottom:1px solid rgba(148,163,184,0.05);
                                transition:background 0.2s;
                                background:${currentConversationId === c.id ? 'rgba(99,102,241,0.15)' : 'transparent'}"
                            onmouseover="if('${currentConversationId}'!=='${c.id}')this.style.background='rgba(99,102,241,0.08)'"
                            onmouseout="if('${currentConversationId}'!=='${c.id}')this.style.background='transparent'">
                            <div style="display:flex;align-items:center;gap:10px">
                                <div style="width:40px;height:40px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🚛</div>
                                <div style="flex:1;min-width:0">
                                    <div style="font-weight:600;color:#f1f5f9;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.chauffeurName || 'Chauffeur'}</div>
                                    <div style="font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.lastMessage || 'Pas de messages'}</div>
                                </div>
                                ${c.lastMessageAt ? `<div style="font-size:10px;color:#64748b">${formatTime(c.lastMessageAt)}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <!-- Chat Area -->
            <div style="flex:1;display:flex;flex-direction:column;background:rgba(15,23,42,0.3)">
                <div id="chatArea" style="flex:1;display:flex;align-items:center;justify-content:center">
                    <div style="text-align:center;color:#64748b">
                        <div style="font-size:48px;margin-bottom:12px">💬</div>
                        <div>Sélectionnez une conversation</div>
                        <div style="font-size:12px;margin-top:8px">ou cliquez <strong>📝 Nouveau</strong> pour commencer</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showNewChat() {
    const panel = document.getElementById('newChatPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function startChatWith(driverId, name) {
    const convId = `conv_${driverId}`;
    // Ensure the conversation exists
    const convRef = dbRef(rtdb, `conversations/${convId}`);
    dbSet(convRef, {
        chauffeurName: name || 'Chauffeur',
        chauffeurUid: driverId,
        lastMessage: '',
        lastMessageAt: Date.now()
    });
    // Hide new chat panel
    const panel = document.getElementById('newChatPanel');
    if (panel) panel.style.display = 'none';
    // Open conversation
    openConversation(convId);
}

function openConversation(convId) {
    currentConversationId = convId;
    renderConversationsList();
    renderChatArea();
    listenToMessages(convId);
}

function renderChatView() {
    const container = document.getElementById('messengerContent');
    if (!container) return;

    const user = getUserInfo();
    const displayName = user?.name || 'Mon Chat';

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:calc(100vh - 160px);border-radius:12px;overflow:hidden;border:1px solid rgba(148,163,184,0.1);background:rgba(15,23,42,0.3)">
            <!-- Chat Header -->
            <div style="padding:14px 20px;border-bottom:1px solid rgba(148,163,184,0.1);display:flex;align-items:center;gap:12px;background:rgba(15,23,42,0.4)">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">👑</div>
                <div>
                    <div style="font-weight:600;color:#f1f5f9;font-size:15px">Administration</div>
                    <div style="font-size:11px;color:#10b981">● En ligne</div>
                </div>
            </div>
            <!-- Messages -->
            <div id="messagesContainer" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px">
                <div style="text-align:center;color:#64748b;padding:40px;font-size:13px">💬 Bienvenue dans la messagerie!<br><br>Envoyez un message à l'administration.</div>
            </div>
            <!-- Input -->
            <div style="padding:12px 16px;border-top:1px solid rgba(148,163,184,0.1);display:flex;gap:10px;background:rgba(15,23,42,0.4)">
                <input id="messengerInput" type="text" placeholder="Écrire un message..."
                    style="flex:1;padding:12px 16px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:24px;font-size:14px;outline:none"
                    onkeypress="if(event.key==='Enter')MessengerModule.sendMsg()">
                <button onclick="MessengerModule.sendMsg()"
                    style="padding:12px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:24px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px">
                    📤 Envoyer
                </button>
            </div>
        </div>
    `;
}

function renderChatArea() {
    const chatArea = document.getElementById('chatArea');
    if (!chatArea) return;

    const conv = conversations.find(c => c.id === currentConversationId);
    const title = conv?.chauffeurName || 'Chat';

    chatArea.innerHTML = `
        <!-- Chat Header -->
        <div style="padding:14px 20px;border-bottom:1px solid rgba(148,163,184,0.1);display:flex;align-items:center;gap:12px;background:rgba(15,23,42,0.4)">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">🚛</div>
            <div>
                <div style="font-weight:600;color:#f1f5f9;font-size:14px">${title}</div>
                <div style="font-size:11px;color:#64748b">En ligne</div>
            </div>
        </div>
        <!-- Messages -->
        <div id="messagesContainer" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px">
            <div style="text-align:center;color:#64748b;padding:20px;font-size:13px">Début de la conversation</div>
        </div>
        <!-- Input -->
        <div style="padding:12px 16px;border-top:1px solid rgba(148,163,184,0.1);display:flex;gap:10px;background:rgba(15,23,42,0.4)">
            <input id="messengerInput" type="text" placeholder="Écrire un message..."
                style="flex:1;padding:12px 16px;background:rgba(15,23,42,0.5);color:#f1f5f9;border:1px solid rgba(148,163,184,0.2);border-radius:24px;font-size:14px;outline:none"
                onkeypress="if(event.key==='Enter')MessengerModule.sendMsg()">
            <button onclick="MessengerModule.sendMsg()"
                style="padding:12px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:24px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px">
                📤 Envoyer
            </button>
        </div>
    `;
}

function listenToMessages(convId) {
    if (messagesListener) messagesListener();

    const msgsRef = dbRef(rtdb, `messages/${convId}`);
    messages = [];

    onValue(msgsRef, (snapshot) => {
        const data = snapshot.val();
        messages = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        renderMessages();
    });
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const user = getUserInfo();
    if (!user) return;

    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#64748b;padding:40px;font-size:13px">Aucun message. Commencez la conversation!</div>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMine = msg.senderUid === user.uid;
        const time = msg.timestamp ? formatTime(msg.timestamp) : '';

        return `
            <div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};margin-bottom:4px">
                <div style="max-width:70%;padding:10px 16px;border-radius:${isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
                    background:${isMine ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'rgba(51,65,85,0.6)'};
                    color:#f1f5f9;font-size:14px;line-height:1.5">
                    ${!isMine ? `<div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:2px">${msg.senderName || 'Utilisateur'}</div>` : ''}
                    <div>${escapeHtml(msg.text)}</div>
                    <div style="font-size:10px;color:${isMine ? 'rgba(255,255,255,0.6)' : '#64748b'};text-align:right;margin-top:4px">${time}</div>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

async function sendMsg() {
    const input = document.getElementById('messengerInput');
    const text = input?.value?.trim();
    if (!text || !currentConversationId) return;

    const user = getUserInfo();
    if (!user) return;

    input.value = '';

    const msgData = {
        text: text,
        senderUid: user.uid,
        senderName: user.name,
        senderRole: user.role,
        timestamp: Date.now()
    };

    try {
        const msgsRef = dbRef(rtdb, `messages/${currentConversationId}`);
        await dbPush(msgsRef, msgData);

        const convRef = dbRef(rtdb, `conversations/${currentConversationId}`);
        await dbSet(convRef, {
            chauffeurName: conversations.find(c => c.id === currentConversationId)?.chauffeurName || user.name,
            lastMessage: text.substring(0, 50),
            lastMessageAt: Date.now(),
            lastSenderName: user.name
        });

        // Send push notification to driver if admin is sending
        if (user.isAdmin && currentConversationId.startsWith('conv_')) {
            const driverId = currentConversationId.replace('conv_', '');
            notifyDriverMessage(driverId, user.name, text).catch(e => console.warn('[Messenger] Push failed:', e));
        }
    } catch (err) {
        console.error('Error sending message:', err);
    }
}

function ensureConversation(convId, user) {
    const convRef = dbRef(rtdb, `conversations/${convId}`);
    onValue(convRef, (snapshot) => {
        if (!snapshot.exists()) {
            dbSet(convRef, {
                chauffeurName: user.name,
                chauffeurUid: user.uid,
                lastMessage: '',
                lastMessageAt: Date.now()
            });
        }
    }, { onlyOnce: true });
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export const MessengerModule = {
    init, refresh, openConversation, sendMsg, showNewChat, startChatWith
};
window.MessengerModule = MessengerModule;

