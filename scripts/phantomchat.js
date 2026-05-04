(function () {
    'use strict';
    const CHAT_URL = 'https://chat.leelive2021.workers.dev';
    const STORAGE_KEY = 'phantom_chat_user';
    const MAX_MSG = 300;

    let panel, bubble, badge, msgContainer, input, onlineEl, headerTitle;
    let isOpen = false;
    let messages = [];
    let unread = 0;
    let eventSource = null;
    let user = null;
    let uid = null;
    let reconnectTimer = null;
    let lastSendTime = 0;

    user = loadUser();
    uid = user ? user.uid : null;

    function loadUser() {
        let d = {};
        try {
            d = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch { }
        if (!d.uid) d.uid = generateUID();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
        return d.name ? d : d; // Returns object with at least a uid
    }

    function saveUser(u) {
        if (!u.uid) u.uid = user ? user.uid : generateUID();
        user = u;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    }

    function generateUID() {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function escapeHtml(t) {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    function playNotifSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch {}
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
#pc-bubble {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--surface, #0f0f0f);
    border: 1px solid var(--border, #2a2a2a);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10000;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
#pc-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.5); }
#pc-bubble svg { width: 22px; height: 22px; color: var(--text-muted, #71717a); transition: color 0.2s; }
#pc-bubble:hover svg { color: var(--text, #e4e4e7); }
#pc-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    background: #ef4444;
    color: #fff;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 700;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    line-height: 1;
}
#pc-panel {
    position: fixed;
    bottom: 82px;
    right: 20px;
    width: 380px;
    height: 520px;
    background: var(--surface, #0f0f0f);
    border: 1px solid var(--border, #2a2a2a);
    border-radius: 16px;
    z-index: 10001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transform: translateY(12px) scale(0.97);
    pointer-events: none;
    transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
}
#pc-panel.open {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
}
.pc-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border, #2a2a2a);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15,15,15,0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    flex-shrink: 0;
}
.pc-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}
.pc-header-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text, #e4e4e7);
}
.pc-online {
    font-size: 0.7rem;
    color: var(--text-dim, #52525b);
    display: flex;
    align-items: center;
    gap: 5px;
}
.pc-online-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    animation: pcPulse 2s infinite;
}
@keyframes pcPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
.pc-close {
    background: none;
    border: none;
    color: var(--text-dim, #52525b);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
}
.pc-close:hover { background: rgba(255,255,255,0.08); color: var(--text, #e4e4e7); }
.pc-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.pc-messages::-webkit-scrollbar { width: 4px; }
.pc-messages::-webkit-scrollbar-track { background: transparent; }
.pc-messages::-webkit-scrollbar-thumb { background: var(--border, #2a2a2a); border-radius: 2px; }
.pc-msg {
    padding: 6px 10px;
    border-radius: 8px;
    transition: background 0.15s;
    line-height: 1.45;
}
.pc-msg:hover { background: rgba(255,255,255,0.03); }
.pc-msg-name {
    font-size: 0.8rem;
    font-weight: 600;
    cursor: default;
}
.pc-msg-time {
    font-size: 0.65rem;
    color: var(--text-dim, #52525b);
    margin-left: 6px;
    font-weight: 400;
}
.pc-msg-text {
    font-size: 0.825rem;
    color: var(--text, #e4e4e7);
    word-break: break-word;
    margin-top: 1px;
}
.pc-msg-system {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-dim, #52525b);
    padding: 8px;
    font-style: italic;
}
.pc-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    color: var(--text-dim, #52525b);
    font-size: 0.8rem;
}
.pc-empty svg { width: 32px; height: 32px; opacity: 0.3; }
.pc-footer {
    padding: 10px 12px;
    border-top: 1px solid var(--border, #2a2a2a);
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: rgba(15,15,15,0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    flex-shrink: 0;
}
.pc-input {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border, #2a2a2a);
    border-radius: 10px;
    padding: 9px 12px;
    color: var(--text, #e4e4e7);
    font-size: 0.825rem;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    outline: none;
    resize: none;
    min-height: 20px;
    max-height: 80px;
    transition: border-color 0.15s;
}
.pc-input:focus { border-color: var(--text-dim, #52525b); }
.pc-input::placeholder { color: var(--text-dim, #52525b); }
.pc-send {
    background: var(--text, #e4e4e7);
    color: var(--bg, #0a0a0a);
    border: none;
    border-radius: 10px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s, transform 0.15s;
}
.pc-send:hover { opacity: 0.85; transform: scale(1.04); }
.pc-send:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
.pc-send svg { width: 16px; height: 16px; }
.pc-name-prompt {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 30px;
}
.pc-name-prompt h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #e4e4e7);
    margin: 0;
}
.pc-name-prompt p {
    font-size: 0.8rem;
    color: var(--text-dim, #52525b);
    margin: 0;
    text-align: center;
}
.pc-name-input {
    width: 100%;
    max-width: 220px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border, #2a2a2a);
    border-radius: 10px;
    color: var(--text, #e4e4e7);
    font-size: 0.875rem;
    text-align: center;
    outline: none;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    transition: border-color 0.15s;
}
.pc-name-input:focus { border-color: var(--text-dim, #52525b); }
.pc-name-input::placeholder { color: var(--text-dim, #52525b); }
.pc-name-btn {
    padding: 9px 28px;
    background: var(--text, #e4e4e7);
    color: var(--bg, #0a0a0a);
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.825rem;
    cursor: pointer;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    transition: opacity 0.15s;
}
.pc-name-btn:hover { opacity: 0.85; }
.pc-error {
    font-size: 0.75rem;
    color: #ef4444;
    min-height: 18px;
}
.pc-change-name {
    background: none;
    border: none;
    color: var(--text-dim, #52525b);
    font-size: 0.7rem;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    transition: color 0.15s;
}
.pc-change-name:hover { color: var(--text, #e4e4e7); }
@media (max-width: 480px) {
    #pc-panel { right: 0; bottom: 0; width: 100%; height: 100%; border-radius: 0; }
    #pc-bubble { bottom: 14px; right: 14px; }
}
`;
        document.head.appendChild(style);
    }

    function createBubble() {
        bubble = document.createElement('div');
        bubble.id = 'pc-bubble';
        bubble.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <div id="pc-badge"></div>
        `;
        bubble.addEventListener('click', togglePanel);
        document.body.appendChild(bubble);
        badge = document.getElementById('pc-badge');
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'pc-panel';
        panel.innerHTML = `
            <div class="pc-header">
                <div class="pc-header-left">
                    <span class="pc-header-title" id="pc-title">Live Chat</span>
                    <span class="pc-online" id="pc-online"><span class="pc-online-dot"></span>0</span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button class="pc-change-name" id="pc-rename" title="Change name">rename</button>
                    <button class="pc-close" id="pc-close-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <div class="pc-messages" id="pc-messages"></div>
            <div class="pc-footer" id="pc-footer">
                <input type="text" class="pc-input" id="pc-input" placeholder="Type a message..." maxlength="${MAX_MSG}" autocomplete="off">
                <button class="pc-send" id="pc-send" disabled>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                </button>
            </div>
        `;
        document.body.appendChild(panel);

        msgContainer = document.getElementById('pc-messages');
        input = document.getElementById('pc-input');
        onlineEl = document.getElementById('pc-online');
        headerTitle = document.getElementById('pc-title');

        document.getElementById('pc-close-btn').addEventListener('click', togglePanel);
        document.getElementById('pc-send').addEventListener('click', sendMessage);
        document.getElementById('pc-rename').addEventListener('click', showNamePrompt);

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        input.addEventListener('input', () => {
            document.getElementById('pc-send').disabled = !input.value.trim();
        });

        if (!user || !user.name) {
            showNamePrompt();
        } else {
            connectSSE();
        }
    }

    function showNamePrompt() {
        const footer = document.getElementById('pc-footer');
        footer.style.display = 'none';
        msgContainer.innerHTML = `
            <div class="pc-name-prompt">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim, #52525b)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h3>Pick a nickname</h3>
                <p>This is how others will see you in the chat</p>
                <input type="text" class="pc-name-input" id="pc-name-field" placeholder="Your name" maxlength="${MAX_MSG}" autocomplete="off">
                <div class="pc-error" id="pc-name-error"></div>
                <button class="pc-name-btn" id="pc-name-submit">Join Chat</button>
            </div>
        `;

        const field = document.getElementById('pc-name-field');
        const btn = document.getElementById('pc-name-submit');
        const err = document.getElementById('pc-name-error');

        if (user && user.name) field.value = user.name;

        const submit = () => {
            const name = field.value.trim();
            if (name.length < 2) { err.textContent = 'At least 2 characters'; return; }
            if (name.length > 20) { err.textContent = 'Max 20 characters'; return; }
            saveUser({ ...user, name });
            footer.style.display = 'flex';
            renderMessages();
            if (!eventSource) connectSSE();
        };

        btn.addEventListener('click', submit);
        field.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        setTimeout(() => field.focus(), 100);
    }

    function togglePanel() {
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        if (isOpen) {
            unread = 0;
            updateBadge();
            scrollBottom();
            if (user && user.name) input.focus();
        }
    }

    function updateBadge() {
        if (unread > 0 && !isOpen) {
            badge.style.display = 'flex';
            badge.textContent = unread > 99 ? '99+' : unread;
        } else {
            badge.style.display = 'none';
        }
    }

    function scrollBottom() {
        requestAnimationFrame(() => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    }

    function renderMessages() {
        if (!messages.length) {
            msgContainer.innerHTML = `
                <div class="pc-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>No messages yet</span>
                    <span>Be the first to say something!</span>
                </div>
            `;
            return;
        }

        msgContainer.innerHTML = messages.map(m => {
            if (m.system) {
                return `<div class="pc-msg-system">${escapeHtml(m.message)}</div>`;
            }
            return `
                <div class="pc-msg" data-id="${m.id}">
                    <span class="pc-msg-name" style="color:${m.color}">${escapeHtml(m.name)}<span class="pc-msg-time">${formatTime(m.ts)}</span></span>
                    <div class="pc-msg-text">${escapeHtml(m.message)}</div>
                </div>
            `;
        }).join('');
        scrollBottom();
    }

    function appendMessage(m) {
        if (m.system) {
            const div = document.createElement('div');
            div.className = 'pc-msg-system';
            div.textContent = m.message;
            const emptyEl = msgContainer.querySelector('.pc-empty');
            if (emptyEl) emptyEl.remove();
            msgContainer.appendChild(div);
            scrollBottom();
            return;
        }

        const emptyEl = msgContainer.querySelector('.pc-empty');
        if (emptyEl) emptyEl.remove();

        const div = document.createElement('div');
        div.className = 'pc-msg';
        div.dataset.id = m.id;
        div.innerHTML = `
            <span class="pc-msg-name" style="color:${m.color}">${escapeHtml(m.name)}<span class="pc-msg-time">${formatTime(m.ts)}</span></span>
            <div class="pc-msg-text">${escapeHtml(m.message)}</div>
        `;
        msgContainer.appendChild(div);

        const isAtBottom = msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 80;
        if (isAtBottom) scrollBottom();
    }

    function connectSSE() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        uid = user ? user.uid : generateUID();
        const url = `${CHAT_URL}/messages?stream=1&uid=${encodeURIComponent(uid)}`;

        try {
            eventSource = new EventSource(url);
        } catch {
            fallbackPoll();
            return;
        }

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                handleEvent(data);
            } catch {}
        };

        eventSource.onerror = () => {
            eventSource.close();
            eventSource = null;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connectSSE, 5000);
        };
    }

    function handleEvent(data) {
        if (data.type === 'init') {
            messages = data.messages || [];
            renderMessages();
            updateOnline(data.online);
        } else if (data.type === 'message') {
            const { type, ...msg } = data;
            messages.push(msg);
            if (messages.length > 200) messages = messages.slice(-200);
            appendMessage(msg);

            if (!isOpen) {
                unread++;
                updateBadge();
                playNotifSound();
            }
        } else if (data.type === 'delete') {
            messages = messages.filter(m => m.id !== data.id);
            const el = msgContainer.querySelector(`[data-id="${data.id}"]`);
            if (el) el.remove();
        } else if (data.type === 'clear') {
            messages = [];
            renderMessages();
        } else if (data.type === 'ping') {
            updateOnline(data.online);
        }
    }

    function updateOnline(count) {
        if (onlineEl) {
            onlineEl.innerHTML = `<span class="pc-online-dot"></span>${count || 0}`;
        }
    }

    function fallbackPoll() {
        async function poll() {
            try {
                const res = await fetch(`${CHAT_URL}/messages`);
                const data = await res.json();
                const oldLen = messages.length;
                messages = data.messages || [];
                if (messages.length > oldLen && !isOpen) {
                    unread += messages.length - oldLen;
                    updateBadge();
                }
                renderMessages();
                updateOnline(data.online);
            } catch {}
            setTimeout(poll, 4000);
        }
        poll();
    }

    async function sendMessage() {
        if (!user || !user.name || !input.value.trim()) return;

        const now = Date.now();

        const text = input.value.trim().substring(0, MAX_MSG);
        input.value = '';
        document.getElementById('pc-send').disabled = true;
        lastSendTime = now;

        try {
            const res = await fetch(`${CHAT_URL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: user.name, message: text, uid: user.uid }),
            });
            const data = await res.json();
            if (!res.ok) {
                const isFlood = data.error && (data.error.includes('too fast') || data.error.includes('slow down') || data.error.includes('locked'));
                showToast(isFlood ? 'Slow down!' : (data.error || 'Failed to send'));
                input.value = text;
            }
        } catch {
            showToast('Connection error');
            input.value = text;
        }

        document.getElementById('pc-send').disabled = !input.value.trim();
    }

    function showToast(msg) {
        const old = document.getElementById('pc-toast');
        if (old) old.remove();

        const t = document.createElement('div');
        t.id = 'pc-toast';
        t.textContent = msg;
        t.style.cssText = `
            position:fixed;bottom:90px;right:80px;background:rgba(239,68,68,0.9);color:#fff;
            padding:8px 16px;border-radius:8px;font-size:0.8rem;z-index:10002;
            animation:pcToastIn 0.2s;font-family:var(--font-sans,'Inter',system-ui,sans-serif);
        `;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }

    function init() {
        const settings = (() => {
            try { return JSON.parse(localStorage.getItem('void_settings') || '{}'); } catch { return {}; }
        })();

        const config = window.SITE_CONFIG || {};
        const defaults = config.defaults || {};
        const enabled = settings.discordWidget !== undefined ? settings.discordWidget : (defaults.discordWidget !== undefined ? defaults.discordWidget : true);
        if (!enabled) return;

        injectStyles();
        createBubble();
        createPanel();
    }

    function destroy() {
        if (eventSource) { eventSource.close(); eventSource = null; }
        if (reconnectTimer) clearTimeout(reconnectTimer);
        const b = document.getElementById('pc-bubble');
        const p = document.getElementById('pc-panel');
        if (b) b.remove();
        if (p) p.remove();
    }

    window.PhantomChatWidget = { init, destroy, toggle: togglePanel };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
