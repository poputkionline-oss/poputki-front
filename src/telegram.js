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
 * Safely waits for SDK readiness, fetches initData, posts to /auth/telegram-miniapp,
 * and updates localStorage session token/user without logging sensitive initData.
 */
export async function ensureTelegramMiniAppAuth() {
    if (tgAuthPromise) return tgAuthPromise;

    tgAuthPromise = (async () => {
        let tg = getTelegramApp();
        if (!tg && typeof window !== 'undefined') {
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 50));
                tg = getTelegramApp();
                if (tg) break;
            }
        }

        if (!tg) return false;

        try {
            tg.ready();
        } catch (e) {}

        const initData = getTelegramInitData();
        if (!initData) {
            return false;
        }

        const user = JSON.parse(localStorage.getItem('user') || 'null');

        try {
            const apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';
            const response = await fetch(`${apiUrl}/auth/telegram-miniapp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-mana-man': 'nasa.2006'
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
