import ExcelJS from 'exceljs';

/**
 * Natural ascending sort by seat number (e.g. 1, 2, 3, 4, 5, 7, 8, 10, 25, '—')
 * @param {Array} passengers 
 * @returns {Array} Sorted passengers copy
 */
export function sortPassengersBySeat(passengers) {
    if (!Array.isArray(passengers)) return [];

    return [...passengers].sort((a, b) => {
        const getSeatInfo = (item) => {
            const raw = item.seat ?? item.seatNumber ?? '';
            const str = String(raw).trim();
            if (!str || str === '—' || str === '-') {
                return { isNum: false, num: Infinity, str: '' };
            }
            const match = str.match(/\d+/);
            if (match) {
                return { isNum: true, num: parseInt(match[0], 10), str };
            }
            return { isNum: false, num: Infinity, str };
        };

        const seatA = getSeatInfo(a);
        const seatB = getSeatInfo(b);

        if (seatA.isNum && seatB.isNum) {
            if (seatA.num !== seatB.num) {
                return seatA.num - seatB.num;
            }
            return seatA.str.localeCompare(seatB.str);
        }
        if (seatA.isNum) return -1;
        if (seatB.isNum) return 1;
        return seatA.str.localeCompare(seatB.str);
    });
}

/**
 * Format passenger manifest into a professional, print-ready Excel (.xlsx) file
 * matching the exact design specification.
 * 
 * @param {Object} ticket - Ride / ticket details from DB
 * @param {Array} passengers - Passenger list
 * @param {Object} [user] - Current operator user if any
 */
export async function exportPassengerManifestExcel(ticket = {}, passengers = [], user = null) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POPUTKI.ONLINE';
    workbook.lastModifiedBy = 'POPUTKI.ONLINE';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Пассажиры', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: {
                left: 0.35,
                right: 0.35,
                top: 0.45,
                bottom: 0.45,
                header: 0.2,
                footer: 0.2
            },
            printTitlesRow: '3:3' // Repeat table header on every printed page
        },
        views: [
            { state: 'frozen', ySplit: 3 } // Freeze top 3 rows
        ]
    });

    // 1. Column definitions and widths
    worksheet.columns = [
        { key: 'index', width: 6 },        // A: #
        { key: 'fullName', width: 34 },     // B: ФИО ПАССАЖИРА
        { key: 'seat', width: 9 },         // C: МЕСТО
        { key: 'gender', width: 7 },       // D: ПОЛ
        { key: 'birthDate', width: 15 },   // E: ДАТА РОЖДЕНИЯ
        { key: 'document', width: 28 },    // F: ДОКУМЕНТ
        { key: 'citizenship', width: 22 }, // G: ГРАЖДАНСТВО
        { key: 'pickup', width: 16 },      // H: ПОСАДКА
        { key: 'dropoff', width: 16 },     // I: ВЫСАДКА
        { key: 'contact', width: 18 },     // J: КОНТАКТ
        { key: 'payment', width: 13 }      // K: ОПЛАТА
    ];

    // Common style tokens
    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
    };

    const headerBorder = {
        top: { style: 'thin', color: { argb: 'FF16365C' } },
        left: { style: 'thin', color: { argb: 'FF2A6496' } },
        bottom: { style: 'medium', color: { argb: 'FF0E2841' } },
        right: { style: 'thin', color: { argb: 'FF2A6496' } }
    };

    // Prepare route title and metadata
    const fromCity = ticket.from_city || '';
    const toCity = ticket.to_city || '';
    const routeTitle = (fromCity && toCity) ? `«${fromCity} — ${toCity}»` : (fromCity || toCity || 'по маршруту');
    const departureDate = ticket.departure_date || '________________';
    const driverName = ticket.driver_name || ticket.driver || (user && user.name) || '________________';
    const busPlate = ticket.bus_number || ticket.gov_number || ticket.license_plate || ticket.plate_number || '________________';

    // Sort passengers ascending by seat number
    const sortedPassengers = sortPassengersBySeat(passengers);
    const totalPassengers = sortedPassengers.length;

    // ─── ROW 1: Title ─────────────────────────────────────────────────────────────
    const row1 = worksheet.getRow(1);
    row1.height = 30;
    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `СПИСОК ПАССАЖИРОВ ПО МАРШРУТУ ${routeTitle}`;
    titleCell.font = {
        name: 'Arial',
        size: 13,
        bold: true,
        color: { argb: 'FF0E2841' }
    };
    titleCell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
    };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEBF1F5' }
    };

    // ─── ROW 2: Metadata (Date, Driver, Plate, Count) ───────────────────────────
    const row2 = worksheet.getRow(2);
    row2.height = 24;

    // Merge A2:B2 for Date
    worksheet.mergeCells('A2:B2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Дата рейса: ${departureDate}`;
    dateCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Merge C2:D2 for Driver
    worksheet.mergeCells('C2:D2');
    const driverCell = worksheet.getCell('C2');
    driverCell.value = `Водитель: ${driverName}`;
    driverCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
    driverCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Merge E2:G2 for Bus Plate
    worksheet.mergeCells('E2:G2');
    const plateCell = worksheet.getCell('E2');
    plateCell.value = `Гос. номер: ${busPlate}`;
    plateCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
    plateCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Merge J2:K2 for Total Passengers count
    worksheet.mergeCells('J2:K2');
    const totalCell = worksheet.getCell('J2');
    totalCell.value = `Всего пассажиров: ${totalPassengers}`;
    totalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0E2841' } };
    totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // ─── ROW 3: Table Header ────────────────────────────────────────────────────
    const headers = [
        { col: 'A', text: '#' },
        { col: 'B', text: 'ФИО ПАССАЖИРА' },
        { col: 'C', text: 'МЕСТО' },
        { col: 'D', text: 'ПОЛ' },
        { col: 'E', text: 'ДАТА\nРОЖДЕНИЯ' },
        { col: 'F', text: 'ДОКУМЕНТ' },
        { col: 'G', text: 'ГРАЖДАНСТВО' },
        { col: 'H', text: 'ПОСАДКА' },
        { col: 'I', text: 'ВЫСАДКА' },
        { col: 'J', text: 'КОНТАКТ' },
        { col: 'K', text: 'ОПЛАТА' }
    ];

    const row3 = worksheet.getRow(3);
    row3.height = 32;

    headers.forEach(h => {
        const cell = worksheet.getCell(`${h.col}3`);
        cell.value = h.text;
        cell.font = {
            name: 'Arial',
            size: 9.5,
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' } // Dark Navy Blue
        };
        cell.border = headerBorder;
    });

    // ─── ROWS 4+: Passenger Data ────────────────────────────────────────────────
    sortedPassengers.forEach((p, idx) => {
        const rowNum = idx + 4;
        const row = worksheet.getRow(rowNum);
        row.height = 22;

        // Gender formatting
        let genderText = '—';
        if (p.gender === 'male' || p.gender === 'Муж' || p.gender === 'M' || p.gender === 'МУЖ') {
            genderText = 'Муж';
        } else if (p.gender === 'female' || p.gender === 'Жен' || p.gender === 'F' || p.gender === 'ЖЕН') {
            genderText = 'Жен';
        } else if (p.gender && p.gender !== '—') {
            genderText = p.gender;
        }

        // Full name formatting
        const rawName = `${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}`.trim() || p.passenger_name || '—';
        const fullName = rawName;

        // Document formatting
        let docText = '—';
        if (p.docType && p.docNumber) {
            docText = `${p.docType} ${p.docNumber}`.trim();
        } else if (p.docNumber) {
            docText = `${p.docType || 'Паспорт'} ${p.docNumber}`.trim();
        } else if (p.docType && p.docType !== '—') {
            docText = p.docType;
        }

        // Payment status formatting
        let paymentText = 'Ручная';
        if (p.paymentStatus) {
            paymentText = p.paymentStatus;
        }

        // Seat display
        const seatDisplay = (p.seat !== undefined && p.seat !== null && p.seat !== '') ? p.seat : (p.seatNumber || '—');

        const rowValues = [
            { col: 'A', value: idx + 1, align: 'center' },
            { col: 'B', value: fullName, align: 'left' },
            { col: 'C', value: seatDisplay, align: 'center', bold: true },
            { col: 'D', value: genderText, align: 'center' },
            { col: 'E', value: p.birthDate || '—', align: 'center' },
            { col: 'F', value: docText, align: 'left' },
            { col: 'G', value: p.citizenship || '—', align: 'left' },
            { col: 'H', value: p.pickup_city || fromCity || '—', align: 'left' },
            { col: 'I', value: p.drop_off_city || toCity || '—', align: 'left' },
            { col: 'J', value: p.contactPhone || p.phone || '—', align: 'center' },
            { col: 'K', value: paymentText, align: 'center' }
        ];

        rowValues.forEach(rv => {
            const cell = worksheet.getCell(`${rv.col}${rowNum}`);
            cell.value = rv.value;
            cell.font = {
                name: 'Arial',
                size: 9.5,
                bold: !!rv.bold,
                color: { argb: 'FF000000' }
            };
            cell.alignment = {
                horizontal: rv.align,
                vertical: 'middle',
                wrapText: true
            };
            cell.border = thinBorder;
        });
    });

    // Generate output filename
    const safeFrom = (fromCity || 'Рейс').replace(/[\\/:*?"<>|]/g, '_');
    const safeTo = (toCity || '').replace(/[\\/:*?"<>|]/g, '_');
    const safeDate = (departureDate && departureDate !== '________________') ? `_${departureDate}` : '';
    const filename = `Список_пассажиров_${safeFrom}${safeTo ? '_' + safeTo : ''}${safeDate}.xlsx`;

    // Download in browser environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 1000);
    }

    return workbook;
}

/**
 * Export CRM customer list to professional Excel spreadsheet
 * 
 * @param {Array} customers - Aggregated customer list
 * @param {Object} [options] - Additional options (e.g. carrierName)
 */
export async function exportCrmCustomersExcel(customers = [], options = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POPUTKI.ONLINE';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('База клиентов', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true
        }
    });

    // Column widths
    worksheet.columns = [
        { key: 'num', width: 6 },
        { key: 'name', width: 28 },
        { key: 'phone', width: 18 },
        { key: 'document', width: 22 },
        { key: 'citizenship', width: 16 },
        { key: 'trips', width: 12 },
        { key: 'confirmed', width: 14 },
        { key: 'cancelled', width: 10 },
        { key: 'noshow', width: 10 },
        { key: 'value', width: 16 },
        { key: 'last_trip', width: 24 },
        { key: 'next_trip', width: 24 },
        { key: 'source', width: 14 },
        { key: 'loyalty', width: 14 }
    ];

    // Title Block
    worksheet.mergeCells('A1:N1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'POPUTKI.ONLINE — БАЗА КЛИЕНТОВ ПЕРЕВОЗЧИКА';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:N2');
    const subtitleCell = worksheet.getCell('A2');
    const exportDate = new Date().toLocaleDateString('ru-RU');
    subtitleCell.value = `Выгрузка сформирована: ${exportDate} | Всего клиентов в отчёте: ${customers.length}`;
    subtitleCell.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 18;

    // Header row
    const headers = [
        '№', 'ФИО Клиента', 'Телефон', 'Документ', 'Гражданство',
        'Всего', 'Подтвержд.', 'Отмен', 'No-show', 'Сумма (с.)',
        'Последняя поездка', 'Следующая поездка', 'Основной источник', 'Лояльность'
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF334155' } },
            bottom: { style: 'thin', color: { argb: 'FF334155' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } }
        };
    });

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Data rows
    customers.forEach((c, idx) => {
        const rowNum = 5 + idx;
        const row = worksheet.getRow(rowNum);
        row.height = 22;

        const docStr = c.document ? `${c.document.docType || 'Паспорт'}: ${c.document.docNumber || '—'}` : '—';
        const lastTripStr = c.last_trip ? `${c.last_trip.date} (${c.last_trip.from_city} → ${c.last_trip.to_city})` : '—';
        const nextTripStr = c.next_trip ? `${c.next_trip.date} (${c.next_trip.from_city} → ${c.next_trip.to_city})` : '—';

        const sourceLabels = {
            web: 'Сайт',
            telegram: 'Telegram',
            manual: 'Ручная бронь',
            direct_link: 'Прямая ссылка',
            partner_link: 'Партнер'
        };

        const loyaltyLabels = {
            new: 'Новый',
            repeat: 'Повторный',
            regular: 'Постоянный'
        };

        const rowValues = [
            { col: 1, val: idx + 1, align: 'center' },
            { col: 2, val: c.name || '—', align: 'left', bold: true },
            { col: 3, val: c.phone || '—', align: 'center' },
            { col: 4, val: docStr, align: 'left' },
            { col: 5, val: c.document?.citizenship || '—', align: 'center' },
            { col: 6, val: c.total_trips || 0, align: 'center' },
            { col: 7, val: c.confirmed_trips || 0, align: 'center' },
            { col: 8, val: c.cancelled_count || 0, align: 'center' },
            { col: 9, val: c.no_show_count || 0, align: 'center' },
            { col: 10, val: c.total_booking_value || 0, align: 'right', bold: true },
            { col: 11, val: lastTripStr, align: 'left' },
            { col: 12, val: nextTripStr, align: 'left' },
            { col: 13, val: sourceLabels[c.primary_source] || c.primary_source || '—', align: 'center' },
            { col: 14, val: loyaltyLabels[c.loyalty_badge] || c.loyalty_badge || '—', align: 'center' }
        ];

        rowValues.forEach(rv => {
            const cell = row.getCell(rv.col);
            cell.value = rv.val;
            cell.font = { name: 'Arial', size: 9, bold: !!rv.bold, color: { argb: 'FF0F172A' } };
            cell.alignment = { horizontal: rv.align, vertical: 'middle' };
            cell.border = thinBorder;
            if (idx % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });

    const filename = `CRM_База_Клиентов_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => { window.URL.revokeObjectURL(url); }, 1000);
    }

    return workbook;
}
