import api from '../api';

const BRIDGE_MARKER = 'data-telegram-ticket-bridge';
const BOT_LABEL = '@Poputkionline_bot';

function extractBookingId(ticketWrapper) {
    if (!ticketWrapper) return null;
    const text = ticketWrapper.textContent || '';
    const match = text.match(/POP-(\d{1,12})/i);
    if (!match) return null;
    const id = Number.parseInt(match[1], 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function setButtonState(button, state, message = '') {
    button.disabled = state === 'loading';
    button.classList.toggle('opacity-70', state === 'loading');
    button.classList.toggle('cursor-wait', state === 'loading');

    if (state === 'loading') {
        button.textContent = '⏳ Открываю Telegram…';
    } else {
        button.textContent = '✈️ Открыть билет в Telegram';
    }

    const status = button.parentElement?.querySelector('[data-telegram-ticket-status]');
    if (status) {
        status.textContent = message;
        status.classList.toggle('hidden', !message);
    }
}

async function loadTicket(bookingId) {
    const response = await api.get(`/bus-admin/bookings/${bookingId}/ticket`);
    return response.data;
}

async function createClaimDeepLink(ticket) {
    if (!ticket?.bookingId || !ticket?.verificationToken) {
        throw new Error('В билете отсутствуют данные для безопасного открытия Telegram');
    }

    const response = await api.post('/claims/start-session', {
        bookingId: ticket.bookingId,
        ticketVerificationToken: ticket.verificationToken
    });

    const deepLink = response.data?.deepLink;
    if (!deepLink || typeof deepLink !== 'string' || !deepLink.startsWith('https://t.me/')) {
        throw new Error('Сервис не вернул безопасную ссылку Telegram');
    }

    return deepLink;
}

function shouldShowBridge(ticket) {
    if (!ticket) return false;
    if (ticket.status !== 'confirmed') return false;
    if (!ticket.isManual) return false;
    if (ticket.isClaimed || ticket.claimStatus === 'claimed') return false;
    return true;
}

function buildBridgeControl(ticket, wrapper) {
    const actionBar = wrapper.querySelector('.no-print');
    if (!actionBar || actionBar.hasAttribute(BRIDGE_MARKER)) return;

    const actions = actionBar.lastElementChild;
    if (!actions) return;

    actionBar.setAttribute(BRIDGE_MARKER, 'ready');

    const group = document.createElement('div');
    group.className = 'flex flex-col items-end gap-1';
    group.setAttribute('data-telegram-ticket-control', '');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm';
    button.textContent = '✈️ Открыть билет в Telegram';
    button.setAttribute('aria-label', `Открыть билет в Telegram через ${BOT_LABEL}`);

    const status = document.createElement('div');
    status.className = 'hidden max-w-[240px] text-[10px] leading-tight text-rose-200 text-right';
    status.setAttribute('data-telegram-ticket-status', '');

    button.addEventListener('click', async () => {
        setButtonState(button, 'loading');
        try {
            // Re-read the ticket immediately before creating the short-lived claim session.
            // This prevents stale UI from opening a cancelled/already-claimed booking.
            const freshTicket = await loadTicket(ticket.bookingId);
            if (!shouldShowBridge(freshTicket)) {
                if (freshTicket?.isClaimed || freshTicket?.claimStatus === 'claimed') {
                    throw new Error('Этот билет уже подтверждён в Telegram');
                }
                throw new Error('Telegram доступен только для активной ручной брони');
            }

            const deepLink = await createClaimDeepLink(freshTicket);
            // Use the same browsing context so mobile browsers reliably hand the t.me link to Telegram.
            window.location.assign(deepLink);
        } catch (error) {
            console.error('[TicketTelegramBridge] Failed to open Telegram:', error);
            const message = error?.response?.data?.error || error?.message || 'Не удалось открыть Telegram. Попробуйте ещё раз.';
            setButtonState(button, 'idle', message);
        }
    });

    group.appendChild(button);
    group.appendChild(status);
    actions.insertBefore(group, actions.firstChild);
}

async function enhanceTicketWrapper(wrapper) {
    if (!wrapper || wrapper.dataset.telegramBridgeLoading === '1') return;
    const actionBar = wrapper.querySelector('.no-print');
    if (!actionBar || actionBar.hasAttribute(BRIDGE_MARKER)) return;

    const bookingId = extractBookingId(wrapper);
    if (!bookingId) return;

    wrapper.dataset.telegramBridgeLoading = '1';
    try {
        const ticket = await loadTicket(bookingId);
        if (shouldShowBridge(ticket)) {
            buildBridgeControl(ticket, wrapper);
        } else {
            actionBar.setAttribute(BRIDGE_MARKER, 'not-applicable');
        }
    } catch (error) {
        // Do not break ticket rendering if the optional bridge cannot be initialized.
        console.warn('[TicketTelegramBridge] Initialization skipped:', error?.message || error);
    } finally {
        wrapper.dataset.telegramBridgeLoading = '0';
    }
}

function scanForTickets(root = document) {
    const wrappers = root.querySelectorAll?.('.ticket-wrapper.is-screen-mode') || [];
    wrappers.forEach(wrapper => enhanceTicketWrapper(wrapper));
}

export function initTicketTelegramBridge() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    scanForTickets(document);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches?.('.ticket-wrapper.is-screen-mode')) {
                    enhanceTicketWrapper(node);
                }
                scanForTickets(node);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
