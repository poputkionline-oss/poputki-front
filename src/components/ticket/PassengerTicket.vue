<script>
import { generateQRCodeSVG } from '../../utils/qrCode.js';
import api from '../../api';

export default {
    name: 'PassengerTicket',
    props: {
        ticket: {
            type: Object,
            required: true
        },
        mode: {
            type: String,
            default: 'screen' // 'screen' | 'print'
        },
        showControls: {
            type: Boolean,
            default: true
        }
    },
    emits: ['close'],
    data() {
        return {
            openingTelegram: false,
            telegramError: '',
            telegramDeepLink: ''
        };
    },
    computed: {
        qrSvg() {
            if (!this.ticket?.verificationUrl) return '';
            return generateQRCodeSVG(this.ticket.verificationUrl, 130);
        },
        floorDisplay() {
            if (this.ticket?.bus?.bus_type !== 'double') return null;
            const seatNum = this.ticket?.passenger?.seats?.[0] ? Number(this.ticket.passenger.seats[0]) : null;
            if (!seatNum) return '1 этаж';
            const f1Seats = Number(this.ticket?.bus?.floor1_seats) || 20;
            return seatNum <= f1Seats ? '1 ЭТАЖ' : '2 ЭТАЖ';
        },
        intermediateDisplay() {
            const stops = this.ticket?.route?.intermediateStops;
            if (Array.isArray(stops) && stops.length > 0) {
                return stops.map(s => typeof s === 'string' ? s : s.city).filter(Boolean).join(' — ');
            }
            return '';
        },
        fullRouteDisplay() {
            const from = this.ticket?.route?.fromCity || '—';
            const to = this.ticket?.route?.toCity || '—';
            const mid = this.intermediateDisplay;
            return mid ? `${from} — ${mid} — ${to}` : `${from} — ${to}`;
        },
        groupLeaderName() {
            return this.ticket?.support?.name || '';
        },
        groupLeaderPhone() {
            return this.ticket?.support?.phone || '';
        },
        groupLeaderWhatsapp() {
            return this.ticket?.support?.whatsapp || '';
        },
        samePhoneAndWhatsapp() {
            return this.groupLeaderPhone && this.groupLeaderWhatsapp && (this.groupLeaderPhone === this.groupLeaderWhatsapp);
        },
        activeAmenities() {
            const a = this.ticket?.bus?.amenities;
            if (Array.isArray(a)) return a;
            return [];
        },
        hasAnyAmenities() {
            return this.activeAmenities.length > 0;
        },
        isClaimedTicket() {
            return Boolean(this.ticket?.isClaimed || this.ticket?.claimStatus === 'claimed');
        },
        miniAppUrl() {
            return 'https://t.me/Poputkionline_bot?startapp';
        },
        canOpenTelegram() {
            return Boolean(
                this.ticket?.bookingId &&
                this.ticket?.verificationToken &&
                this.ticket?.status === 'confirmed' &&
                this.ticket?.isManual &&
                !this.ticket?.isClaimed &&
                this.ticket?.claimStatus !== 'claimed'
            );
        }
    },
    methods: {
        printTicket() {
            window.print();
        },
        formatDate(dateStr) {
            if (!dateStr) return '—';
            try {
                const d = new Date(dateStr);
                return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch {
                return dateStr;
            }
        },
        handleOpenMiniApp(e) {
            if (window.Telegram?.WebApp) {
                e.preventDefault();
                this.$router.push({ name: 'my-bus-tickets' });
            }
        },
        async openTicketInTelegram() {
            // REGRESSION GUARD: Never call start-session for an already claimed ticket
            if (this.isClaimedTicket) return;
            if (!this.canOpenTelegram) return;
            // A link fetched on a previous tap is reused as-is: the actual
            // navigation must happen on a fresh, synchronous tap (native <a href>)
            // for iOS Safari to honor the Telegram universal link. Re-running the
            // request here would also create a redundant claim session.
            if (this.telegramDeepLink || this.openingTelegram) return;

            this.openingTelegram = true;
            this.telegramError = '';
            try {
                const response = await api.post('/claims/start-session', {
                    bookingId: this.ticket.bookingId,
                    ticketVerificationToken: this.ticket.verificationToken
                });

                const deepLink = response.data?.deepLink;
                if (!deepLink || typeof deepLink !== 'string' || !deepLink.startsWith('https://t.me/')) {
                    throw new Error('Сервис не вернул безопасную ссылку Telegram');
                }

                this.telegramDeepLink = deepLink;
            } catch (err) {
                this.telegramError = err.response?.data?.error || err.message || 'Не удалось открыть Telegram. Попробуйте ещё раз.';
            } finally {
                this.openingTelegram = false;
            }
        }
    }
};
</script>

<template>
    <div class="ticket-wrapper" :class="mode === 'print' ? 'is-print-mode' : 'is-screen-mode'">

        <!-- Screen Modal Action Bar (Hidden in window.print) -->
        <div v-if="mode === 'screen' && showControls" class="no-print flex items-center justify-between gap-3 mb-3 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-lg">
            <div class="flex items-center gap-2">
                <span class="text-amber-400 font-black tracking-wide">POPUTKI.ONLINE</span>
                <span class="text-xs text-slate-300">• Электронный пассажирский билет</span>
            </div>
            <div class="flex items-center gap-2">
                <!-- Claimed Ticket Action -->
                <div v-if="isClaimedTicket">
                    <a
                        :href="miniAppUrl"
                        @click="handleOpenMiniApp"
                        class="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    >
                        <span>📱</span>
                        <span>Открыть мои поездки</span>
                    </a>
                </div>
                <!-- Unclaimed Ticket Action -->
                <div v-if="canOpenTelegram" class="flex flex-col items-end gap-1">
                    <a
                        v-if="telegramDeepLink"
                        :href="telegramDeepLink"
                        class="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    >
                        <span>✈️</span>
                        <span>Открыть Telegram</span>
                    </a>
                    <button
                        v-else
                        @click="openTicketInTelegram"
                        :disabled="openingTelegram"
                        class="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-70 disabled:cursor-wait text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    >
                        <span>{{ openingTelegram ? '⏳' : '✈️' }}</span>
                        <span>{{ openingTelegram ? 'Подготавливаем Telegram…' : 'Открыть билет в Telegram' }}</span>
                    </button>
                    <span v-if="telegramDeepLink" class="max-w-[260px] text-[10px] leading-tight text-sky-100 text-right">
                        Ссылка готова. Нажмите ещё раз, чтобы открыть Telegram.
                    </span>
                    <span v-if="telegramError" class="max-w-[260px] text-[10px] leading-tight text-rose-200 text-right">
                        {{ telegramError }}
                    </span>
                </div>
                <button
                    @click="printTicket"
                    class="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                >
                    <span>🖨</span>
                    <span>Распечатать билет</span>
                </button>
                <button
                    @click="$emit('close')"
                    class="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-all active:scale-95"
                    title="Закрыть"
                >
                    ✕
                </button>
            </div>
        </div>

        <!-- AUTHENTIC DOUBLE-BORDERED TICKET CONTAINER (A5 LANDSCAPE COMPOSITION) -->
        <div class="ticket-outer-frame bg-white p-2 rounded-[22px] border-[2.5px] border-amber-500 shadow-xl print:shadow-none print:m-0 print:p-1.5 print:rounded-[18px] print:border-[2px] print:border-amber-500 max-w-[850px] mx-auto">

            <!-- Inner Yellow Border Box -->
            <div class="ticket-inner-box border-[2px] border-amber-500 rounded-[16px] p-3.5 sm:p-4 bg-white relative print:p-3.5 print:rounded-[12px]">

                <!-- COMPACT TOP HEADER: LOGO + BRAND + TITLE + RIGHT QR CARD -->
                <div class="flex items-start justify-between gap-3 pb-2 border-b border-amber-400/50">

                    <!-- Left: Header + Title (Compact Vertical Spacing) -->
                    <div class="space-y-1 min-w-0">
                        <div class="flex items-center gap-3">
                            <!-- Official Brand Logo Asset -->
                            <img
                                src="../../assets/logo-itself.png"
                                alt="POPUTKI.ONLINE Logo"
                                class="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
                            />

                            <div>
                                <div class="text-2xl sm:text-[28px] font-black tracking-tight text-slate-900 leading-none">
                                    POPUTKI.ONLINE
                                </div>
                                <div class="text-[9.5px] sm:text-[10.5px] font-bold text-slate-600 tracking-[0.22em] uppercase mt-0.5">
                                    ПОЕЗДКИ С ДОВЕРИЕМ
                                </div>
                            </div>
                        </div>

                        <!-- Document Title directly below Header -->
                        <div class="pt-1">
                            <h1 class="text-base sm:text-lg font-black text-slate-900 tracking-wide uppercase leading-tight">
                                ЭЛЕКТРОННЫЙ БИЛЕТ / МАРШРУТНЫЙ ЛИСТ
                            </h1>
                            <div class="flex items-center gap-2.5 sm:gap-3 text-[9.5px] sm:text-[10.5px] text-slate-600 font-semibold mt-0.5 flex-wrap">
                                <div class="flex items-center gap-1">
                                    <span class="text-slate-400">🌐</span>
                                    <span>Оформлено через: <strong class="text-amber-600 font-bold">POPUTKI.ONLINE</strong></span>
                                </div>
                                <span class="text-slate-300 font-normal">|</span>
                                <div class="flex items-center gap-1">
                                    <span class="text-slate-400">🏢</span>
                                    <span>Перевозчик: <strong class="text-slate-900 font-bold">{{ ticket?.carrier?.companyName || 'ООО «Рохи Абрешим»' }}</strong></span>
                                </div>
                                <span class="text-slate-300 font-normal">|</span>
                                <div class="flex items-center gap-1">
                                    <span class="text-slate-400">🎫</span>
                                    <span>Билет № <strong class="text-slate-900 font-mono font-bold">{{ ticket?.ticketNumber || 'POP-000000' }}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Verification QR Card (Compact & Correct Caption) -->
                    <div class="border-[2px] border-amber-500 rounded-xl p-1.5 bg-white flex flex-col items-center justify-center text-center shrink-0 w-28 sm:w-32 shadow-sm">
                        <div class="text-[8px] sm:text-[8.5px] font-black text-amber-600 uppercase tracking-tight leading-tight mb-0.5 text-center">
                            ПРОВЕРИТЬ<br/>ПОДЛИННОСТЬ БИЛЕТА
                        </div>
                        <div class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center" v-html="qrSvg"></div>
                        <div class="text-[8px] font-black text-slate-800 tracking-wider mt-0.5 uppercase font-mono">
                            POPUTKI.ONLINE
                        </div>
                    </div>
                </div>

                <!-- TOP ROUTE & BUS SUMMARY ROW (FULL ROUTE NEVER CUT OFF) -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 py-2 px-3 bg-amber-50/40 rounded-xl border border-amber-300/60 my-2">

                    <!-- Item 1: Full Route (Never Ellipsis) - 6 cols -->
                    <div class="sm:col-span-6 flex items-start gap-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            A
                        </div>
                        <div class="min-w-0">
                            <div class="text-[8.5px] font-black uppercase tracking-wider text-slate-500">МАРШРУТ:</div>
                            <div class="text-xs sm:text-[13px] font-black text-amber-700 leading-snug break-words mt-0.5">
                                {{ fullRouteDisplay }}
                            </div>
                        </div>
                    </div>

                    <!-- Item 2: Bus Model & Type - 3 cols -->
                    <div class="sm:col-span-3 flex items-start gap-2.5 min-w-0 border-t sm:border-t-0 sm:border-l border-amber-200/60 sm:pl-2.5 pt-1.5 sm:pt-0">
                        <div class="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            🚌
                        </div>
                        <div class="min-w-0">
                            <div class="text-[8.5px] font-black uppercase tracking-wider text-slate-500">АВТОБУС:</div>
                            <div class="text-xs font-bold text-slate-800 leading-tight mt-0.5">
                                <span class="block font-black text-slate-900">{{ ticket?.bus?.brand || 'Setra' }} {{ ticket?.bus?.model || 'S431DT' }}</span>
                                <span class="text-[10px] text-slate-500">{{ ticket?.bus?.bus_type === 'double' ? 'Двухэтажный' : 'Комфорт-класс' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Item 3: License Plate - 3 cols -->
                    <div class="sm:col-span-3 flex items-start gap-2.5 min-w-0 border-t sm:border-t-0 sm:border-l border-amber-200/60 sm:pl-2.5 pt-1.5 sm:pt-0">
                        <div class="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            📋
                        </div>
                        <div class="min-w-0">
                            <div class="text-[8.5px] font-black uppercase tracking-wider text-slate-500">ГОС. НОМЕР АВТОБУСА:</div>
                            <div class="text-sm sm:text-base font-black text-amber-600 font-mono leading-tight mt-0.5">
                                {{ ticket?.bus?.license_plate || '5051ZA20' }}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- MAIN 3-COLUMN TRIP & PASSENGER GRID -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3 my-2 pt-0.5">

                    <!-- COLUMN 1: TRIP DATA (4 cols) -->
                    <div class="md:col-span-4 space-y-1.5 pr-0 md:pr-1">
                        <div class="text-[11px] font-black uppercase text-slate-900 tracking-wide pb-1 border-b border-slate-200">
                            ДАННЫЕ ПОЕЗДКИ
                        </div>

                        <!-- Boarding Place -->
                        <div class="flex items-start gap-1.5 pt-0.5">
                            <span class="text-amber-500 text-xs mt-0.5">📍</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">МЕСТО ПОСАДКИ:</div>
                                <div class="text-[11px] font-bold text-slate-800 leading-snug">
                                    {{ ticket?.route?.fromAddress || `г. ${ticket?.route?.fromCity || ticket?.route?.pickupCity}` }}
                                </div>
                            </div>
                        </div>

                        <!-- Departure Date & Time -->
                        <div class="flex items-start gap-1.5">
                            <span class="text-amber-500 text-xs mt-0.5">📅</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">ДАТА И ВРЕМЯ ОТПРАВЛЕНИЯ:</div>
                                <div class="text-[11px] font-bold text-slate-900">
                                    {{ formatDate(ticket?.route?.departureDate) }}
                                    <span class="text-xs font-black text-amber-700 ml-1">{{ ticket?.route?.departureTime || '—' }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Destination -->
                        <div class="flex items-start gap-1.5">
                            <span class="text-slate-800 text-xs mt-0.5">🏁</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">КОНЕЧНЫЙ ПУНКТ:</div>
                                <div class="text-[11px] font-bold text-slate-800 leading-snug">
                                    {{ ticket?.route?.toAddress || `г. ${ticket?.route?.toCity || ticket?.route?.dropOffCity}` }}
                                </div>
                            </div>
                        </div>

                        <!-- Arrival Date & Time -->
                        <div class="flex items-start gap-1.5">
                            <span class="text-slate-800 text-xs mt-0.5">⏰</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">ДАТА И ВРЕМЯ ПРИБЫТИЯ:</div>
                                <div class="text-[11px] font-bold text-slate-900">
                                    {{ formatDate(ticket?.route?.arrivalDate || ticket?.route?.departureDate) }}
                                    <span class="text-xs font-black text-slate-800 ml-1">{{ ticket?.route?.arrivalTime || '—' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMN 2: PASSENGER & SEAT & FINANCIALS (4 cols, PROMINENT SEAT) -->
                    <div class="md:col-span-4 space-y-1.5 border-t md:border-t-0 md:border-l md:border-r border-dashed border-slate-300 px-0 md:px-2.5 pt-2 md:pt-0">
                        <div class="text-[11px] font-black uppercase text-slate-900 tracking-wide pb-1 border-b border-slate-200">
                            ПАССАЖИР И МЕСТО
                        </div>

                        <!-- Passenger Name -->
                        <div class="flex items-start gap-1.5 pt-0.5">
                            <span class="text-slate-800 text-xs mt-0.5">👤</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">ФИО ПАССАЖИРА:</div>
                                <div class="text-xs font-black text-slate-900 leading-tight">
                                    {{ ticket?.passenger?.primaryName }}
                                </div>
                            </div>
                        </div>

                        <!-- HIGHLY PROMINENT SEAT & FLOOR CONTAINER (1.5-2X LARGER) -->
                        <div class="bg-amber-50 border-2 border-amber-400 p-2 rounded-xl text-center shadow-sm my-1">
                            <div class="flex items-center justify-around gap-2">
                                <div>
                                    <div class="text-[9px] font-black uppercase text-amber-900 tracking-wider">
                                        МЕСТО
                                    </div>
                                    <div class="text-3xl sm:text-4xl font-black text-amber-700 leading-none mt-0.5 font-mono">
                                        {{ ticket?.passenger?.seatNumbersDisplay || '—' }}
                                    </div>
                                </div>
                                <div v-if="floorDisplay" class="border-l border-amber-300 pl-3 text-left">
                                    <div class="text-[8.5px] font-black uppercase text-amber-800">
                                        ЭТАЖ
                                    </div>
                                    <div class="text-sm font-black text-slate-900 mt-0.5">
                                        {{ floorDisplay }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Payment Breakdown -->
                        <div class="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200 space-y-0.5 text-[9.5px]">
                            <div class="flex justify-between items-center text-slate-700">
                                <span class="font-bold">💰 СТОИМОСТЬ:</span>
                                <span class="font-black text-slate-900 text-xs">{{ ticket?.payment?.totalPrice }} сомони</span>
                            </div>
                            <div class="flex justify-between items-center text-emerald-700 font-medium">
                                <span>Оплачено онлайн:</span>
                                <span class="font-bold">{{ ticket?.payment?.paidAmount }} сомони</span>
                            </div>
                            <div class="flex justify-between items-center text-amber-700 font-bold border-t border-slate-200 pt-0.5">
                                <span>К оплате перевозчику:</span>
                                <span class="font-black">{{ ticket?.payment?.remainingAmount }} сомони</span>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMN 3: SUPPORT & CARRIER CONTACTS (4 cols) -->
                    <div class="md:col-span-4 space-y-1.5 pl-0 md:pl-1 border-t md:border-t-0 border-slate-200 pt-2 md:pt-0">
                        <div class="text-[11px] font-black uppercase text-slate-900 tracking-wide pb-1 border-b border-slate-200">
                            СЛУЖБА СОПРОВОЖДЕНИЯ
                        </div>

                        <!-- Leader Name or Fallback -->
                        <div class="flex items-start gap-1.5 pt-0.5">
                            <span class="text-slate-800 text-xs mt-0.5">👤</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">СТАРШИЙ ГРУППЫ НА РЕЙСЕ:</div>
                                <div v-if="groupLeaderName" class="text-[11px] font-bold text-slate-900 leading-snug">
                                    {{ groupLeaderName }}
                                </div>
                                <div v-else class="text-[11px] font-semibold text-slate-500 italic leading-snug">
                                    Будет назначен перед отправлением
                                </div>
                            </div>
                        </div>

                        <!-- If Phone and WhatsApp are identical -->
                        <div v-if="samePhoneAndWhatsapp" class="flex items-start gap-1.5">
                            <span class="text-emerald-600 text-xs mt-0.5">💬</span>
                            <div>
                                <div class="text-[8.5px] font-black uppercase text-slate-500">ТЕЛЕФОН / WHATSAPP:</div>
                                <div class="text-xs font-bold text-slate-900 font-mono">
                                    {{ groupLeaderPhone }}
                                </div>
                            </div>
                        </div>

                        <!-- If Phone and WhatsApp are different -->
                        <template v-else>
                            <!-- Phone -->
                            <div v-if="groupLeaderPhone" class="flex items-start gap-1.5">
                                <span class="text-slate-800 text-xs mt-0.5">📞</span>
                                <div>
                                    <div class="text-[8.5px] font-black uppercase text-slate-500">ТЕЛЕФОН:</div>
                                    <div class="text-xs font-bold text-slate-900 font-mono">
                                        {{ groupLeaderPhone }}
                                    </div>
                                </div>
                            </div>

                            <!-- WhatsApp -->
                            <div v-if="groupLeaderWhatsapp" class="flex items-start gap-1.5">
                                <span class="text-emerald-600 text-xs mt-0.5">💬</span>
                                <div>
                                    <div class="text-[8.5px] font-black uppercase text-slate-500">WHATSAPP:</div>
                                    <div class="text-xs font-bold text-slate-900 font-mono">
                                        {{ groupLeaderWhatsapp }}
                                    </div>
                                </div>
                            </div>
                        </template>

                        <div class="text-[8.5px] text-slate-500 italic leading-tight pt-0.5">
                            (Обращайтесь по вопросам посадки, прохождения границы и остановок в пути)
                        </div>
                    </div>

                </div>

                <!-- RULES & SERVICE IN TRANSIT (TRUTH CHECK — ONLY ACTUAL FLEET AMENITIES) -->
                <div class="mt-2 pt-1.5 border-t border-amber-400/50">
                    <div class="text-center mb-1.5">
                        <span class="text-[9.5px] font-black tracking-wider uppercase text-slate-900 bg-white px-2 relative z-10">
                            ПРАВИЛА И СЕРВИС В ПУТИ
                        </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9.5px] sm:text-[10px] text-slate-700">
                        <!-- Rule 1: Arrival notice -->
                        <div class="flex items-start gap-1">
                            <span class="text-amber-500 font-bold">•</span>
                            <div>
                                <strong class="text-slate-900">Посадка:</strong> прибыть к месту отправления заранее.
                            </div>
                        </div>

                        <!-- Rule 2: On-board service (Fleet Truth Check) -->
                        <div class="flex items-start gap-1">
                            <span class="text-amber-500 font-bold">•</span>
                            <div>
                                <strong class="text-slate-900">Сервис на борту:</strong>
                                <div class="text-[9px] text-slate-600 mt-0.5 space-y-0.5">
                                    <div v-if="activeAmenities.includes('power_220v') || activeAmenities.includes('usb')">⚡ Розетки 220V/USB</div>
                                    <div v-if="activeAmenities.includes('wifi')">📶 Wi-Fi в пути</div>
                                    <div v-if="activeAmenities.includes('ac')">❄️ Климат-контроль</div>
                                    <div v-if="!hasAnyAmenities" class="text-slate-400 italic">Комфортабельный салон</div>
                                </div>
                            </div>
                        </div>

                        <!-- Rule 3: Amenities (Fleet Truth Check) -->
                        <div class="flex items-start gap-1">
                            <span class="text-amber-500 font-bold">•</span>
                            <div>
                                <div v-if="activeAmenities.includes('kitchen')" class="flex items-center gap-1 text-slate-800 font-bold">
                                    <span>☕</span> <span>Чай / Кофе</span>
                                </div>
                                <div v-if="activeAmenities.includes('wc')" class="flex items-center gap-1 text-slate-800 font-bold" :class="activeAmenities.includes('kitchen') ? 'mt-0.5' : ''">
                                    <span>🚻</span> <span>Биотуалет</span>
                                </div>
                                <div v-if="!activeAmenities.includes('kitchen') && !activeAmenities.includes('wc')" class="text-slate-600">
                                    <span>🛑 Санитарные остановки</span>
                                </div>
                            </div>
                        </div>

                        <!-- Rule 4: Luggage -->
                        <div class="flex items-start gap-1">
                            <span class="text-amber-500 font-bold">•</span>
                            <div>
                                <strong class="text-slate-900">Багаж:</strong> 1 ручная кладь + 2 места в багажнике.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- DARK BOTTOM FOOTER BAR (MATCHES REFERENCE) -->
                <div class="mt-2 bg-slate-950 text-white rounded-xl px-3.5 py-2 flex flex-col sm:flex-row items-center justify-between gap-1.5 shadow-sm">

                    <!-- Left: Slogan -->
                    <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                            ✓
                        </div>
                        <div>
                            <div class="text-[9.5px] font-black uppercase tracking-wide text-white leading-tight">
                                POPUTKI.ONLINE — ВАШ НАДЁЖНЫЙ ПУТЬ.
                            </div>
                            <div class="text-[8.5px] font-bold text-amber-400 tracking-wider uppercase">
                                ПРОСТО. УДОБНО. БЕЗОПАСНО.
                            </div>
                        </div>
                    </div>

                    <!-- Right: Official Contacts -->
                    <div class="flex items-center gap-2.5 text-[8.5px] text-slate-300 font-medium flex-wrap">
                        <div class="flex items-center gap-1">
                            <span>🌐</span> <span>poputki.online</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-sky-400">✈️</span> <span>@Poputkionline_bot</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-rose-400">📷</span> <span>@poputki.online</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </div>
</template>

<style scoped>
/* High-Fidelity Print Styling for A5 Landscape & A4 */
@media print {
    /* Hide surrounding chrome, modals, sidebars, buttons */
    .no-print {
        display: none !important;
    }

    body, html {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    @page {
        size: A5 landscape;
        margin: 5mm;
    }

    .ticket-wrapper {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    .ticket-outer-frame {
        max-width: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: 2px solid #f59e0b !important;
        border-radius: 16px !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
    }

    .ticket-inner-box {
        border: 1.5px solid #f59e0b !important;
        border-radius: 12px !important;
        padding: 8px 12px !important;
    }
}
</style>
