/**
 * Phase E.8 — Ticket QR Responsive Layout & Verification UI Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase E.8 — Ticket QR Responsive Layout UI Tests', () => {

    const ticketVuePath = path.resolve(__dirname, '../src/components/ticket/PassengerTicket.vue');
    const ticketVueContent = fs.readFileSync(ticketVuePath, 'utf-8');

    it('[E8-F01] PassengerTicket.vue has a dedicated responsive QR container', () => {
        assert.ok(ticketVueContent.includes('qr-container'), 'Must have qr-container class');
        assert.ok(ticketVueContent.includes('border-[2px] border-amber-500'), 'Must maintain double amber border theme');
    });

    it('[E8-F02] Header container uses responsive flex layout to prevent overlap on mobile', () => {
        assert.ok(ticketVueContent.includes('flex flex-col sm:flex-row'), 'Must use flex-col on mobile and sm:flex-row on desktop');
    });

    it('[E8-F03] QR container retains exact verification caption text', () => {
        assert.ok(ticketVueContent.includes('ПРОВЕРИТЬ'), 'Must contain ПРОВЕРИТЬ caption');
        assert.ok(ticketVueContent.includes('ПОДЛИННОСТЬ БИЛЕТА'), 'Must contain ПОДЛИННОСТЬ БИЛЕТА caption');
    });

    it('[E8-F04] QR code SVG is wrapped with overflow protection', () => {
        assert.ok(ticketVueContent.includes('w-16 h-16 sm:w-20 sm:h-20'), 'Must set responsive SVG dimensions');
        assert.ok(ticketVueContent.includes('overflow-hidden'), 'Must prevent SVG overflow');
    });

    it('[E8-F05] Print mode retains compact QR container sizing', () => {
        assert.ok(ticketVueContent.includes('print:w-28 print:shrink-0'), 'Must enforce compact QR container in print mode');
    });
});
