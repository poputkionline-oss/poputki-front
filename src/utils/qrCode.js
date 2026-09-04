/**
 * qrCode.js — Lightweight pure-JS SVG QR Code Generator
 * Generates clean, crisp, scalable vector SVG for Ticket QR codes.
 * 
 * Supports standard URLs and verification tokens without external heavy npm dependencies.
 */

// Mode indicators
const MODE_BYTE = 4;

    // GF(256) log and antilog tables
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i = 0, x = 1; i < 256; i++) {
        EXP_TABLE[i] = x;
        LOG_TABLE[x] = i;
        x <<= 1;
        if (x & 256) x ^= 0x11d;
    }

    function glog(n) {
        if (n < 1) throw new Error('glog(' + n + ')');
        return LOG_TABLE[n];
    }
    function gexp(n) {
        while (n < 0) n += 255;
        while (n >= 256) n -= 255;
        return EXP_TABLE[n];
    }

    function Polynomial(num, shift) {
        let offset = 0;
        while (offset < num.length && num[offset] === 0) offset++;
        this.num = new Array(num.length - offset + shift);
        for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    }
    Polynomial.prototype = {
        get: function(index) { return this.num[index]; },
        getLength: function() { return this.num.length; },
        multiply: function(e) {
            const num = new Array(this.getLength() + e.getLength() - 1);
            for (let i = 0; i < this.getLength(); i++) {
                for (let j = 0; j < e.getLength(); j++) {
                    num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
                }
            }
            return new Polynomial(num, 0);
        },
        mod: function(e) {
            if (this.getLength() - e.getLength() < 0) return this;
            const ratio = glog(this.get(0)) - glog(e.get(0));
            const num = new Array(this.getLength());
            for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
            for (let i = 0; i < e.getLength(); i++) num[i] ^= gexp(glog(e.get(i)) + ratio);
            return new Polynomial(num, 0).mod(e);
        }
    };

    function getErrorCorrectPolynomial(errorCorrectLength) {
        let a = new Polynomial([1], 0);
        for (let i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new Polynomial([1, gexp(i)], 0));
        }
        return a;
    }

    // RS Block parameters for EC level M (standard)
    // Version 1-10 table: [totalDataCodewords, ecCodewordsPerBlock, numBlocks]
    const RS_BLOCK_TABLE = [
        null,
        [16, 10, 1],   // V1-M (up to 14 bytes)
        [28, 16, 1],   // V2-M (up to 26 bytes)
        [44, 26, 1],   // V3-M (up to 42 bytes)
        [64, 18, 2],   // V4-M (up to 62 bytes)
        [86, 24, 2],   // V5-M (up to 84 bytes)
        [108, 16, 4],  // V6-M (up to 106 bytes)
        [124, 18, 4],  // V7-M (up to 122 bytes)
        [154, 22, 4],  // V8-M (up to 152 bytes)
        [180, 22, 5],  // V9-M (up to 180 bytes)
        [216, 26, 5]   // V10-M (up to 213 bytes)
    ];

    function createBytes(buffer, rsBlock) {
        const totalDataCount = rsBlock[0];
        const ecCount = rsBlock[1];
        const numBlocks = rsBlock[2];
        const dataCountPerBlock = Math.floor(totalDataCount / numBlocks);

        const dataBlocks = [];
        const ecBlocks = [];

        let offset = 0;
        for (let r = 0; r < numBlocks; r++) {
            const count = dataCountPerBlock;
            const rawData = buffer.buffer.slice(offset, offset + count);
            offset += count;
            dataBlocks.push(rawData);

            const rawPoly = new Polynomial(rawData, ecCount);
            const ecPoly = getErrorCorrectPolynomial(ecCount);
            const modPoly = rawPoly.mod(ecPoly);
            const ecData = new Array(ecCount);
            for (let i = 0; i < ecCount; i++) {
                const modIndex = i + modPoly.getLength() - ecData.length;
                ecData[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
            }
            ecBlocks.push(ecData);
        }

        const res = [];
        for (let i = 0; i < dataCountPerBlock; i++) {
            for (let r = 0; r < numBlocks; r++) res.push(dataBlocks[r][i]);
        }
        for (let i = 0; i < ecCount; i++) {
            for (let r = 0; r < numBlocks; r++) res.push(ecBlocks[r][i]);
        }
        return res;
    }

    function BitBuffer() {
        this.buffer = [];
        this.length = 0;
    }
    BitBuffer.prototype = {
        put: function(num, length) {
            for (let i = 0; i < length; i++) {
                this.putBit(((num >>> (length - i - 1)) & 1) === 1);
            }
        },
        putBit: function(bit) {
            const bufIndex = Math.floor(this.length / 8);
            if (this.buffer.length <= bufIndex) this.buffer.push(0);
            if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
            this.length++;
        }
    };

    function QRCodeModel(typeNumber) {
        this.typeNumber = typeNumber;
        this.moduleCount = typeNumber * 4 + 17;
        this.modules = null;
    }
    QRCodeModel.prototype = {
        make: function(data) {
            const buffer = new BitBuffer();
            buffer.put(MODE_BYTE, 4);
            const bytes = [];
            for (let i = 0; i < data.length; i++) {
                const c = data.charCodeAt(i);
                if (c < 128) bytes.push(c);
                else if (c < 2048) {
                    bytes.push((c >> 6) | 192, (c & 63) | 128);
                } else {
                    bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
                }
            }
            buffer.put(bytes.length, this.typeNumber < 10 ? 8 : 16);
            for (let i = 0; i < bytes.length; i++) buffer.put(bytes[i], 8);

            const totalDataBits = RS_BLOCK_TABLE[this.typeNumber][0] * 8;
            if (buffer.length + 4 <= totalDataBits) buffer.put(0, 4);
            while (buffer.length % 8 !== 0) buffer.putBit(false);
            while (buffer.length < totalDataBits) {
                buffer.put(0xec, 8);
                if (buffer.length < totalDataBits) buffer.put(0x11, 8);
            }

            const finalBytes = createBytes(buffer, RS_BLOCK_TABLE[this.typeNumber]);

            this.modules = new Array(this.moduleCount);
            for (let row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount).fill(null);
            }

            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupTimingPattern();
            this.setupPositionAdjustPattern();
            this.setupTypeInfo();
            this.mapData(finalBytes);
        },
        setupPositionProbePattern: function(row, col) {
            for (let r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (let c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                        (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                        (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },
        setupTimingPattern: function() {
            for (let r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] === null) this.modules[r][6] = (r % 2 === 0);
            }
            for (let c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] === null) this.modules[6][c] = (c % 2 === 0);
            }
        },
        setupPositionAdjustPattern: function() {
            if (this.typeNumber < 2) return;
            const pos = [6, this.moduleCount - 7];
            for (let i = 0; i < pos.length; i++) {
                for (let j = 0; j < pos.length; j++) {
                    const row = pos[i];
                    const col = pos[j];
                    if (this.modules[row][col] !== null) continue;
                    for (let r = -2; r <= 2; r++) {
                        for (let c = -2; c <= 2; c++) {
                            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                                this.modules[row + r][col + c] = true;
                            } else {
                                this.modules[row + r][col + c] = false;
                            }
                        }
                    }
                }
            }
        },
        setupTypeInfo: function() {
            // Mask pattern 0 (checkerboard), Level M
            const bits = 0x5412; // Formatted bits for (M, mask=0) with BCH error correction
            for (let i = 0; i < 15; i++) {
                const mod = ((bits >> i) & 1) === 1;
                if (i < 6) this.modules[i][8] = mod;
                else if (i < 8) this.modules[i + 1][8] = mod;
                else this.modules[this.moduleCount - 15 + i][8] = mod;

                if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
                else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
                else this.modules[8][15 - i - 1] = mod;
            }
            this.modules[this.moduleCount - 8][8] = true;
        },
        mapData: function(data) {
            let inc = -1;
            let row = this.moduleCount - 1;
            let bitIndex = 7;
            let byteIndex = 0;

            for (let col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col === 6) col--;
                while (true) {
                    for (let c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] === null) {
                            let dark = false;
                            if (byteIndex < data.length) {
                                dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                            }
                            // Apply mask pattern 0: (row + col) % 2 == 0
                            const mask = ((row + (col - c)) % 2 === 0);
                            this.modules[row][col - c] = mask ? !dark : dark;
                            bitIndex--;
                            if (bitIndex === -1) {
                                byteIndex++;
                                bitIndex = 7;
                            }
                        }
                    }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc;
                        inc = -inc;
                        break;
                    }
                }
            }
        }
    };

export function generateQRCodeSVG(text, size = 160) {
    if (!text) return '';
    
    // Pick best typeNumber version
    let typeNumber = 1;
    const len = encodeURI(text).length;
    if (len <= 14) typeNumber = 1;
    else if (len <= 26) typeNumber = 2;
    else if (len <= 42) typeNumber = 3;
    else if (len <= 62) typeNumber = 4;
    else if (len <= 84) typeNumber = 5;
    else if (len <= 106) typeNumber = 6;
    else if (len <= 122) typeNumber = 7;
    else typeNumber = 8;

    const qr = new QRCodeModel(typeNumber);
    try {
        qr.make(text);
    } catch {
        // Fallback to larger version
        qr.typeNumber = 8;
        qr.moduleCount = 8 * 4 + 17;
        qr.make(text);
    }

    const count = qr.moduleCount;
    const cellSize = (size / count).toFixed(2);
    
    let path = '';
    for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
            if (qr.modules[r][c]) {
                const x = (c * (size / count)).toFixed(2);
                const y = (r * (size / count)).toFixed(2);
                path += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="w-full h-full"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#1e293b"/></svg>`;
}

export function getQRCodeMatrix(text) {
    if (!text) return null;
    let typeNumber = 1;
    const len = encodeURI(text).length;
    if (len <= 14) typeNumber = 1;
    else if (len <= 26) typeNumber = 2;
    else if (len <= 42) typeNumber = 3;
    else if (len <= 62) typeNumber = 4;
    else if (len <= 84) typeNumber = 5;
    else if (len <= 106) typeNumber = 6;
    else if (len <= 122) typeNumber = 7;
    else typeNumber = 8;

    const qr = new QRCodeModel(typeNumber);
    try {
        qr.make(text);
    } catch {
        qr.typeNumber = 8;
        qr.moduleCount = 8 * 4 + 17;
        qr.make(text);
    }

    return {
        moduleCount: qr.moduleCount,
        modules: qr.modules
    };
}

export default {
    generateQRCodeSVG,
    getQRCodeMatrix
};
