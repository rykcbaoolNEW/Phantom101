// stealth mode
(function () {
    'use strict';

    let rotationInterval = null;
    let currentPresetIndex = 0;
    const original = { title: document.title, favicon: document.querySelector('link[rel="icon"]')?.href };

    const getPresets = () => [...(window.SITE_CONFIG?.cloakPresets || []), ...(window.Settings?.get('customCloaks') || [])];

    const setTitle = (title) => {
        if (!title) return;
        document.title = title;
        try { if (window.top !== window.self) window.top.document.title = title; } catch { }
    };

    const setFavicon = (href) => {
        if (!href) return;
        [document, window.top?.document].filter(d => { try { return d; } catch { return false; } }).forEach(doc => {
            doc.querySelectorAll('link[rel*="icon"]').forEach(l => l.remove());
            const link = doc.createElement('link');
            link.rel = 'icon';
            link.href = href;
            doc.head.appendChild(link);
        });
    };

    const apply = (p) => {
        if (p) {
            setTitle(p.title);
            setFavicon(p.icon || p.favicon);
        } else {
            const s = window.Settings?.getAll() || {};
            const presets = getPresets();
            const selectedPresetName = s.selectedCloakPreset;
            
            const preset = presets.find(pr => pr.name === selectedPresetName);
            if (preset) {
                setTitle(preset.title);
                setFavicon(preset.icon || preset.favicon);
            } else {
                setTitle(window.SITE_CONFIG?.fullName || 'Phantom Unblocked');
                setFavicon('/favicon.svg');
            }
        }
    };

    const startRotation = (ms) => {
        stopRotation();
        const presets = getPresets();
        if (presets.length < 2) return apply(presets[0]);
        rotationInterval = setInterval(() => {
            currentPresetIndex = (currentPresetIndex + 1) % presets.length;
            apply(presets[currentPresetIndex]);
        }, ms);
    };

    const stopRotation = () => { if (rotationInterval) { clearInterval(rotationInterval); rotationInterval = null; } };

    const redirectOriginal = () => {
        const targets = ["https://classroom.google.com", "https://drive.google.com", "https://google.com", "https://kahoot.it", "https://edpuzzle.com"];
        window.location.replace(targets[Math.floor(Math.random() * targets.length)]);
    };

    const getPopupContent = (url) => {
        const s = window.Settings?.getAll() || {};
        const presets = getPresets();
        const selectedPresetName = s.selectedCloakPreset;
        
        let title = 'Google';
        let icon = 'https://www.google.com/favicon.ico';
        
        const preset = presets.find(pr => pr.name === selectedPresetName);
        if (preset) {
            title = preset.title || title;
            icon = preset.icon || preset.favicon || icon;
        } else {
            title = window.SITE_CONFIG?.fullName || title;
        }
        const isUnblock = localStorage.getItem('phantom_unblock_all') === 'true';
        const unblockScript = isUnblock ? `<script>window.addEventListener('beforeunload',function(e){e.preventDefault();e.returnValue='';});</script>` : '';
        return `<!DOCTYPE html><html><head>${unblockScript}<title>${title}</title><link rel="icon" href="${icon}"><style>* {margin:0;padding:0;height:100%;overflow:hidden;} iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${url}"></iframe></body></html>`;
    };

    const tryPopup = (url) => {
        return new Promise((resolve) => {
            const s = window.Settings?.getAll() || {};
            const mode = s.cloakMode || 'about:blank';
            let win;
            let blobUrl = null;

            if (mode === 'blob') {
                const content = getPopupContent(url);
                const blob = new Blob([content], { type: 'text/html' });
                blobUrl = URL.createObjectURL(blob);
                win = window.open(blobUrl, '_blank');
            } else {
                win = window.open('about:blank', '_blank');
            }

            if (!win) {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                resolve({ success: false, reason: 'blocked' });
                return;
            }

            if (mode !== 'blob') {
                try {
                    win.document.write(getPopupContent(url));
                    win.document.close();
                } catch (e) {
                    try { win.close(); } catch { }
                    resolve({ success: false, reason: 'killed' });
                    return;
                }
            }

            const timeoutMs = 200;

            setTimeout(() => {
                if (win.closed) {
                    if (blobUrl) URL.revokeObjectURL(blobUrl);
                    resolve({ success: false, reason: 'killed' });
                } else {
                    resolve({ success: true });
                    redirectOriginal(); 
                    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                }
            }, timeoutMs);
        });
    };

    const loadInTab = () => {
        const iframe = document.getElementById('main-frame');
        if (iframe && !iframe.src) iframe.src = 'index2.html';
        if (window.hideLoading) window.hideLoading();
        apply();
    };

    const showLaunchScreen = (onLaunch) => {
        const ls = document.getElementById('launch-screen');
        if (ls) {
            ls.classList.remove('hidden');
            if (window.hideLoading) window.hideLoading();
            document.getElementById('launch-button').onclick = onLaunch;
        }
    };

    let isLaunching = false;

    const attemptCloakedLaunch = async (url, hideOverlay = null) => {
        if (isLaunching) return false;
        
        const fvKey = 'phantom_fv';
        if (window.SITE_CONFIG?.firstVisitCloak && !localStorage.getItem(fvKey) && !hideOverlay) return false;

        isLaunching = true;
        const result = await tryPopup(url);

        if (result.success) {
            return true;
        }

        if (result.reason === 'blocked') {
            isLaunching = false;
            if (hideOverlay) hideOverlay();
            if (window.Notify) {
                window.Notify.info('Popups Blocked', 'Please enable popups for this site to use cloaking.');
            }

            showLaunchScreen(async () => {
                document.getElementById('launch-screen').classList.add('hidden');
                const retryResult = await tryPopup(url);
                if (!retryResult.success) {
                    loadInTab();
                }
            });
            return true; 
        }

        if (hideOverlay) hideOverlay();
        isLaunching = false;
        loadInTab();
        return false;
    };

    const init = async () => {
        const s = window.Settings?.getAll() || {};
        const fvKey = 'phantom_fv';
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('fake')) {
            showLaunchScreen(async () => {
                document.getElementById('launch-screen').classList.add('hidden');
                if (s.cloakMode === 'about:blank' || s.cloakMode === 'blob') {
                    const result = await tryPopup(window.location.href.split('?')[0]);
                    if (result.success) return; 
                }
                loadInTab();
            });
            return;
        }

        if (window.SITE_CONFIG?.firstVisitCloak && !localStorage.getItem(fvKey)) {
            const overlay = document.getElementById('fv-cloak');
            if (overlay) {
                overlay.style.display = 'block';
                document.title = window.location.hostname;
                document.querySelectorAll("link[rel*='icon']").forEach(l => l.remove());
                const link = document.createElement('link');
                link.rel = 'icon';
                link.href = 'data:,';
                document.head.appendChild(link);

                const onKey = async (e) => {
                    const bypassKey = (window.SITE_CONFIG.firstVisitCloakKey || 'c').toLowerCase();
                    if (e.key.toLowerCase() === bypassKey) {
                        localStorage.setItem(fvKey, '1');
                        document.removeEventListener('keydown', onKey);

                        if (s.cloakMode === 'about:blank' || s.cloakMode === 'blob') {
                            await attemptCloakedLaunch(window.location.href, () => {
                                overlay.style.display = 'none';
                            });
                        } else {
                            overlay.style.display = 'none';
                            apply();
                            loadInTab();
                        }
                    }
                };
                document.addEventListener('keydown', onKey);
            }
            return;
        }

        if (window.top === window.self && (s.cloakMode === 'about:blank' || s.cloakMode === 'blob')) {
            await attemptCloakedLaunch(window.location.href);
            return;
        }

        loadInTab();
        if (s.rotateCloaks) startRotation((s.rotateInterval || 5) * 1000);
    };

    window.Cloaking = { init, apply, startRotation, stopRotation, tryPopup, loadInTab };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('settings-changed', async (e) => {
        apply();
        const s = e.detail;
        if (s.rotateCloaks) startRotation((s.rotateInterval || 5) * 1000);
        else stopRotation();

        const fvKey = 'phantom_fv';
        const isBypassed = !window.SITE_CONFIG?.firstVisitCloak || localStorage.getItem(fvKey);

        if (!isLaunching && isBypassed && window.top === window.self && (s.cloakMode === 'about:blank' || s.cloakMode === 'blob')) {
            await attemptCloakedLaunch(window.location.href);
        }
    });
})();
