/**
 * whatsAppHandoff.js
 * 
 * Transport Handoff Utilities (WhatsApp & SMS)
 * Project: POPUTKI.ONLINE (Phase E.43.1)
 */

/**
 * Normalizes a raw phone string into international digits.
 * Removes whitespace, dashes, parentheses, dots, leading plus.
 * Converts Russian local leading 8 (11 digits) to international 7.
 * 
 * @param {string|null|undefined} rawPhone 
 * @returns {string|null} Normalized digits string (e.g. '992927925051') or null if invalid/absent
 */
export function normalizePhoneForHandoff(rawPhone) {
    if (!rawPhone) return null;
    let s = String(rawPhone).trim();

    // Reject common placeholder strings
    if (s === '' || s === '-' || s === '—' || s === '–' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
        return null;
    }

    // Strip common punctuation & whitespace
    s = s.replace(/[\s\(\)\-\.]/g, '');
    if (!s) return null;

    // Strip leading '+'
    if (s.startsWith('+')) {
        s = s.substring(1);
    }

    // Must be purely digits
    if (!/^\d+$/.test(s)) {
        return null;
    }

    // Standardize leading 8 for 11-digit numbers (RU/KZ convention)
    if (s.startsWith('8') && s.length === 11) {
        s = '7' + s.substring(1);
    }

    // International length check (9 to 15 digits)
    if (s.length < 9 || s.length > 15) {
        return null;
    }

    return s;
}

// Backward-compatible alias for existing imports/tests
export const normalizePhoneForWhatsApp = normalizePhoneForHandoff;

/**
 * Shared message builder for WhatsApp and SMS handoff channels.
 * Strictly no decorative non-BMP emojis in transport messages to prevent encoding/replacement corruption.
 * Official brand: POPUTKI.ONLINE (Latin characters).
 * 
 * @param {Object} params
 * @param {'whatsapp'|'sms'} [params.channel='whatsapp'] - Transport channel
 * @param {string} [params.contactRole] - 'passenger' | 'family_or_group' | 'coordinator' | 'unknown'
 * @param {string} [params.role] - Alias for contactRole
 * @param {string} [params.name] - Passenger or contact name
 * @param {string} [params.fromCity] - Route origin city
 * @param {string} [params.toCity] - Route destination city
 * @param {string} [params.departureDate] - Departure date string
 * @param {string} [params.seats] - Assigned seat numbers
 * @param {string} params.ticketUrl - Canonical Ticket V1.1 URL (never Telegram claim URL)
 * @returns {string} Formatted plain-text transport message
 */
export function buildHandoffMessage({
    channel = 'whatsapp',
    contactRole,
    role = 'passenger',
    name = '',
    fromCity = '—',
    toCity = '—',
    departureDate = '—',
    seats = '—',
    ticketUrl = ''
}) {
    const effectiveRole = contactRole || role || 'passenger';
    const cleanName = (name || '').trim();

    // ----------------- SMS Channel (Compact plain-text) -----------------
    if (channel === 'sms') {
        if (effectiveRole === 'family_or_group') {
            return `Ваш билет POPUTKI.ONLINE готов.
${fromCity} - ${toCity}, ${departureDate}, место: ${seats}.
Передайте ссылку фактическому пассажиру:
${ticketUrl}`;
        }

        if (effectiveRole === 'coordinator') {
            return `Билет POPUTKI.ONLINE для передачи пассажиру.
${fromCity} - ${toCity}, ${departureDate}, место: ${seats}.
Передайте пассажиру:
${ticketUrl}`;
        }

        if (effectiveRole === 'unknown') {
            return `Электронный билет POPUTKI.ONLINE.
${fromCity} - ${toCity}, ${departureDate}, место: ${seats}.
Если билет предназначен не вам, передайте ссылку пассажиру:
${ticketUrl}`;
        }

        // Default passenger role
        return `Ваш билет POPUTKI.ONLINE готов.
${fromCity} - ${toCity}, ${departureDate}, место: ${seats}.
Билет и подтверждение:
${ticketUrl}`;
    }

    // ----------------- WhatsApp Channel (Hardened plain-text) -----------------
    if (effectiveRole === 'unknown') {
        return `Здравствуйте!

Для передачи вам подготовлен электронный билет POPUTKI.ONLINE.

Маршрут: ${fromCity} - ${toCity}
Дата отправления: ${departureDate}
Место: ${seats}

Посмотреть билет и подтвердить поездку:
${ticketUrl}

Передайте ссылку фактическому пассажиру, если билет предназначен не вам.

POPUTKI.ONLINE
ПОЕЗДКИ С ДОВЕРИЕМ`;
    }

    const greeting = cleanName ? `Здравствуйте, ${cleanName}!` : 'Здравствуйте!';

    let roleInstruction = '';
    if (effectiveRole === 'family_or_group') {
        roleInstruction = `\n\nВы получили билет для члена семьи или группы.
Пожалуйста, передайте ссылку фактическому пассажиру.
Подтверждение поездки должен выполнить сам пассажир.`;
    } else if (effectiveRole === 'coordinator') {
        roleInstruction = `\n\nВы получили билет для передачи пассажиру.
Пожалуйста, перешлите эту ссылку фактическому пассажиру.
Получение сообщения не делает вас владельцем бронирования.`;
    }

    return `${greeting}

Ваш электронный билет POPUTKI.ONLINE оформлен.

Маршрут: ${fromCity} - ${toCity}
Дата отправления: ${departureDate}
Место: ${seats}

Посмотреть билет и подтвердить поездку:
${ticketUrl}${roleInstruction}

POPUTKI.ONLINE
ПОЕЗДКИ С ДОВЕРИЕМ`;
}

/**
 * Convenience wrapper for WhatsApp message formatting.
 */
export function formatWhatsAppHandoffMessage(params) {
    return buildHandoffMessage({ ...params, channel: 'whatsapp' });
}

/**
 * Convenience wrapper for SMS message formatting.
 */
export function formatSmsHandoffMessage(params) {
    return buildHandoffMessage({ ...params, channel: 'sms' });
}

/**
 * Builds a standard WhatsApp click-to-chat URL.
 * 
 * @param {Object} params
 * @param {string} params.phone - Contact phone
 * @param {string} params.message - Prefilled text message
 * @returns {string|null} Full https://wa.me/ URL or null if phone invalid
 */
export function buildWhatsAppHandoffUrl({ phone, message }) {
    const normalizedPhone = normalizePhoneForHandoff(phone);
    if (!normalizedPhone) return null;

    const encodedMessage = encodeURIComponent(message || '');
    return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

/**
 * Builds a standard cross-platform SMS deep link URL.
 * Supports Android Chrome, Samsung Internet, iPhone Safari (iOS 8+).
 * 
 * @param {Object} params
 * @param {string} params.phone - Contact phone
 * @param {string} params.message - Prefilled text message
 * @returns {string|null} Full sms: URI or null if phone invalid
 */
export function buildSmsHandoffUrl({ phone, message }) {
    const normalizedPhone = normalizePhoneForHandoff(phone);
    if (!normalizedPhone) return null;

    const encodedMessage = encodeURIComponent(message || '');
    return `sms:+${normalizedPhone}?body=${encodedMessage}`;
}

/**
 * Builds a Telegram share URL for carrier handoff.
 * Strictly uses Telegram Share URL to prevent launching bot directly as carrier:
 * https://t.me/share/url?url=<encodedTicketUrl>&text=<encodedMessage>
 * 
 * @param {Object} params
 * @param {string} params.ticketUrl - Canonical Ticket URL with handoffId
 * @param {string} [params.message] - Accompanying message text
 * @returns {string|null} Full Telegram share URL or null if ticketUrl missing
 */
export function buildTelegramShareUrl({ ticketUrl, message }) {
    if (!ticketUrl) return null;
    const encodedUrl = encodeURIComponent(ticketUrl);
    const encodedText = encodeURIComponent(message || '');
    return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
}

