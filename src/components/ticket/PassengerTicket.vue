<script>
import { generateQRCodeSVG } from '../../utils/qrCode';

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
    computed: {
        qrSvg() {
            if (!this.ticket?.verificationUrl) return '';
            return generateQRCodeSVG(this.ticket.verificationUrl, 160);
        },
        statusBadgeClass() {
            if (this.ticket?.status === 'confirmed') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
            if (this.ticket?.status === 'pending_payment') return 'bg-amber-100 text-amber-900 border-amber-300';
            if (this.ticket?.status === 'cancelled') return 'bg-rose-100 text-rose-900 border-rose-300';
            return 'bg-slate-100 text-slate-800 border-slate-300';
        },
        boardingBadgeClass() {
            if (this.ticket?.boardingStatus === 'boarded') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
            if (this.ticket?.boardingStatus === 'no_show') return 'bg-rose-50 text-rose-800 border-rose-200';
            return 'bg-sky-50 text-sky-800 border-sky-200';
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
        }
    }
};
</script>

<template>
    <div class="ticket-container" :class="mode === 'print' ? 'is-print-mode' : 'is-screen-mode'">
        
        <!-- Screen Modal Controls Bar (Hidden during window.print) -->
        <div v-if="mode === 'screen' && showControls" class="no-print flex items-center justify-between gap-3 mb-4 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-md">
            <div class="flex items-center gap-2">
                <span class="text-amber-400 font-black">POPUTKI.ONLINE</span>
                <span class="text-xs text-slate-300">• Электронный билет</span>
            </div>
            <div class="flex items-center gap-2">
                <button 
                    @click="printTicket"
                    class="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                >
                    <span>🖨</span>
                    <span>Печать билета</span>
                </button>
                <button 
                    @click="$emit('close')"
                    class="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-all active:scale-95"
                    title="Закрыть"
                >
                    ✕
                </button>
            </div>
        </div>

        <!-- The Ticket Card Content (Formatted for Screen & Print) -->
        <div class="ticket-card bg-white text-slate-900 rounded-[24px] border-2 border-slate-800 overflow-hidden shadow-xl print:shadow-none print:rounded-none print:border-2 print:border-black">
            
            <!-- Ticket Top Header -->
            <div class="ticket-header bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b-2 border-slate-800 print:bg-black print:text-white">
                <div class="flex items-center gap-3">
                    <div class="text-xl sm:text-2xl font-black tracking-wider uppercase text-amber-400 print:text-white">
                        POPUTKI.ONLINE
                    </div>
                    <span class="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-200">
                        Электронный билет
                    </span>
                </div>
                <div class="text-right">
                    <div class="text-[10px] uppercase font-bold text-slate-400 print:text-slate-200">№ БИЛЕТА</div>
                    <div class="text-base sm:text-lg font-mono font-black text-amber-300 print:text-white">
                        {{ ticket?.ticketNumber || 'POP-000000' }}
                    </div>
                </div>
            </div>

            <!-- Main Route & Schedule Banner -->
            <div class="px-6 py-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:bg-white print:border-black">
                <div>
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Маршрут рейса</div>
                    <div class="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>{{ ticket?.route?.fromCity }}</span>
                        <span class="text-amber-500 print:text-black">➡</span>
                        <span>{{ ticket?.route?.toCity }}</span>
                    </div>
                    <div v-if="ticket?.route?.pickupCity !== ticket?.route?.fromCity || ticket?.route?.dropOffCity !== ticket?.route?.toCity" class="text-xs text-slate-600 font-semibold mt-1">
                        Посадка: <span class="font-bold text-slate-800">{{ ticket?.route?.pickupCity }}</span> • Высадка: <span class="font-bold text-slate-800">{{ ticket?.route?.dropOffCity }}</span>
                    </div>
                </div>

                <!-- Prominent Status Badges -->
                <div class="flex items-center gap-2 shrink-0">
                    <span 
                        :class="statusBadgeClass"
                        class="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wide inline-flex items-center gap-1.5"
                    >
                        <span>{{ ticket?.isValid ? '✓' : '⏳' }}</span>
                        <span>{{ ticket?.statusLabel }}</span>
                    </span>
                    <span 
                        v-if="ticket?.isValid"
                        :class="boardingBadgeClass"
                        class="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wide"
                    >
                        {{ ticket?.boardingLabel }}
                    </span>
                </div>
            </div>

            <!-- Body Grid: Passenger, Date, Bus, Seat & QR -->
            <div class="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 print:grid-cols-12 print:gap-4">
                
                <!-- Left Column: Details (8 cols) -->
                <div class="md:col-span-8 print:col-span-8 space-y-4">
                    
                    <!-- Row 1: Departure Time & Date -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 print:bg-white print:border-black">
                        <div>
                            <div class="text-[10px] font-extrabold uppercase text-slate-500">Дата отправления</div>
                            <div class="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                                {{ formatDate(ticket?.route?.departureDate) }}
                            </div>
                        </div>
                        <div>
                            <div class="text-[10px] font-extrabold uppercase text-slate-500">Время отправления</div>
                            <div class="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                                {{ ticket?.route?.departureTime || '—' }}
                            </div>
                        </div>
                        <div v-if="ticket?.route?.arrivalTime" class="col-span-2 sm:col-span-1">
                            <div class="text-[10px] font-extrabold uppercase text-slate-500">Прибытие (ориент.)</div>
                            <div class="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                                {{ ticket?.route?.arrivalTime }}
                            </div>
                        </div>
                    </div>

                    <!-- Row 2: Passengers & Seats -->
                    <div class="border border-slate-200 rounded-2xl p-4 bg-white print:border-black">
                        <div class="text-[10px] font-extrabold uppercase text-slate-500 mb-2 flex items-center justify-between">
                            <span>Пассажир(ы) и Места</span>
                            <span>Всего мест: {{ ticket?.passenger?.passengerCount || 1 }}</span>
                        </div>

                        <div class="space-y-2">
                            <div 
                                v-for="(p, idx) in ticket?.passenger?.items || []" 
                                :key="idx"
                                class="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100 print:bg-white print:border-slate-300"
                            >
                                <div class="flex items-center gap-3">
                                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-400 text-slate-950 font-black text-xs print:bg-black print:text-white">
                                        {{ p.seat }}
                                    </span>
                                    <div>
                                        <div class="font-bold text-sm text-slate-900">{{ p.name }}</div>
                                        <div v-if="p.docType && p.docNumber && p.docNumber !== '—'" class="text-[11px] text-slate-500">
                                            {{ p.docType }}: {{ p.docNumber }}
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right text-xs font-bold text-slate-700">
                                    Место: {{ p.seat }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Row 3: Bus / Vehicle Info -->
                    <div v-if="ticket?.bus" class="border border-slate-200 rounded-2xl p-4 bg-slate-50 print:bg-white print:border-black">
                        <div class="text-[10px] font-extrabold uppercase text-slate-500 mb-1">Автобус / Транспорт</div>
                        <div class="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                                <span class="font-bold text-sm text-slate-900">
                                    {{ ticket?.bus?.brand || 'Автобус' }} {{ ticket?.bus?.model || '' }}
                                </span>
                                <span v-if="ticket?.bus?.license_plate" class="ml-2 font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-xs print:border-black">
                                    {{ ticket?.bus?.license_plate }}
                                </span>
                            </div>
                            <div class="text-xs text-slate-600 font-semibold">
                                {{ ticket?.bus?.bus_type === 'double' ? 'Двухэтажный автобус' : 'Одноэтажный автобус' }}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Right Column: Big Seat, Financials & QR (4 cols) -->
                <div class="md:col-span-4 print:col-span-4 flex flex-col justify-between space-y-4 border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 print:border-l print:border-black print:pl-4">
                    
                    <!-- Prominent Seat Box -->
                    <div class="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl text-center print:bg-white print:border-2 print:border-black">
                        <div class="text-[10px] font-black uppercase text-amber-900 tracking-wider print:text-black">
                            {{ (ticket?.passenger?.seats?.length || 0) > 1 ? 'ВАШИ МЕСТА' : 'ВАШЕ МЕСТО' }}
                        </div>
                        <div class="text-3xl sm:text-4xl font-black text-slate-950 mt-1">
                            {{ ticket?.passenger?.seatNumbersDisplay || '—' }}
                        </div>
                    </div>

                    <!-- Payment Summary Box -->
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2 text-xs print:bg-white print:border-black">
                        <div class="text-[10px] font-extrabold uppercase text-slate-500 mb-1">Расчет стоимости</div>
                        <div class="flex justify-between items-center text-slate-700">
                            <span>Стоимость поездки:</span>
                            <span class="font-bold text-slate-900">{{ ticket?.payment?.totalPrice }} сомони</span>
                        </div>
                        <div class="flex justify-between items-center text-emerald-700 font-semibold">
                            <span>Оплачено онлайн:</span>
                            <span class="font-bold">{{ ticket?.payment?.paidAmount }} сомони</span>
                        </div>
                        <div class="border-t border-slate-200 pt-1 flex justify-between items-center font-black text-slate-900 text-sm">
                            <span>Остаток перевозчику:</span>
                            <span class="text-amber-600 print:text-black">{{ ticket?.payment?.remainingAmount }} сомони</span>
                        </div>
                    </div>

                    <!-- Vector QR Code Verification Box -->
                    <div class="border-2 border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center justify-center text-center bg-white print:border-black">
                        <div class="w-28 h-28 sm:w-32 sm:h-32 mb-2 flex items-center justify-center" v-html="qrSvg"></div>
                        <div class="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">QR-проверка билета</div>
                        <div class="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-full">
                            {{ ticket?.verificationToken }}
                        </div>
                    </div>

                </div>

            </div>

            <!-- Perforated Cutout Divider Line -->
            <div class="relative w-full h-6 flex items-center bg-slate-100 print:bg-white print:border-t print:border-b print:border-dashed print:border-black">
                <div class="absolute -left-3 w-6 h-6 rounded-full bg-slate-200 border border-slate-300 z-10 print:hidden"></div>
                <div class="w-full border-t-2 border-dashed border-slate-300 print:border-black"></div>
                <div class="absolute -right-3 w-6 h-6 rounded-full bg-slate-200 border border-slate-300 z-10 print:hidden"></div>
            </div>

            <!-- Ticket Footer -->
            <div class="px-6 py-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500 border-t border-slate-200 print:bg-white print:border-black">
                <div>
                    🏢 Перевозчик: <span class="font-bold text-slate-800">{{ ticket?.carrier?.companyName || 'POPUTKI.ONLINE' }}</span>
                </div>
                <div class="text-center sm:text-right font-medium">
                    POPUTKI.ONLINE — информационный сервис (агрегатор), а не перевозчик
                </div>
            </div>

        </div>

    </div>
</template>

<style scoped>
/* High-quality monochrome print rules */
@media print {
    .no-print {
        display: none !important;
    }
    .ticket-container {
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
    }
    .ticket-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        border: 2px solid black !important;
        box-shadow: none !important;
        margin-bottom: 20px !important;
    }
}
</style>
