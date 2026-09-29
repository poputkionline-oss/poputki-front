/**
 * src/utils/passportAdapter.js
 * 
 * Centralized Adapter & Normalizer for Passport Scanner -> Booking Form State
 * Enforces canonical document type options, canonical citizenship mapping,
 * and strict state preservation (seat, trip, index, etc.).
 */

import { normalizeCitizenship } from './countryNormalizer.js';

export const CANONICAL_DOC_TYPES = [
    'Загранпаспорт',
    'Внутренний паспорт',
    'ID-карта',
    'Свидетельство о рождении',
    'Вид на жительство'
];

/**
 * Normalizes document type strings into canonical booking dropdown option values.
 * @param {string|null|undefined} rawType
 * @returns {string} Canonical document type string ('Загранпаспорт', 'ID-карта', etc.)
 */
export function normalizeBookingDocumentType(rawType) {
    if (!rawType || typeof rawType !== 'string') return 'Загранпаспорт';

    const clean = rawType.trim().toLowerCase();
    if (!clean) return 'Загранпаспорт';

    if (clean.includes('residence') || clean.includes('permit') || clean.includes('вид на жительство')) {
        return 'Вид на жительство';
    }

    if (clean.includes('внутренний') || clean.includes('internal')) {
        return 'Внутренний паспорт';
    }

    if (clean === 'id_card' || clean === 'id' || clean.includes('id_card') || clean.includes('identity') || clean.includes('id-карта') || clean.includes('id карта') || clean.includes('удостоверение')) {
        return 'ID-карта';
    }

    if (clean.includes('свидетельство') || clean.includes('birth')) {
        return 'Свидетельство о рождении';
    }

    if (clean.includes('passport') || clean.includes('паспорт') || clean.includes('загран')) {
        return 'Загранпаспорт';
    }

    return 'Загранпаспорт';
}

/**
 * Single boundary mapping between PassportScannerModal confirmation payload and Passenger Form model.
 * Merges scanned identity fields into existing passenger while strictly preserving seat, seatNumber, index, etc.
 *
 * @param {Object} scanData Data emitted by PassportScannerModal or OCR endpoint
 * @param {Object} existingPassenger Existing passenger state in booking form
 * @returns {Object} Updated passenger object with canonical fields
 */
export function mapPassportScanToPassenger(scanData = {}, existingPassenger = {}) {
    const updated = { ...existingPassenger };

    if (scanData.lastName) updated.lastName = scanData.lastName.trim();
    if (scanData.firstName) updated.firstName = scanData.firstName.trim();
    if (scanData.middleName !== undefined) updated.middleName = scanData.middleName ? scanData.middleName.trim() : '';
    if (scanData.birthDate) updated.birthDate = scanData.birthDate;
    if (scanData.gender) updated.gender = scanData.gender;
    if (scanData.docNumber) updated.docNumber = scanData.docNumber.trim();

    // Document Type Normalization
    const rawDocType = scanData.docType || existingPassenger.docType;
    updated.docType = normalizeBookingDocumentType(rawDocType);

    // Citizenship Normalization
    if (scanData.citizenship !== undefined && scanData.citizenship !== null && scanData.citizenship !== '') {
        const norm = normalizeCitizenship(scanData.citizenship, scanData.customCitizenship);
        updated.citizenship = norm.citizenship;
        updated.customCitizenship = norm.customCitizenship;
    } else {
        // If scanResult is empty / unresolved, do NOT fallback to Tajikistan
        // Clear any old initial default 'Таджикистан' if scanner explicitly confirmed data without citizenship
        if (scanData.lastName || scanData.firstName || scanData.docNumber) {
            updated.citizenship = '';
            updated.customCitizenship = '';
        }
    }

    updated.isExpanded = true;
    return updated;
}
