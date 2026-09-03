/**
 * Centralized Telegram Mini App SDK logic.
 * Follows the professional initialization flow with dynamic SDK resolution.
 */

export function getTelegramApp() {
    return window.Telegram?.WebApp || null;
}

export function initTelegram() {
    const tg = getTelegramApp();
    if (!tg) {
        return null;
    }

    try {
        tg.ready();
        tg.expand();
    } catch (e) {
        console.warn('Telegram.WebApp.ready error:', e);
    }

    return tg;
}

export function getTelegramUser() {
    const tg = getTelegramApp();
    return tg?.initDataUnsafe?.user || null;
}

export function getTelegramInitData() {
    const tg = getTelegramApp();
    return tg?.initData || '';
}

let tgAuthPromise = null;

/**
 * Ensures Telegram Mini App seamless authentication runs BEFORE router decisions.
 * Safely waits for SDK readiness, fetches initData (with polling and hash fallback),
 * posts to /auth/telegram-miniapp, and updates localStorage session token/user
 * without logging sensitive initData.
 */
export async function ensureTelegramMiniAppAuth() {
    if (tgAuthPromise) return tgAuthPromise;

    tgAuthPromise = (async () => {
        let tg = getTelegramApp();
        let initData = getTelegramInitData();
        let attempt = 1;

        // 1. Poll up to 500ms for Telegram.WebApp SDK readiness and initData population
        if (typeof window !== 'undefined') {
            for (let i = 0; i < 10; i++) {
                if (tg && initData) break;
                await new Promise(r => setTimeout(r, 50));
                attempt = i + 2;
                tg = getTelegramApp();
                initData = getTelegramInitData();
            }
        }

        // 2. Fallback: Parse tgWebAppData from location.hash if Telegram SDK hasn't attached initData yet
        if (!initData && typeof window !== 'undefined' && window.location?.hash) {
            try {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const rawTgData = hashParams.get('tgWebAppData');
                if (rawTgData) {
                    initData = rawTgData;
                }
            } catch (e) {}
        }

        let readyCalled = false;
        if (tg) {
            try {
                tg.ready();
                readyCalled = true;
            } catch (e) {}
        }

        // 3. Safe Diagnostic Instrumentation (NO PII, NO raw initData logged)
        if (typeof console !== 'undefined' && console.log) {
            console.log('[TelegramBootstrap]', {
                webAppPresent: Boolean(tg),
                initDataPresent: Boolean(initData),
                initDataLength: initData ? initData.length : 0,
                readyCalled,
                attempt,
                authRequestStarted: Boolean(initData)
            });
        }

        if (!initData) {
            return false;
        }

        const user = JSON.parse(localStorage.getItem('user') || 'null');

        try {
            const apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';
            const response = await fetch(`${apiUrl}/auth/telegram-miniapp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initData,
                    userId: user?.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) localStorage.setItem('token', data.token);
                if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
                return data.user || true;
            }
        } catch (err) {
            console.error('[Telegram MiniApp Auth] Failed:', err.message || err);
        }
        return false;
    })();

    const result = await tgAuthPromise;
    tgAuthPromise = null;
    return result;
}

export function openPhone(phoneNumber) {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';
    const redirectUrl = `${baseUrl}/call/${cleanPhone}`;
    window.location.href = redirectUrl;
}

export async function copyToClipboard(text) {
    if (!text) return false;
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    } catch (err) {
        console.error('Failed to copy text:', err);
        return false;
    }
}

export default {
    init: initTelegram,
    getApp: getTelegramApp,
    getUser: getTelegramUser,
    getInitData: getTelegramInitData,
    ensureAuth: ensureTelegramMiniAppAuth,
    openPhone: openPhone,
    copy: copyToClipboard
};
