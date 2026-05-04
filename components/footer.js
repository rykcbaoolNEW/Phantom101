(function () {
    'use strict';

    let rootPrefix = '';
    const scriptName = 'components/footer.js';
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        if (src && src.includes(scriptName)) {
            rootPrefix = src.split(scriptName)[0];
            break;
        }
    }


    function getConfig() {
        return window.SITE_CONFIG || {};
    }

    let config = getConfig();
    const STORAGE_KEY = 'void_settings';
    let storedSettings = {};
    try { storedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { }

    function getSettings() {
        return { ...(config.defaults || {}), ...storedSettings };
    }

    let settings = getSettings();

    if (!document.querySelector('link[href*="styles/modals.css"]')) {
        const modalLink = document.createElement('link');
        modalLink.rel = 'stylesheet';
        modalLink.href = `${rootPrefix}styles/modals.css`;
        document.head.appendChild(modalLink);
    }

    const footer = document.createElement('footer');
    footer.id = 'site-footer';
    footer.innerHTML = `
        <style>
            #site-footer {
                margin-top: 0px;
                padding: 20px;
                border-top: 1px solid var(--border, #1f1f1f);
                text-align: center;
                background: transparent;
            }
            #site-footer .footer-links {
                display: flex;
                gap: 16px;
                justify-content: center;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }
            #site-footer .footer-link {
                font-size: 12px;
                color: var(--text-muted, #71717a);
                text-decoration: none;
                transition: color 0.15s;
                font-family: 'Inter', sans-serif;
                cursor: pointer;
            }
            #site-footer .footer-link:hover {
                color: var(--text, #e4e4e7);
            }
            #site-footer .footer-version {
                font-size: 11px;
                color: var(--text-dim, #52525b);
                cursor: pointer;
                font-family: 'Inter', sans-serif;
            }
            #site-footer .footer-version:hover {
                color: var(--text-muted, #71717a);
            }
        </style>
        <div class="footer-links">
            <a href="${rootPrefix}pages/settings.html" class="footer-link"><i class="fa-solid fa-gear"></i> Settings</a>
            <a id="footer-changelog" class="footer-link"><i class="fa-solid fa-clock-rotate-left"></i> Changelog</a>
            <a href="${config.discord?.inviteUrl || '#'}" target="_blank" class="footer-link"><i class="fa-brands fa-discord"></i> Discord</a>
            <a href="${rootPrefix}pages/terms.html" class="footer-link">Terms</a>
            <a href="${rootPrefix}pages/disclaimer.html" class="footer-link">Disclaimer</a>
            <a href="${rootPrefix}pages/extra.html" class="footer-link">Credits</a>
        </div>
        <span class="footer-version" id="footer-version">&copy; 2026 ${config.name || 'Phantom Unblocked'}. All rights reserved. | v${config.version || '1.0.0'}</span>
        <span class="footer-online-counter" style="margin-left: 12px; font-size: 0.75rem; color: var(--text-dim, #52525b);">
            <span id="footer-online-count">--</span> online
            <span id="footer-refresh-countdown" style="margin-left: 4px; opacity: 0.6;"></span>
        </span>
    `;

    document.body.appendChild(footer);

    function getSessionId() {
        const key = 'phantom_session_id';
        let id = localStorage.getItem(key);
        if (!id) {
            id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
            localStorage.setItem(key, id);
            localStorage.setItem('phantom_session_created', Math.floor(Date.now() / 1000).toString());
        }
        if (!localStorage.getItem('phantom_session_created')) {
            localStorage.setItem('phantom_session_created', Math.floor(Date.now() / 1000).toString());
        }
        return id;
    }

    const DEFAULT_CYCLE = 30;
    let countdownSeconds = (DEFAULT_CYCLE - (Math.floor(Date.now() / 1000) % DEFAULT_CYCLE)) || DEFAULT_CYCLE;
    let countdownInterval;

    function startCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);

        const updateCountdownUI = () => {
            const footerCountEl = document.getElementById('footer-refresh-countdown');
            const pageOnlineEl = document.getElementById('page-online-count');

            if (footerCountEl) {
                footerCountEl.textContent = `(Refreshing in ${countdownSeconds}s)`;
            }

            // Also update the page element if it exists (for index2.html style)
            const pageRefreshEl = document.getElementById('page-refresh-countdown');
            if (pageRefreshEl) {
                pageRefreshEl.textContent = `(Refreshing in ${countdownSeconds}s)`;
            }
        };

        updateCountdownUI();
        countdownInterval = setInterval(() => {
            countdownSeconds--;
            updateCountdownUI();
            if (countdownSeconds <= 0) {
                clearInterval(countdownInterval);
                updateCounter();
            }
        }, 1000);
    }

    function triggerPanic() {
        const parentOverlay = window.parent?.document?.getElementById('panic-overlay');
        if (parentOverlay) {
            parentOverlay.style.display = 'block';
        } else {
            const overlay = document.createElement('div');
            overlay.id = 'panic-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:99999;';
            document.body.appendChild(overlay);
        }

        const url = settings.panicUrl || 'https://classroom.google.com';
        try { window.top.location.href = url; } catch { window.location.href = url; }
    }

    async function updateCounter() {
        try {
            const sessionId = getSessionId();
            const url = `https://counter.leelive2021.workers.dev/v2/c3luYw?k=${encodeURIComponent(sessionId)}&o=${encodeURIComponent(window.location.hostname)}`;

            const urlParams = new URLSearchParams(window.location.search);
            let res;
            if (urlParams.get('priv_verified')) {
                res = await fetch(`${url}&priv_verified=${urlParams.get('priv_verified')}`);
            } else {
                res = await fetch(url);
            }
            const data = await res.json();

            if (data.maintenance) {
                if (data.fallback) settings.panicUrl = data.fallback;
                triggerPanic();
                return;
            }

            const isLocalLocked = config.domainLock && config.domainLock.enabled && config.domainLock.password;
            const isServerLocked = data.locked && data.private;
            const localUnlocked = sessionStorage.getItem('phantom_local_unlocked') === 'true';

            if (isServerLocked || (isLocalLocked && !localUnlocked)) {
                // Aggressively kill notifications and overlapping UI
                if (window.Notify) {
                    window.Notify.info = () => { }; window.Notify.success = () => { };
                    window.Notify.warning = () => { }; window.Notify.error = () => { };
                }
                const styleClear = document.createElement('style');
                styleClear.innerHTML = '* { visibility: hidden !important; } body, html { background: #f9f9f9 !important; } #dl-container, #dl-container * { visibility: visible !important; }';
                document.head.appendChild(styleClear);

                document.documentElement.innerHTML = `
                <head>
                    <title>future</title>
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                            background: #000 !important; 
                            color: #fff; 
                            line-height: 1.5;
                            min-height: 100vh;
                            margin: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        * { box-sizing: border-box; }
                        .section { 
                            padding-bottom: 20px; 
                            border-bottom: 1px dashed #333; 
                            text-align: left;
                        }
                        input[type="password"] {
                            background: #1a1a1a;
                            border: 1px solid #333;
                            color: #eee;
                            padding: 8px;
                            border-radius: 4px;
                            outline: none;
                            color-scheme: dark;
                            font-family: inherit;
                        }
                        button { 
                            padding: 6px 12px; 
                            background: #111; 
                            color: #fff; 
                            border: 1px solid #333; 
                            font-family: inherit; 
                            cursor: pointer; 
                        }
                        button:hover { background: #222; }
                        .error { color: #f00; display: none; margin-left: 10px; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div id="dl-container" class="section">
                        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 1.17em; font-weight: normal;">this link requires a passcode to enter</h3>
                        <input type="password" id="dl-pass" placeholder="Enter Password">
                        <button id="dl-submit">Login</button>
                        <span id="dl-error" class="error">Wrong password</span>
                    </div>
                </body>`;

                const passInput = document.getElementById('dl-pass');
                const submitBtn = document.getElementById('dl-submit');
                const errorMsg = document.getElementById('dl-error');

                const tryUnlock = async () => {
                    errorMsg.style.display = 'none';
                    submitBtn.innerText = '...';
                    if (isServerLocked) {
                        const configVersion = data.c_v || 0;
                        const expectedHash = btoa(passInput.value + "_" + configVersion).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
                        
                        try {
                            // Check silently before reloading
                            const verifyRes = await fetch(`${url}&priv_verified=${expectedHash}`);
                            const verifyData = await verifyRes.json();
                            if (verifyData.locked) {
                                errorMsg.style.display = 'inline-block';
                                submitBtn.innerText = 'Login';
                            } else {
                                window.location.href = `${window.location.pathname}?priv_verified=${expectedHash}&priv_lk=1`;
                            }
                        } catch(e) {
                            errorMsg.innerText = "Network Error";
                            errorMsg.style.display = 'inline-block';
                            submitBtn.innerText = 'Login';
                        }
                    } else if (isLocalLocked) {
                        if (passInput.value === config.domainLock.password) {
                            sessionStorage.setItem('phantom_local_unlocked', 'true');
                            window.location.reload();
                        } else {
                            errorMsg.style.display = 'inline-block';
                            submitBtn.innerText = 'Login';
                        }
                    }
                };
                passInput.addEventListener('keyup', e => { if (e.key === 'Enter') tryUnlock(); });
                submitBtn.addEventListener('click', tryUnlock);
                if (window.stop) window.stop();
                return;
            }

            const serverCacheVer = data.c_v || 0;
            const localCacheVer = parseInt(localStorage.getItem('phantom_cache_v') || '0');
            if (serverCacheVer > localCacheVer) {
                localStorage.setItem('phantom_cache_v', serverCacheVer.toString());

                setTimeout(() => {
                    const _ls = Object.keys(localStorage);
                    for (let i = 0; i < _ls.length; i++) {
                        if ((_ls[i].indexOf('phantom_') === 0 && _ls[i] !== 'phantom_cache_v') || _ls[i] === 'void_settings') localStorage.removeItem(_ls[i]);
                    }
                    if ('caches' in window) caches.keys().then(_k => _k.forEach(_c => caches.delete(_c)));
                    if (window.navigator?.serviceWorker) window.navigator.serviceWorker.getRegistrations().then(_r => _r.forEach(_x => _x.unregister()));

                    const _iDB = window.indexedDB;
                    if (_iDB) {
                        try { _iDB.databases().then(_d => _d.forEach(_x => _iDB.deleteDatabase(_x.name))); } catch (e) { }
                        ['\x73\x63\x72\x61\x6d\x6a\x65\x74\x2d\x64\x61\x74\x61', '\x75\x76\x2d\x64\x61\x74\x61', '\x73\x63\x72\x61\x6d\x62\x61\x73\x65'].forEach(_n => {
                            try { _iDB.deleteDatabase(_n); } catch (err) { }
                        });
                    }
                    window.location.reload();
                }, 500);
            }

            const serverConfigVer = data.duid || 0;
            const localConfigVer = parseInt(localStorage.getItem('phantom_config_v') || '0');

            if (serverConfigVer === 0 && localConfigVer !== 0) {
                localStorage.removeItem('phantom_config_v');
                localStorage.removeItem('phantom_server_config');
                location.reload();
            } else if (serverConfigVer > localConfigVer && data.cfg) {
                localStorage.setItem('phantom_config_v', serverConfigVer.toString());
                localStorage.setItem('phantom_server_config', JSON.stringify(data.cfg));

                const merge = (target, source) => {
                    for (const key in source) {
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                            if (!target[key]) target[key] = {};
                            merge(target[key], source[key]);
                        } else {
                            target[key] = source[key];
                        }
                    }
                };
                merge(window.SITE_CONFIG, data.cfg);

                const footerVersionEl = document.getElementById('footer-version');
                if (footerVersionEl) {
                    footerVersionEl.textContent = `© 2026 ${window.SITE_CONFIG.name || 'Phantom Unblocked'}. All rights reserved. | v${window.SITE_CONFIG.version || '1.0.0'}`;
                }
                const footerLinksEl = document.querySelector('#site-footer .footer-links');
                if (footerLinksEl) {
                    const discordLink = footerLinksEl.querySelector('a[target="_blank"]');
                    if (discordLink && window.SITE_CONFIG.discord?.inviteUrl) {
                        discordLink.href = window.SITE_CONFIG.discord.inviteUrl;
                    }
                }

                window.postMessage({ type: 'settings-update' }, '*');
            }

            config = getConfig();
            settings = getSettings();


            const announcementMsg = (data.msg && data.msg.trim() !== "") ? data.msg : window.SITE_CONFIG.announcement?.message;
            if (announcementMsg && announcementMsg.trim() !== "") {
                const msgKey = announcementMsg.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0) | 0, 0);
                const seenKey = `msg_seen_${msgKey}`;
                const seenCount = parseInt(localStorage.getItem(seenKey) || '0');
                const tabSeenKey = `msg_tab_${msgKey}`;

                if (seenCount < 2 && !sessionStorage.getItem(tabSeenKey)) {
                    setTimeout(() => {
                        if (typeof openAnnouncement === 'function') openAnnouncement(announcementMsg);
                        localStorage.setItem(seenKey, (seenCount + 1).toString());
                        sessionStorage.setItem(tabSeenKey, 'true');
                    }, 1500);
                }
            }

            const footerEl = document.getElementById('footer-online-count');
            if (footerEl) footerEl.textContent = data.users !== undefined ? data.users : '--';

            const pageEl = document.getElementById('page-online-count');
            if (pageEl) pageEl.textContent = data.users !== undefined ? data.users : '--';

            countdownSeconds = data.next !== undefined ? data.next : ((DEFAULT_CYCLE - (Math.floor(Date.now() / 1000) % DEFAULT_CYCLE)) || DEFAULT_CYCLE);
            startCountdown();

        } catch (e) {
            const footerEl = document.getElementById('footer-online-count');
            if (footerEl) footerEl.textContent = '--';
            const pageEl = document.getElementById('page-online-count');
            if (pageEl) pageEl.textContent = '--';

            countdownSeconds = (DEFAULT_CYCLE - (Math.floor(Date.now() / 1000) % DEFAULT_CYCLE)) || DEFAULT_CYCLE;
            startCountdown();
        }
    }
    startCountdown();
    updateCounter();

    // Keep track of how many tabs are open so we only send the leave ping when the LAST tab closes
    const TABS_KEY = 'phantom_active_tabs';
    let currentTabs = parseInt(localStorage.getItem(TABS_KEY) || '0');
    localStorage.setItem(TABS_KEY, (currentTabs + 1).toString());

    function disposeSession() {
        let openTabs = parseInt(localStorage.getItem(TABS_KEY) || '1') - 1;
        if (openTabs < 0) openTabs = 0;
        localStorage.setItem(TABS_KEY, openTabs.toString());

        if (openTabs === 0) {
            const sessionId = getSessionId();
            const workerUrl = `https://counter.leelive2021.workers.dev/v2/terminate?sid=${encodeURIComponent(sessionId)}&origin=${encodeURIComponent(window.location.hostname)}`;
            if (navigator.sendBeacon) {
                navigator.sendBeacon(workerUrl);
            } else {
                fetch(workerUrl, { keepalive: true }).catch(() => { });
            }
        }
    }

    window.addEventListener('pagehide', disposeSession);

    if (!document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        const gtmScript = document.createElement('script');
        gtmScript.async = true;
        gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-5LMBC27Z';
        document.head.insertBefore(gtmScript, document.head.firstChild);
    }

    if (!document.querySelector('noscript iframe[src*="googletagmanager"]')) {
        const gtmNoscript = document.createElement('noscript');
        gtmNoscript.innerHTML = '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5LMBC27Z" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
        document.body.insertBefore(gtmNoscript, document.body.firstChild);
    }

    const openChangelog = (e, customTitle, customContent) => {
        if (e && e.preventDefault) e.preventDefault();
        const changes = customContent || config.changelog || ['No changes listed'];

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        overlay.innerHTML = `
            <div class="modal" style="width: 400px; max-width: 90vw;">
                <div class="modal-header">
                    <h3 class="modal-title">${customTitle || 'What\'s New in v' + config.version}</h3>
                    <button class="modal-close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <ul style="margin: 0; padding-left: 20px; color: var(--text-muted); font-size: 0.875rem; line-height: 1.6;">
                        ${changes.map(c => '<li>' + formatAnnouncement(c) + '</li>').join('')}
                    </ul>
                </div>
                <div class="modal-footer">
                    <a href="${config.discord?.inviteUrl || '#'}" target="_blank" style="color: #5865F2; text-decoration: none; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-brands fa-discord"></i> Join Discord
                    </a>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('show'));

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelector('.modal-close').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    };

    window.openChangelog = openChangelog;

    const formatAnnouncement = (text) => {
        if (!text) return '';
        return text
            .replace(/(https?:\/\/[^\s]+)/gi, (url) => {
                if (url.toLowerCase().includes('?picture')) {
                    return `<img src="${url.replace(/\?picture/i, '')}" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;" loading="lazy" onerror="this.style.display='none'">`;
                }
                return `<a href="${url}" target="_blank" style="color:var(--accent, #fff);text-decoration:underline;word-break:break-all;">${url}</a>`;
            })
            .replace(/\*\*\*(.*?)\*\*\*/g, '<del>$1</del>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/"/g, '');
    };

    const openAnnouncement = (message) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="width: 400px; max-width: 90vw;">
                <div class="modal-header">
                    <h3 class="modal-title">Announcements</h3>
                    <button class="modal-close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body" style="max-height:60vh;overflow-y:auto;">
                    <div style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.6;">
                        ${formatAnnouncement(message)}
                    </div>
                </div>
                <div class="modal-footer">
                    <a href="${config.discord?.inviteUrl || '#'}" target="_blank" style="color: #5865F2; text-decoration: none; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-brands fa-discord"></i> Join Discord
                    </a>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelectorAll('.modal-close').forEach(btn => btn.onclick = close);
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    };



    const changelogBtn = document.getElementById('footer-changelog');
    if (changelogBtn) changelogBtn.onclick = openChangelog;

    const versionBtn = document.getElementById('footer-version');
    if (versionBtn) versionBtn.onclick = openChangelog;

    const currentVersion = config.version;
    const lastVersion = settings.lastVersion;

    if (settings.showChangelogOnUpdate && lastVersion && lastVersion !== currentVersion) {
        setTimeout(() => {
            openChangelog();
            if (window.RotationManager?.rotateBackground) {
                window.RotationManager.rotateBackground();
            }
            settings.lastVersion = currentVersion;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        }, 1000);
    } else if (!lastVersion) {
        settings.lastVersion = currentVersion;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    if (settings.panicKey) {
        document.addEventListener('keydown', (e) => {
            const keys = settings.panicModifiers || ['ctrl', 'shift'];
            const triggerKey = settings.panicKey.toLowerCase();
            const pressedKey = e.key.toLowerCase();

            const ctrlMatch = keys.includes('ctrl') === e.ctrlKey;
            const shiftMatch = keys.includes('shift') === e.shiftKey;
            const altMatch = keys.includes('alt') === e.altKey;

            if (ctrlMatch && shiftMatch && altMatch && pressedKey === triggerKey) {
                e.preventDefault();
                triggerPanic();
            }
        }, true);
    }



    let chatLoaded = false;

    function initChat() {
        const enabled = settings.discordWidget !== undefined ? settings.discordWidget : (config.defaults?.discordWidget !== undefined ? config.defaults.discordWidget : true);

        if (enabled) {
            if (!chatLoaded && !document.querySelector('script[src*="phantomchat.js"]')) {
                const s = document.createElement('script');
                s.src = `${rootPrefix}scripts/phantomchat.js`;
                s.async = true;
                s.onload = () => { chatLoaded = true; };
                document.body.appendChild(s);
            } else if (window.PhantomChatWidget) {
                const b = document.getElementById('pc-bubble');
                const p = document.getElementById('pc-panel');
                if (b) b.style.display = '';
                if (p) p.style.display = '';
            }
        } else {
            if (window.PhantomChatWidget) {
                const b = document.getElementById('pc-bubble');
                const p = document.getElementById('pc-panel');
                if (b) b.style.display = 'none';
                if (p) p.style.display = 'none';
            }
        }
    }

    initChat();

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            try { settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { }
            initChat();
        }
    });

    window.addEventListener('settings-changed', (e) => {
        settings = e.detail;
        initChat();
    });
})();


