/**
 * whatsAppHandoff.js
 * 
 * Client-Side WhatsApp Click-to-Chat Handoff Utilities
 * Project: POPUTKI.ONLINE (Phase E.42)
 */

/**
 * Normalizes a raw phone string into WhatsApp-compatible international digits.
 * Removes whitespace, dashes, parentheses, dots, leading plus.
 * Converts Russian local leading 8 (11 digits) to international 7.
 * 
 * @param {string|null|undefined} rawPhone 
 * @returns {string|null} Normalized digits string (e.g. '992927925051') or null if invalid/absent
 */
export function normalizePhoneForWhatsApp(rawPhone) {
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

/**
 * Formats a role-aware WhatsApp ticket handoff message.
 * Strict official brand: POPUTKI.ONLINE (Latin characters).
 * 
 * @param {Object} params
 * @param {string} params.role - 'passenger' | 'family_or_group' | 'coordinator' | 'unknown'
 * @param {string} [params.name] - Passenger or contact name
 * @param {string} [params.fromCity] - Route origin city
 * @param {string} [params.toCity] - Route destination city
 * @param {string} [params.departureDate] - Departure date string
 * @param {string} [params.seats] - Assigned seat numbers
 * @param {string} params.ticketUrl - Canonical Ticket V1.1 URL (never Telegram claim URL)
 * @returns {string} Formatted plain-text message
 */
export function formatWhatsAppHandoffMessage({
    role = 'passenger',
    name = '',
    fromCity = '—',
    toCity = '—',
    departureDate = '—',
    seats = '—',
    ticketUrl = ''
}) {
    const cleanName = (name || '').trim();

    if (role === 'unknown') {
        return `Здравствуйте!

Для передачи вам подготовлен электронный билет POPUTKI.ONLINE.

🚌 Маршрут: ${fromCity} → ${toCity}
📅 Дата отправления: ${departureDate}
💺 Место: ${seats}

🎫 Посмотреть билет и подтвердить поездку:
${ticketUrl}

Передайте ссылку фактическому пассажиру, если билет предназначен не вам.

POPUTKI.ONLINE
ПОЕЗДКИ С ДОВЕРИЕМ`;
    }

    const greeting = cleanName ? `Здравствуйте, ${cleanName}!` : 'Здравствуйте!';

    let roleInstruction = '';
    if (role === 'family_or_group') {
        roleInstruction = `\n\nВы получили билет для члена семьи или группы.
Пожалуйста, передайте ссылку фактическому пассажиру.
Подтверждение поездки должен выполнить сам пассажир.`;
    } else if (role === 'coordinator') {
        roleInstruction = `\n\nВы получили билет для передачи пассажиру.
Пожалуйста, перешлите эту ссылку фактическому пассажиру.
Получение сообщения не делает вас владельцем бронирования.`;
    }

    return `${greeting}

Ваш электронный билет POPUTKI.ONLINE оформлен.

🚌 Маршрут: ${fromCity} → ${toCity}
📅 Дата отправления: ${departureDate}
💺 Место: ${seats}

🎫 Посмотреть билет и подтвердить поездку:
${ticketUrl}${roleInstruction}

POPUTKI.ONLINE
ПОЕЗДКИ С ДОВЕРИЕМ`;
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
    const normalizedPhone = normalizePhoneForWhatsApp(phone);
    if (!normalizedPhone) return null;

    const encodedMessage = encodeURIComponent(message || '');
    return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}
