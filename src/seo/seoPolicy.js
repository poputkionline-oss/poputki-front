/**
 * SEO policy (pure, no DOM): maps a route to its metadata.
 *
 * Fail-safe: any route name that is not listed in ROUTE_SEO is treated as
 * private (noindex,nofollow). A new route is therefore never indexed by
 * accident; it has to be added to the INDEX list deliberately.
 */

export const SITE_ORIGIN = 'https://www.poputki.online';
export const SITE_NAME = 'POPUTKI.ONLINE';
export const DEFAULT_TITLE = 'POPUTKI.ONLINE — автобусные рейсы и совместные поездки';
export const DEFAULT_DESCRIPTION =
    'POPUTKI.ONLINE — поиск и бронирование автобусных рейсов и совместных поездок. Выбирайте маршрут, рейс и место онлайн.';
// Existing production asset (public/logo-itself.png). It is a logo, not a
// 1200x630 social-preview image — see report (limitations).
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/logo-itself.png`;

export const ROBOTS_INDEX = 'index,follow';
export const ROBOTS_NOINDEX_FOLLOW = 'noindex,follow';
export const ROBOTS_NOINDEX_NOFOLLOW = 'noindex,nofollow';

const PRIVATE = { robots: ROBOTS_NOINDEX_NOFOLLOW };
const FUNCTIONAL = { robots: ROBOTS_NOINDEX_FOLLOW };

// Static, PII-free titles. Never interpolate route params/query into these.
export const ROUTE_SEO = {
    // A. PUBLIC + INDEX
    landing: { robots: ROBOTS_INDEX, canonicalPath: '/', title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, jsonLd: true },
    terms: {
        robots: ROBOTS_INDEX,
        canonicalPath: '/terms',
        title: 'Условия использования — POPUTKI.ONLINE',
        description: 'Условия использования сервиса POPUTKI.ONLINE: правила поиска и бронирования автобусных рейсов и совместных поездок.'
    },

    // B. PUBLIC FUNCTIONAL + NOINDEX,FOLLOW
    search: { ...FUNCTIONAL, title: 'Поиск поездок — POPUTKI.ONLINE' },

    // C. PRIVATE / SENSITIVE + NOINDEX,NOFOLLOW
    'create-ride': { ...PRIVATE, title: 'Создать поездку — POPUTKI.ONLINE' },
    'preferences-edit': { ...PRIVATE, title: 'Настройки — POPUTKI.ONLINE' },
    bookings: { ...PRIVATE, title: 'Мои бронирования — POPUTKI.ONLINE' },
    'ride-details': { ...PRIVATE, title: 'Поездка — POPUTKI.ONLINE' },
    'ride-seats': { ...PRIVATE, title: 'Выбор места — POPUTKI.ONLINE' },
    'bus-admin': { ...PRIVATE, title: 'Кабинет перевозчика — POPUTKI.ONLINE' },
    profile: { ...PRIVATE, title: 'Профиль — POPUTKI.ONLINE' },
    auth: { ...PRIVATE, title: 'Вход — POPUTKI.ONLINE' },
    'my-rides': { ...PRIVATE, title: 'Мои поездки — POPUTKI.ONLINE' },
    vehicle: { ...PRIVATE, title: 'Автомобиль — POPUTKI.ONLINE' },
    'driver-reviews': { ...PRIVATE, title: 'Отзывы — POPUTKI.ONLINE' },
    'user-profile': { ...PRIVATE, title: 'Профиль пользователя — POPUTKI.ONLINE' },
    'bus-ticket-details': { ...PRIVATE, title: 'Автобусный рейс — POPUTKI.ONLINE' },
    'bus-booking': { ...PRIVATE, title: 'Бронирование билета — POPUTKI.ONLINE' },
    'my-bus-tickets': { ...PRIVATE, title: 'Мои билеты — POPUTKI.ONLINE' },
    'my-reviews': { ...PRIVATE, title: 'Мои отзывы — POPUTKI.ONLINE' },
    admin: { ...PRIVATE, title: 'Администрирование — POPUTKI.ONLINE' },
    'admin-passenger-funnel': { ...PRIVATE, title: 'Администрирование — POPUTKI.ONLINE' },
    'admin-sources-campaigns': { ...PRIVATE, title: 'Администрирование — POPUTKI.ONLINE' },
    'payment-result': { ...PRIVATE, title: 'Результат оплаты — POPUTKI.ONLINE' },
    'ticket-verification': { ...PRIVATE, title: 'Проверка билета — POPUTKI.ONLINE' },
    'ticket-verify-alias': { ...PRIVATE, title: 'Проверка билета — POPUTKI.ONLINE' },
    'claim-landing': { ...PRIVATE, title: 'Ваш билет — POPUTKI.ONLINE' },
    'ticket-subscribe': { ...PRIVATE, title: 'Уведомления о билете — POPUTKI.ONLINE' },
    'ticket-preview': { ...PRIVATE, title: 'Предпросмотр билета — POPUTKI.ONLINE' },
    'tracked-link-redirect': { ...PRIVATE, title: DEFAULT_TITLE },
    'referral-link-redirect': { ...PRIVATE, title: DEFAULT_TITLE },
    'not-found': { ...PRIVATE, title: 'Страница не найдена — POPUTKI.ONLINE' }
};

export function getRouteSeo(routeName) {
    return ROUTE_SEO[routeName] || { ...PRIVATE, title: DEFAULT_TITLE };
}

/**
 * Canonical URL. Only indexable routes have one, and it is always built from
 * a fixed path — never from the request URL — so query strings (utm_*, fbclid,
 * gclid, tgWebApp*, processedStartParam, …), hashes and route params (tokens)
 * can never leak into it. Noindex routes get no canonical at all.
 */
export function buildCanonical(seo) {
    return seo.canonicalPath ? `${SITE_ORIGIN}${seo.canonicalPath}` : null;
}

export function buildSeoState(routeName) {
    const seo = getRouteSeo(routeName);
    const canonical = buildCanonical(seo);
    const title = seo.title || DEFAULT_TITLE;
    const description = seo.description || DEFAULT_DESCRIPTION;
    return {
        title,
        description,
        robots: seo.robots,
        canonical,
        // og:url only for indexable pages; never expose private route URLs.
        ogUrl: canonical || `${SITE_ORIGIN}/`,
        ogType: 'website',
        ogImage: DEFAULT_OG_IMAGE,
        jsonLd: seo.jsonLd ? buildHomeJsonLd() : null
    };
}

export function buildHomeJsonLd() {
    return [
        {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: `${SITE_ORIGIN}/`,
            logo: DEFAULT_OG_IMAGE
        },
        {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: `${SITE_ORIGIN}/`,
            inLanguage: 'ru'
        }
    ];
}
