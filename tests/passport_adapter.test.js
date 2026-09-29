/**
 * tests/passport_adapter.test.js
 *
 * Unit & Regression Tests for Passport Scanner -> Booking Form State Adapter
 * Tests document type normalization, Russian passport over Tajik default,
 * country regression matrix, unresolved citizenship handling, and seat state preservation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeBookingDocumentType,
    mapPassportScanToPassenger,
    CANONICAL_DOC_TYPES
} from '../src/utils/passportAdapter.js';
import { normalizeCitizenship } from '../src/utils/countryNormalizer.js';

describe('Passport Scanner -> Booking State Adapter Unit & Regression Tests', () => {

    // 1. Canonical Document Type List Verification
    it('[ADAPTER-01] verifies CANONICAL_DOC_TYPES list contains expected option values', () => {
        assert.deepEqual(CANONICAL_DOC_TYPES, [
            'Загранпаспорт',
            'Внутренний паспорт',
            'ID-карта',
            'Свидетельство о рождении',
            'Вид на жительство'
        ]);
    });

    // 2. Document Type Normalization
    it('[ADAPTER-02] normalizes raw document types into canonical dropdown option values', () => {
        assert.equal(normalizeBookingDocumentType('passport'), 'Загранпаспорт');
        assert.equal(normalizeBookingDocumentType('international_passport'), 'Загранпаспорт');
        assert.equal(normalizeBookingDocumentType('foreign_passport'), 'Загранпаспорт');
        assert.equal(normalizeBookingDocumentType('Загран паспорт'), 'Загранпаспорт'); // Fixes space issue!
        assert.equal(normalizeBookingDocumentType('Загранпаспорт'), 'Загранпаспорт');

        assert.equal(normalizeBookingDocumentType('id_card'), 'ID-карта');
        assert.equal(normalizeBookingDocumentType('identity_card'), 'ID-карта');
        assert.equal(normalizeBookingDocumentType('ID-карта'), 'ID-карта');

        assert.equal(normalizeBookingDocumentType('internal_passport'), 'Внутренний паспорт');
        assert.equal(normalizeBookingDocumentType('Внутренний паспорт'), 'Внутренний паспорт');

        assert.equal(normalizeBookingDocumentType('birth_certificate'), 'Свидетельство о рождении');
        assert.equal(normalizeBookingDocumentType('Свидетельство о рождении'), 'Свидетельство о рождении');

        assert.equal(normalizeBookingDocumentType('residence_permit'), 'Вид на жительство');
        assert.equal(normalizeBookingDocumentType('Вид на жительство'), 'Вид на жительство');
    });

    // 3. CRITICAL REGRESSION TEST: Russian Passport over initial Tajik default
    it('[ADAPTER-03] overwrites initial Tajik citizenship default with scanner Россия and preserves seat', () => {
        const initialPassenger = {
            index: 1,
            seat: 8,
            seatNumber: 8,
            lastName: '',
            firstName: '',
            citizenship: 'Таджикистан', // Initial default
            customCitizenship: '',
            docType: 'Загранпаспорт',
            docNumber: ''
        };

        const scanResult = {
            lastName: 'ИВАНОВ',
            firstName: 'ИВАН',
            docNumber: '751234567',
            docType: 'passport',
            citizenship: 'Россия',
            customCitizenship: ''
        };

        const updated = mapPassportScanToPassenger(scanResult, initialPassenger);

        assert.equal(updated.citizenship, 'Россия', 'Scanner citizenship Россия MUST override initial Таджикистан default');
        assert.notEqual(updated.citizenship, 'Таджикистан');
        assert.equal(updated.customCitizenship, '');
        assert.equal(updated.docType, 'Загранпаспорт', 'Document type MUST be canonical Загранпаспорт');
        assert.equal(updated.seat, 8, 'Seat selection MUST be strictly preserved');
        assert.equal(updated.lastName, 'ИВАНОВ');
        assert.equal(updated.firstName, 'ИВАН');
        assert.equal(updated.docNumber, '751234567');
    });

    // 4. Country Regression Matrix
    it('[ADAPTER-04] evaluates country regression matrix cleanly (TJK, UZB, KAZ, KGZ, RUS)', () => {
        const base = { seat: 3, citizenship: 'Таджикистан' };

        assert.equal(mapPassportScanToPassenger({ citizenship: 'TJK' }, base).citizenship, 'Таджикистан');
        assert.equal(mapPassportScanToPassenger({ citizenship: 'Россия' }, base).citizenship, 'Россия');
        assert.equal(mapPassportScanToPassenger({ citizenship: 'RUSSIAN FEDERATION' }, base).citizenship, 'Россия');
        assert.equal(mapPassportScanToPassenger({ citizenship: 'Узбекистан' }, base).citizenship, 'Узбекистан');
        assert.equal(mapPassportScanToPassenger({ citizenship: 'Казахстан' }, base).citizenship, 'Казахстан');
        assert.equal(mapPassportScanToPassenger({ citizenship: 'Кыргызстан' }, base).citizenship, 'Кыргызстан');
    });

    // 5. Unresolved Citizenship Handling
    it('[ADAPTER-05] leaves unresolved scanner citizenship as empty string, requiring manual selection', () => {
        const initialPassenger = { seat: 5, citizenship: 'Таджикистан' };
        const scanResult = {
            lastName: 'UNKNOWN',
            firstName: 'PASSENGER',
            docNumber: '123456',
            citizenship: '', // Unresolved by scanner
            customCitizenship: ''
        };

        const updated = mapPassportScanToPassenger(scanResult, initialPassenger);
        assert.equal(updated.citizenship, '', 'Unresolved scanner citizenship MUST produce empty string');
        assert.equal(updated.customCitizenship, '');
    });

    // 6. Custom Unsupported Country
    it('[ADAPTER-06] maps unsupported country string (e.g. Germany) to Другое + customCitizenship', () => {
        const initialPassenger = { seat: 2 };
        const scanResult = {
            citizenship: 'Germany'
        };

        const updated = mapPassportScanToPassenger(scanResult, initialPassenger);
        assert.equal(updated.citizenship, 'Другое');
        assert.equal(updated.customCitizenship, 'Germany');
    });

    // 7. State & Seat Preservation
    it('[ADAPTER-07] preserves booking state, seat, index, and trip properties during scan mapping', () => {
        const initialPassenger = {
            index: 2,
            seat: '14B',
            tripId: 'TRIP-123',
            price: 500,
            lastName: 'OLD',
            firstName: 'NAME',
            citizenship: 'Таджикистан',
            docType: 'Загранпаспорт'
        };

        const scanResult = {
            lastName: 'NEW',
            firstName: 'NAME',
            docNumber: '999888',
            citizenship: 'Россия',
            docType: 'id_card'
        };

        const updated = mapPassportScanToPassenger(scanResult, initialPassenger);
        assert.equal(updated.index, 2);
        assert.equal(updated.seat, '14B');
        assert.equal(updated.tripId, 'TRIP-123');
        assert.equal(updated.price, 500);
        assert.equal(updated.lastName, 'NEW');
        assert.equal(updated.citizenship, 'Россия');
        assert.equal(updated.docType, 'ID-карта');
    });
});
