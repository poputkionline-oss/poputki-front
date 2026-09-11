/**
 * phase_claim_landing_seat_display_hotfix.test.js
 * POPUTKI.ONLINE — /t/:token claim landing "Мест: 1" display hotfix.
 *
 * Root cause (owner-confirmed live audit): the page rendered the
 * passenger_count column (a frozen seat_numbers.length taken at booking
 * time) instead of the actual seat numbers, and silently showed "Мест: 1"
 * even for an empty/corrupt seat_numbers array via `trip.passengerCount || 1`.
 *
 * This suite extracts the real `seatsLabel` computed function straight out
 * of the .vue source (no compiler/mount harness in this repo — see
 * phase_oson_sms_claim_landing_security.test.js for the same static-analysis
 * approach) and executes it against every shape trip.seatNumbers can take,
 * so the assertions exercise the actual shipped logic, not a re-implementation
 * of it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const view = readFileSync(resolve('src/views/ClaimLandingView.vue'), 'utf-8');

// Pull the seatsLabel() computed function body out of the component source
// and turn it into a standalone callable bound to a fake `this`, so the test
// runs the exact code that ships, not a copy of it.
function extractSeatsLabel() {
    const match = view.match(/seatsLabel\s*\(\)\s*\{([\s\S]*?)\n\s{8}\}/);
    assert.ok(match, 'seatsLabel() computed not found in ClaimLandingView.vue');
    const body = match[1];
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return function seatsLabel() {${body}}`)();
    return (trip) => fn.call({ trip });
}

describe('CLAIM LANDING SEAT DISPLAY HOTFIX — template no longer shows passengerCount', () => {
    it('1. the old buggy pattern (trip.passengerCount || 1) is gone from the template', () => {
        assert.ok(!view.includes('trip.passengerCount || 1'));
    });

    it('2. the hardcoded "Мест:" label is gone', () => {
        assert.ok(!/Мест:\s*\{\{/.test(view));
    });

    it('3. the seats line is now driven by the seatsLabel computed, gated with v-if', () => {
        assert.match(view, /v-if="seatsLabel"[^>]*>\s*\{\{\s*seatsLabel\s*\}\}/);
    });

    it('4. passengerCount is still accepted from the API for backward compatibility but never rendered', () => {
        assert.ok(!/\{\{\s*trip\.passengerCount/.test(view));
    });
});

describe('CLAIM LANDING SEAT DISPLAY HOTFIX — seatsLabel() behavior', () => {
    const seatsLabel = extractSeatsLabel();

    it('5. one seat renders "Место: 78", never "Мест: 1"', () => {
        const label = seatsLabel({ seatNumbers: [78] });
        assert.equal(label, 'Место: 78');
        assert.notEqual(label, 'Мест: 1');
    });

    it('6. multiple seats render "Места: 12, 13"', () => {
        assert.equal(seatsLabel({ seatNumbers: [12, 13] }), 'Места: 12, 13');
    });

    it('7. empty array renders nothing (null, not "Мест: 1")', () => {
        assert.equal(seatsLabel({ seatNumbers: [] }), null);
    });

    it('8. missing seatNumbers field renders nothing', () => {
        assert.equal(seatsLabel({}), null);
        assert.equal(seatsLabel({ seatNumbers: undefined }), null);
    });

    it('9. non-array seatNumbers (e.g. a raw string, if a stale API response ever slipped through) renders nothing rather than throwing', () => {
        assert.doesNotThrow(() => seatsLabel({ seatNumbers: '[78]' }));
        assert.equal(seatsLabel({ seatNumbers: '[78]' }), null);
    });

    it('10. no trip object at all renders nothing', () => {
        assert.equal(seatsLabel(null), null);
        assert.equal(seatsLabel(undefined), null);
    });
});
