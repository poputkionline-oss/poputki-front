/**
 * utils/qrExport.js
 *
 * Phase P.1G.5: QR Export, PNG/SVG Download, and Clipboard Helpers
 *
 * Zero external 3rd-party services. Pure client-side SVG and Canvas.
 */

'use strict';

import { generateQRCodeSVG } from './qrCode.js';

/**
 * Generates an SVG string representation of a QR code.
 */
export function getQrSvg(text, size = 200) {
    return generateQRCodeSVG(text, size);
}

/**
 * Triggers browser download of an SVG file.
 */
export function downloadSvg(svgString, filename = 'poputki-qr.svg') {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Triggers browser download of a PNG file rendered from SVG via Canvas.
 */
export function downloadPng(svgString, filename = 'poputki-qr.png', size = 512) {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
    };

    img.src = url;
}

/**
 * Copies text safely to clipboard with fallback.
 */
export async function copyToClipboard(text) {
    if (!text) return false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch {
        return false;
    }
}

export default {
    getQrSvg,
    downloadSvg,
    downloadPng,
    copyToClipboard
};
