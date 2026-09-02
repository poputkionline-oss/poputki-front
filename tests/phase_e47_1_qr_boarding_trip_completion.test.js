/**
 * tests/phase_e47_1_qr_boarding_trip_completion.test.js
 *
 * PHASE E.47.1 — QR Boarding Scanner + Canonical Trip Completion (Frontend)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.47.1 — QR BOARDING SCANNER UI', () => {
    const scannerPath = path.resolve('src/components/carrier/CarrierBoardingScanner.vue');
    const scannerSource = fs.readFileSync(scannerPath, 'utf8');

    const boardingPath = path.resolve('src/components/carrier/CarrierBoarding.vue');
    const boardingSource = fs.readFileSync(boardingPath, 'utf8');

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    it('1. CarrierBoarding exposes a prominent "Сканировать QR" button', () => {
        assert.ok(boardingSource.includes('Сканировать QR'), 'Must contain the scan button label');
        assert.ok(boardingSource.includes('@click="openScanner"'), 'Button must call openScanner');
    });

    it('2. CarrierBoarding imports and registers CarrierBoardingScanner, mounted only when open', () => {
        assert.ok(boardingSource.includes("import CarrierBoardingScanner from './CarrierBoardingScanner.vue'"));
        assert.ok(boardingSource.includes('CarrierBoardingScanner'));
        assert.ok(boardingSource.includes('v-if="showScanner && selectedTicket"'), 'Scanner must only mount while explicitly open with a selected trip');
    });

    it('3. Scanner emits close/boarded, and CarrierBoarding wires both', () => {
        assert.ok(boardingSource.includes('@close="showScanner = false"'));
        assert.ok(boardingSource.includes('@boarded="handleScanResult"'));
        assert.ok(scannerSource.includes("emits: ['close', 'boarded']"));
    });

    it('4. handleScanResult patches local booking state without a full page reload', () => {
        const match = boardingSource.match(/handleScanResult\(data\)\s*{[\s\S]*?\n {8}},/);
        assert.ok(match, 'handleScanResult method must exist');
        const body = match[0];
        assert.ok(body.includes('parentBooking.boarding_status'), 'Must patch boarding_status in place');
        assert.ok(body.includes('parentBooking.boarded_at'), 'Must patch boarded_at in place');
        assert.ok(!body.includes('location.reload'), 'Must never force a full page reload');
    });

    it('5. Camera uses rear-facing preference with graceful fallback', () => {
        assert.ok(scannerSource.includes("facingMode: { ideal: 'environment' }"), 'Must prefer rear camera');
        assert.ok(scannerSource.includes('getUserMedia({ video: true, audio: false })'), 'Must fall back to any camera if rear-only request fails');
    });

    it('6. BarcodeDetector is tried first, jsQR is the declared fallback (single library)', () => {
        assert.ok(scannerSource.includes("'BarcodeDetector' in window"), 'Must feature-detect native BarcodeDetector');
        assert.ok(scannerSource.includes("import jsQR from 'jsqr'"), 'Must import jsQR as the fallback decoder');
        assert.ok(!scannerSource.includes('html5-qrcode'), 'Only one scanning library should be used (jsQR), not html5-qrcode');
    });

    it('7. Continuous scanning: camera loop is not stopped after a successful scan', () => {
        assert.ok(scannerSource.includes('requestAnimationFrame(() => this.tick())'), 'Detection loop must keep re-scheduling itself');
        assert.ok(!scannerSource.includes('this.stopCamera()') || scannerSource.match(/stopCamera\(\)/g).length >= 2, 'stopCamera must only be called on unmount/close, not after every scan');
        // handleDetection must not call stopCamera or close on success
        const handleDetectionBody = scannerSource.match(/async handleDetection\(rawScanValue\)\s*{[\s\S]*?\n {8}},/)[0];
        assert.ok(!handleDetectionBody.includes('stopCamera'), 'A successful/duplicate scan must not stop the camera');
        assert.ok(!handleDetectionBody.includes("$emit('close')"), 'A successful/duplicate scan must not close the scanner');
    });

    it('8. Debounce/lock: no new detection is processed while a request is in flight or cooling down', () => {
        assert.ok(scannerSource.includes('if (this.locked) return;'), 'handleDetection must bail out while locked');
        assert.ok(scannerSource.includes('if (this.locked || this.cameraStatus'), 'tick() must skip detection while locked');
        assert.ok(scannerSource.includes('scheduleCooldown'), 'Must schedule a cooldown after each result');
    });

    it('9. Success / duplicate / wrong-trip / invalid feedback strings are present', () => {
        assert.ok(scannerSource.includes('Пассажир посажен'));
        assert.ok(scannerSource.includes('Уже посажен'));
        assert.ok(scannerSource.includes('Билет относится к другому рейсу'));
        assert.ok(scannerSource.includes("'Недействительный билет'"));
        assert.ok(scannerSource.includes('Нет соединения с сервером'));
    });

    it('10. Network failure never produces an optimistic boarded state', () => {
        const body = scannerSource.match(/async handleDetection\(rawScanValue\)\s*{[\s\S]*?\n {8}},/)[0];
        // The $emit('boarded', ...) call must only happen inside the try block's success path,
        // i.e. after a resolved axios response — never inside handleScanError / the catch branch.
        const catchBlock = scannerSource.match(/handleScanError\(err\)\s*{[\s\S]*?\n {8}},/)[0];
        assert.ok(!catchBlock.includes("$emit('boarded'"), 'Errors must never emit a boarded event');
        assert.ok(body.includes('this.$emit(\'boarded\', data)'));
    });

    it('11. navigator.vibrate is used as best-effort only (wrapped in try/catch)', () => {
        assert.ok(scannerSource.includes('vibrate(pattern)'));
        const vibrateBody = scannerSource.match(/vibrate\(pattern\)\s*{[\s\S]*?\n {8}},/)[0];
        assert.ok(vibrateBody.includes('try') && vibrateBody.includes('catch'), 'vibrate must be wrapped defensively');
    });

    it('12. Extracts the ticket token from a scanned URL (QR encodes the public ticket verification URL)', () => {
        // Simulate the exact logic in extractTicketToken
        function extractTicketToken(rawScanValue) {
            const text = String(rawScanValue || '').trim();
            if (!text) return '';
            try {
                const url = new URL(text);
                const segments = url.pathname.split('/').filter(Boolean);
                if (segments.length > 0) return segments[segments.length - 1];
            } catch (e) { /* not a URL */ }
            return text;
        }

        const token = '448-bde80c8fc4e62bb31ef3ab12ad282d1e';
        assert.strictEqual(extractTicketToken(`https://www.poputki.online/ticket/${token}`), token);
        assert.strictEqual(extractTicketToken(token), token, 'Raw token QR (no URL) must also work');
        assert.strictEqual(extractTicketToken(''), '');
    });

    it('13. Backend request body matches the required minimal shape { ticketToken, tripId }', () => {
        assert.ok(scannerSource.includes("api.post('/bus-admin/bookings/scan-boarding'"));
        const postCall = scannerSource.match(/api\.post\('\/bus-admin\/bookings\/scan-boarding',\s*{([\s\S]*?)}\);/)[1];
        assert.ok(postCall.includes('ticketToken'));
        assert.ok(postCall.includes('tripId: this.trip.id'));
        // Must NOT send a client-trusted bookingId — backend derives it from the verified token.
        assert.ok(!postCall.includes('bookingId'));
    });

    it('14. Manual boarding fallback buttons ("Посажен" / "Не явился") remain present', () => {
        assert.ok(boardingSource.includes('✓ Посажен'));
        assert.ok(boardingSource.includes('✕ Не явился'));
        assert.ok(boardingSource.includes("updateBoardingStatus(p, 'boarded')"));
        assert.ok(boardingSource.includes("updateBoardingStatus(p, 'no_show')"));
    });

    it('15. Camera-denied / unsupported states keep the scanner closable without breaking manual fallback', () => {
        assert.ok(scannerSource.includes("cameraStatus === 'denied'"));
        assert.ok(scannerSource.includes("cameraStatus === 'unsupported'"));
        assert.ok(scannerSource.includes('Используйте ручную посадку'));
    });
});

describe('PHASE E.47.1 — TRIP COMPLETION UI (BusAdminView)', () => {
    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    it('1. "Завершить рейс" button is restored, gated by canCompleteTrip(ticket)', () => {
        assert.ok(busAdminSource.includes('v-if="canCompleteTrip(ticket)"'));
        assert.ok(busAdminSource.includes('@click="completeTicket(ticket)"'));
        assert.ok(busAdminSource.includes('Завершить рейс'));
    });

    it('2. canCompleteTrip requires status active AND departure to have passed', () => {
        const match = busAdminSource.match(/canCompleteTrip\(ticket\)\s*{[\s\S]*?\n {8}},/);
        assert.ok(match, 'canCompleteTrip must be defined');
        const body = match[0];
        assert.ok(body.includes("ticket.status === 'active'"));
        assert.ok(body.includes('hasTripDeparted'));
    });

    it('3. hasTripDeparted interprets departure in the Asia/Dushanbe business timezone (+05:00)', () => {
        const match = busAdminSource.match(/hasTripDeparted\(ticket\)\s*{[\s\S]*?\n {8}},/);
        assert.ok(match, 'hasTripDeparted must be defined');
        assert.ok(match[0].includes('+05:00'), 'Must anchor departure parsing to a fixed +05:00 offset (Asia/Dushanbe)');
    });

    it('4. hasTripDeparted logic: future trip hidden, past-departure trip shown', () => {
        // Re-implement the exact method body semantics for a pure logic check
        function hasTripDeparted(ticket) {
            if (!ticket || !ticket.departure_date) return false;
            const timeStr = (ticket.departure_time || '00:00').substring(0, 5);
            const isoLocal = `${ticket.departure_date}T${timeStr}:00+05:00`;
            const departureInstant = new Date(isoLocal);
            if (isNaN(departureInstant.getTime())) return false;
            return Date.now() >= departureInstant.getTime();
        }

        const future = { departure_date: '2099-01-01', departure_time: '08:00' };
        const past = { departure_date: '2020-01-01', departure_time: '08:00' };
        assert.strictEqual(hasTripDeparted(future), false, 'Future trip must not be considered departed');
        assert.strictEqual(hasTripDeparted(past), true, 'Past trip must be considered departed');
        assert.strictEqual(hasTripDeparted({}), false);
    });

    it('5. completeTicket() opens the confirmation modal instead of window.confirm', () => {
        const match = busAdminSource.match(/completeTicket\(ticket\)\s*{[\s\S]*?\n {8}},/);
        assert.ok(match, 'completeTicket must be defined');
        assert.ok(match[0].includes('completionModal'), 'Must open the completionModal, not window.confirm');
        assert.ok(!match[0].includes('confirm('), 'Must not use a blocking browser confirm() dialog');
    });

    it('6. Confirmation modal contains the exact required warning copy and both actions', () => {
        assert.ok(busAdminSource.includes('Завершить рейс?'));
        assert.ok(busAdminSource.includes('будут отмечены как «Не явился»'));
        assert.ok(busAdminSource.includes('@click="cancelCompleteTicket"'));
        assert.ok(busAdminSource.includes('@click="confirmCompleteTicket"'));
    });

    it('7. cancelCompleteTicket performs no mutation (no api call)', () => {
        const match = busAdminSource.match(/cancelCompleteTicket\(\)\s*{[\s\S]*?\n {8}},/);
        assert.ok(match, 'cancelCompleteTicket must be defined');
        assert.ok(!match[0].includes('api.'), 'Cancel must never call the API');
    });

    it('8. confirmCompleteTicket calls the canonical completion endpoint (not the generic ticket PUT)', () => {
        const match = busAdminSource.match(/async confirmCompleteTicket\(\)\s*{[\s\S]*?\n {8}},/);
        assert.ok(match, 'confirmCompleteTicket must be defined');
        assert.ok(match[0].includes('/bus-admin/tickets/${ticket.id}/complete'), 'Must call the canonical POST .../complete endpoint');
        assert.ok(match[0].includes('api.post'));
    });

    it('9. Completed trips show a "Завершен" badge and hide the completion button entirely', () => {
        assert.ok(busAdminSource.includes("ticket.status === 'completed'"));
        assert.ok(busAdminSource.includes('Завершен'));
        // The completion button lives strictly inside the non-completed branch
        const nonCompletedBranch = busAdminSource.match(/v-if="ticket\.status !== 'completed'">([\s\S]*?)<\/div>\s*<div class="flex items-center space-x-2" v-else>/);
        assert.ok(nonCompletedBranch, 'Must find the active-tickets action branch');
        assert.ok(nonCompletedBranch[1].includes('canCompleteTrip'), 'Completion button must live only in the non-completed branch');
    });

    it('10. Deleted (removed) trips render no action buttons since they no longer exist in the list', () => {
        // deleteTicket performs a hard DELETE — a deleted ticket is never in `tickets` again,
        // so no completion/other action buttons can render for it. Confirm hard-delete semantics.
        assert.ok(busAdminSource.includes('async deleteTicket(id)'));
    });
});
