/**
 * tests/country_normalizer.test.js
 *
 * Unit test suite for POPUTKI.ONLINE Canonical Citizenship Normalizer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCitizenship, CANONICAL_COUNTRIES } from '../src/utils/countryNormalizer.js';

describe('Canonical Citizenship Normalizer', () => {

    it('normalizes Russian Federation synonyms to "Россия"', () => {
        assert.deepEqual(normalizeCitizenship('RUS'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('RU'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('RUSSIA'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('RUSSIAN FEDERATION'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('RUSSIAN FEDERATION (THE)'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Российская Федерация'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Россия'), { citizenship: 'Россия', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('РФ'), { citizenship: 'Россия', customCitizenship: '' });
    });

    it('normalizes Tajikistan synonyms to "Таджикистан"', () => {
        assert.deepEqual(normalizeCitizenship('TJK'), { citizenship: 'Таджикистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('TJ'), { citizenship: 'Таджикистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('TAJIKISTAN'), { citizenship: 'Таджикистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('REPUBLIC OF TAJIKISTAN'), { citizenship: 'Таджикистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Таджикистан'), { citizenship: 'Таджикистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Тоҷикистон'), { citizenship: 'Таджикистан', customCitizenship: '' });
    });

    it('normalizes Uzbekistan synonyms to "Узбекистан"', () => {
        assert.deepEqual(normalizeCitizenship('UZB'), { citizenship: 'Узбекистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('UZ'), { citizenship: 'Узбекистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('UZBEKISTAN'), { citizenship: 'Узбекистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('REPUBLIC OF UZBEKISTAN'), { citizenship: 'Узбекистан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Узбекистан'), { citizenship: 'Узбекистан', customCitizenship: '' });
    });

    it('normalizes Kazakhstan synonyms to "Казахстан"', () => {
        assert.deepEqual(normalizeCitizenship('KAZ'), { citizenship: 'Казахстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('KZ'), { citizenship: 'Казахстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('KAZAKHSTAN'), { citizenship: 'Казахстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('REPUBLIC OF KAZAKHSTAN'), { citizenship: 'Казахстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Казахстан'), { citizenship: 'Казахстан', customCitizenship: '' });
    });

    it('normalizes Kyrgyzstan synonyms to "Кыргызстан"', () => {
        assert.deepEqual(normalizeCitizenship('KGZ'), { citizenship: 'Кыргызстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('KG'), { citizenship: 'Кыргызстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('KYRGYZSTAN'), { citizenship: 'Кыргызстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('KYRGYZ REPUBLIC'), { citizenship: 'Кыргызстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Кыргызстан'), { citizenship: 'Кыргызстан', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship('Киргизия'), { citizenship: 'Кыргызстан', customCitizenship: '' });
    });

    it('maps genuinely unsupported country to "Другое" + customCitizenship', () => {
        assert.deepEqual(normalizeCitizenship('Germany'), { citizenship: 'Другое', customCitizenship: 'Germany' });
        assert.deepEqual(normalizeCitizenship('Turkey'), { citizenship: 'Другое', customCitizenship: 'Turkey' });
        assert.deepEqual(normalizeCitizenship('USA'), { citizenship: 'Другое', customCitizenship: 'USA' });
    });

    it('returns empty citizenship for unresolved / null values (NOT "Другое", NOT "Таджикистан")', () => {
        assert.deepEqual(normalizeCitizenship(null), { citizenship: '', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship(''), { citizenship: '', customCitizenship: '' });
        assert.deepEqual(normalizeCitizenship(undefined), { citizenship: '', customCitizenship: '' });
    });

    it('verifies CANONICAL_COUNTRIES enum list contains expected entries', () => {
        assert.ok(CANONICAL_COUNTRIES.includes('Таджикистан'));
        assert.ok(CANONICAL_COUNTRIES.includes('Россия'));
        assert.ok(CANONICAL_COUNTRIES.includes('Узбекистан'));
        assert.ok(CANONICAL_COUNTRIES.includes('Казахстан'));
        assert.ok(CANONICAL_COUNTRIES.includes('Кыргызстан'));
        assert.ok(CANONICAL_COUNTRIES.includes('Другое'));
    });
});
