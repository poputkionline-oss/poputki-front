/**
 * src/utils/countryNormalizer.js
 *
 * Single Canonical Citizenship Normalization Contract for POPUTKI.ONLINE
 * Shared across Web Booking, Telegram Mini App, Bus Admin, and Scanner Modal.
 */

export const CANONICAL_COUNTRIES = [
    'Таджикистан',
    'Россия',
    'Узбекистан',
    'Казахстан',
    'Кыргызстан',
    'Туркменистан',
    'Беларусь',
    'Украина',
    'Армения',
    'Грузия',
    'Другое'
];

/**
 * Synonym mapping for canonical countries
 */
const COUNTRY_SYNONYMS = {
    // Russia
    'RUS': 'Россия',
    'RU': 'Россия',
    'RUSSIA': 'Россия',
    'RUSSIAN FEDERATION': 'Россия',
    'RUSSIAN FEDERATION (THE)': 'Россия',
    'РОССИЯ': 'Россия',
    'РОССИЙСКАЯ ФЕДЕРАЦИЯ': 'Россия',
    'РФ': 'Россия',

    // Tajikistan
    'TJK': 'Таджикистан',
    'TJ': 'Таджикистан',
    'TAJIKISTAN': 'Таджикистан',
    'REPUBLIC OF TAJIKISTAN': 'Таджикистан',
    'ТАДЖИКИСТАН': 'Таджикистан',
    'ТОҶИКИСТОН': 'Таджикистан',
    'РТ': 'Таджикистан',

    // Uzbekistan
    'UZB': 'Узбекистан',
    'UZ': 'Узбекистан',
    'UZBEKISTAN': 'Узбекистан',
    'REPUBLIC OF UZBEKISTAN': 'Узбекистан',
    'УЗБЕКИСТАН': 'Узбекистан',
    'РРУ': 'Узбекистан',

    // Kazakhstan
    'KAZ': 'Казахстан',
    'KZ': 'Казахстан',
    'KAZAKHSTAN': 'Казахстан',
    'REPUBLIC OF KAZAKHSTAN': 'Казахстан',
    'КАЗАХСТАН': 'Казахстан',
    'РК': 'Казахстан',

    // Kyrgyzstan
    'KGZ': 'Кыргызстан',
    'KG': 'Кыргызстан',
    'KYRGYZSTAN': 'Кыргызстан',
    'KYRGYZ REPUBLIC': 'Кыргызстан',
    'КЫРГЫЗСТАН': 'Кыргызстан',
    'КИРГИЗИЯ': 'Кыргызстан',
    'КР': 'Кыргызстан',

    // Turkmenistan
    'TKM': 'Туркменистан',
    'TM': 'Туркменистан',
    'TURKMENISTAN': 'Туркменистан',
    'ТУРКМЕНИСТАН': 'Туркменистан',

    // Belarus
    'BLR': 'Беларусь',
    'BY': 'Беларусь',
    'BELARUS': 'Беларусь',
    'БЕЛАРУСЬ': 'Беларусь',
    'БЕЛОРУССИЯ': 'Беларусь',
    'РБ': 'Беларусь',

    // Ukraine
    'UKR': 'Украина',
    'UA': 'Украина',
    'UKRAINE': 'Украина',
    'УКРАИНА': 'Украина',

    // Armenia
    'ARM': 'Армения',
    'AM': 'Армения',
    'ARMENIA': 'Армения',
    'АРМЕНИЯ': 'Армения',

    // Georgia
    'GEO': 'Грузия',
    'GE': 'Грузия',
    'GEORGIA': 'Грузия',
    'ГРУЗИЯ': 'Грузия'
};

/**
 * Resolves any raw country string or ISO code into canonical booking form fields.
 *
 * @param {string|null|undefined} rawInput
 * @param {string|null|undefined} customInput
 * @returns {{ citizenship: string, customCitizenship: string }}
 */
export function normalizeCitizenship(rawInput, customInput = '') {
    if (!rawInput || typeof rawInput !== 'string') {
        return { citizenship: '', customCitizenship: '' };
    }

    const clean = rawInput.trim();
    if (!clean || clean === 'null' || clean === 'undefined') {
        return { citizenship: '', customCitizenship: '' };
    }

    // 1. Exact match in canonical list
    if (CANONICAL_COUNTRIES.includes(clean)) {
        if (clean === 'Другое') {
            return {
                citizenship: 'Другое',
                customCitizenship: (typeof customInput === 'string') ? customInput.trim() : ''
            };
        }
        return { citizenship: clean, customCitizenship: '' };
    }

    // 2. Match against synonym lookup
    const upper = clean.toUpperCase();
    if (COUNTRY_SYNONYMS[upper]) {
        return { citizenship: COUNTRY_SYNONYMS[upper], customCitizenship: '' };
    }

    // 3. Fallback: Unsupported genuine custom country
    return {
        citizenship: 'Другое',
        customCitizenship: clean
    };
}
