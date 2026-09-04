<script>
import api from '../api';
import BusSeatSelector from '../components/BusSeatSelector.vue';
import AppModal from '../components/AppModal.vue';
import { compressImage } from '../utils/imageCompression';
import acquisitionService from '../services/acquisitionService';

const STATE_KEY = (id) => `bus_booking_${id}`;

export default {
    name: 'BusBookingView',
    components: { BusSeatSelector, AppModal },
    data() {
        return {
            ticket: null,
            loading: true,
            bookingLoading: false,
            user: JSON.parse(localStorage.getItem('user') || 'null'),

            // Persisted state
            passengerCount: 1,
            selectedSeats: [],
            passengersData: [],
            phone: '',
            countries: [
                "Таджикистан", "Россия", "Узбекистан", "Казахстан", "Кыргызстан", 
                "Туркменистан", "Беларусь", "Армения", "Азербайджан", "Грузия",
                "Турция", "ОАЭ", "США", "Китай", "Германия", "Другое"
            ],
            pickupCity: '',
            dropOffCity: '',
            ocrLoadingIndex: -1,

            modal: { show: false, title: '', message: '', type: 'info', confirmText: 'ОК', showCancel: false, showBotLink: false, onConfirm: null }
        };
    },
    computed: {
        step() {
            return Number(this.$route.params.step) || 1;
        },
        ticketId() {
            return this.$route.params.id;
        },
        bookedSeats() {
            return this.ticket?.bookedSeats || [];
        },
        availableSeats() {
            if (!this.ticket) return 0;
            return this.ticket.total_seats - this.bookedSeats.length;
        },
        formattedDuration() {
            if (!this.ticket) return '';
            const h = Math.floor(this.ticket.duration_minutes / 60);
            const m = this.ticket.duration_minutes % 60;
            return `${h} ч.${m > 0 ? ' ' + m + ' м.' : ''}`;
        },
        totalPrice() {
            if (!this.ticket) return 0;
            // Dynamically compute premium seat numbers based on floor layout
            const f2 = this.ticket.floor2_seats || 56;
            const f1 = this.ticket.floor1_seats || 20;
            const floor2Front = [1, 2, 3, 4];
            const tableStart = f2 + Math.ceil(f1 / 2) - 3;
            const floor1Table = [];
            for (let i = tableStart; i < tableStart + 8; i++) {
                if (i > f2 && i <= f2 + f1) floor1Table.push(i);
            }
            const defaultVIP = [...floor2Front, ...floor1Table];
            const premiumSeatNums = this.ticket.premiumSeats?.length > 0
                ? [...new Set([...this.ticket.premiumSeats, ...defaultVIP])]
                : (this.ticket.bus_type === 'double' ? defaultVIP : []);
            const premiumPrice = this.ticket.premium_price || this.ticket.price;
            let total = 0;
            for (const seatNum of this.selectedSeats) {
                total += premiumSeatNums.includes(seatNum) ? premiumPrice : this.ticket.price;
            }
            // If no seats selected yet, show estimate for regular price
            if (this.selectedSeats.length === 0) {
                return this.ticket.price * this.passengerCount;
            }
            return total;
        },
        platformFee() {
            const pct = (this.ticket?.service_fee_percent ?? 10);
            return Math.round(this.totalPrice * pct / 100);
        },
        feePercent() {
            return this.ticket?.service_fee_percent ?? 10;
        },
        canProceedStep1() {
            return this.selectedSeats.length === this.passengerCount;
        },
        canProceedStep2() {
            return this.passengersData.every(p =>
                p.gender && p.lastName && p.firstName && p.birthDate &&
                p.citizenship && (p.citizenship !== 'Другое' || p.customCitizenship?.trim()) &&
                p.docType && p.docNumber
            ) && this.phone && this.pickupCity && this.dropOffCity;
        },
        allRouteCities() {
            if (!this.ticket) return [];
            const stops = this.ticket.intermediate_stops || [];
            return [this.ticket.from_city, ...stops.map(s => s.city), this.ticket.to_city];
        },
        stepTitle() {
            return ['', 'Выбор мест', 'Данные пассажиров', 'Подтверждение'][this.step] || '';
        }
    },
    methods: {
        showAlert(title, message, type = 'info', onConfirm = null, showBotLink = false) {
            this.modal = { 
                show: true, title, message, type, confirmText: 'ОК', showCancel: false, showBotLink, 
                onConfirm: () => {
                    this.modal.show = false;
                    if (onConfirm) onConfirm();
                }
            };
        },

        saveState() {
            sessionStorage.setItem(STATE_KEY(this.ticketId), JSON.stringify({
                passengerCount: this.passengerCount,
                selectedSeats: this.selectedSeats,
                passengersData: this.passengersData,
                phone: this.phone,
                pickupCity: this.pickupCity,
                dropOffCity: this.dropOffCity
            }));
        },

        filterPhone(event) {
            this.phone = event.target.value.replace(/\D/g, '');
            this.saveState();
        },

        onlyNumber(event) {
            if (event.key && !/[0-9]/.test(event.key)) {
                event.preventDefault();
            }
        },

        loadState() {
            try {
                const raw = sessionStorage.getItem(STATE_KEY(this.ticketId));
                if (raw) {
                    const s = JSON.parse(raw);
                    this.passengerCount = s.passengerCount || 1;
                    this.selectedSeats = s.selectedSeats || [];
                    this.passengersData = s.passengersData || this.buildPassengersData(this.passengerCount);
                    this.phone = s.phone || '';
                    this.pickupCity = s.pickupCity || this.ticket?.from_city || '';
                    this.dropOffCity = s.dropOffCity || this.ticket?.to_city || '';
                } else {
                    this.passengersData = this.buildPassengersData(1);
                    this.pickupCity = this.ticket?.from_city || '';
                    this.dropOffCity = this.ticket?.to_city || '';
                }
            } catch {
                this.passengersData = this.buildPassengersData(1);
            }
        },

        async fetchTicket() {
            this.loading = true;
            try {
                const res = await api.get(`/bus-tickets/${this.ticketId}`);
                this.ticket = res.data;
            } catch (e) {
                if (e.response?.status === 401) {
                    this.showAlert('Внимание', 'Приложение работает правильно в телеграм боте', 'info', () => {
                        this.modal.show = false;
                    }, true);
                } else {
                    this.showAlert('Ошибка', 'Ошибка загрузки билета', 'error', () => {
                        this.modal.show = false;
                        this.$router.push('/');
                    });
                }
            } finally {
                this.loading = false;
            }
        },

        buildPassengersData(count) {
            return Array.from({ length: count }, (_, i) => ({
                index: i + 1,
                isExpanded: false,
                gender: '',
                lastName: '',
                firstName: '',
                middleName: '',
                birthDate: '',
                citizenship: 'Таджикистан',
                customCitizenship: '',
                docType: 'Загран паспорт',
                docNumber: '',
            }));
        },

        onPassengerCountChange() {
            this.selectedSeats = [];
            this.passengersData = this.buildPassengersData(this.passengerCount);
            this.saveState();
        },

        goBack() {
            if (this.step === 1) {
                this.$router.push({ name: 'bus-ticket-details', params: { id: this.ticketId } });
            } else {
                this.saveState();
                this.$router.push({ name: 'bus-booking', params: { id: this.ticketId, step: this.step - 1 } });
            }
        },

        goToStep2() {
            if (!this.canProceedStep1) {
                this.showAlert('Внимание', `Выберите ${this.passengerCount} место(а) на схеме`, 'warning');
                return;
            }
            this.saveState();
            this.$router.push({ name: 'bus-booking', params: { id: this.ticketId, step: 2 } });
        },

        goToStep3() {
            if (!this.canProceedStep2) {
                this.showValidationErrors = true;
                this.showAlert('Внимание', 'Пожалуйста, заполните все обязательные поля (отмечены *) для каждого пассажира, включая пол и контактный телефон.', 'warning');
                return;
            }
            this.showValidationErrors = false;
            this.saveState();
            this.$router.push({ name: 'bus-booking', params: { id: this.ticketId, step: 3 } });
        },

        async confirmBooking() {
            this.bookingLoading = true;
            try {
                let attribution = null;
                try {
                    const raw = sessionStorage.getItem(`booking_attribution_${this.ticketId}`);
                    if (raw) {
                        attribution = JSON.parse(raw);
                    }
                } catch (e) {
                    console.error('Error reading attribution:', e);
                }

                const attrCtx = acquisitionService.getAttributionContext();
                const payload = {
                    bus_ticket_id: Number(this.ticketId),
                    passenger_id: this.user.id,
                    seat_numbers: this.selectedSeats,
                    passengers_data: this.passengersData,
                    phone: this.phone,
                    pickup_city: this.pickupCity,
                    drop_off_city: this.dropOffCity,
                    channel: attribution?.channel || 'web',
                    source_type: attribution?.source_type || 'direct',
                    source_id: attribution?.source_id || null,
                    anonymous_visitor_id: attrCtx.anonymous_visitor_id,
                    session_id: attrCtx.session_id
                };

                const res = await api.post('/payments/create-invoice', payload);
                sessionStorage.removeItem(STATE_KEY(this.ticketId));
                sessionStorage.removeItem(`booking_attribution_${this.ticketId}`);
                // Redirect to SmartPay payment page
                window.location.href = res.data.payment_link;
            } catch (e) {
                if (e.response?.status === 401) {
                    this.showAlert('Внимание', 'Приложение работает правильно в телеграм боте', 'info', () => {
                        this.modal.show = false;
                    }, true);
                } else {
                    this.showAlert('Ошибка', e.response?.data?.error || 'Ошибка при создании платежа', 'error', () => {
                        this.modal.show = false;
                    });
                }
            } finally {
                this.bookingLoading = false;
            }
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
        },

        triggerScanner(index) {
            this.ocrLoadingIndex = index;
            this.$refs.passportInput.click();
        },

        async handlePassportUpload(event) {
            const targetIndex = this.ocrLoadingIndex;
            if (targetIndex === -1) return;

            const file = event.target.files[0];
            if (!file) {
                this.ocrLoadingIndex = -1;
                return;
            }

            try {
                // 1. Compress image to < 200KB (OCR API recommendation)
                const compressedDataUri = await compressImage(file, {
                    maxWidth: 1200,
                    maxHeight: 1200,
                    quality: 0.6
                });

                // Send the full data URI so the API can identify image type
                const base64 = compressedDataUri;
                const sizeKB = Math.round(compressedDataUri.split(',')[1].length * 0.75 / 1024);
                console.log('[OCR] Compressed image size:', sizeKB, 'KB');

                // 2. Call OCR via Supabase Edge Function proxy
                const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-passport`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ img: base64 })
                });

                const data = await ocrRes.json();
                console.log('[OCR] Response:', data);

                if (data.status !== 'OK') {
                    throw new Error(data.message || 'OCR recognition failed');
                }

                // 4. Map response to passenger format
                const msg = data.message;
                console.log('[OCR] Mapping message:', msg);

                // Parse name
                let lastName = msg.surname || msg.lastName || msg.last_name || '';
                let firstName = msg.givenName || msg.given_name || msg.firstName || msg.first_name || '';
                
                if (!lastName && !firstName && msg.name) {
                    const cleanName = msg.name.replace(/<+/g, ' ').replace(',', '').trim();
                    const nameParts = cleanName.split(/\s+/);
                    lastName = nameParts[0] || '';
                    firstName = nameParts.slice(1).join(' ') || '';
                }

                // Parse birthDay "YYYYMMDD" or "YYYY-MM-DD" → "YYYY-MM-DD"
                const rawBirth = msg.birthDay || msg.birth_day || msg.dateOfBirth || msg.date_of_birth;
                let birthDate = '';
                if (rawBirth) {
                    if (rawBirth.includes('-')) {
                        birthDate = rawBirth;
                    } else if (rawBirth.length === 8) {
                        birthDate = `${rawBirth.slice(0, 4)}-${rawBirth.slice(4, 6)}-${rawBirth.slice(6, 8)}`;
                    }
                }

                // Map nationality codes/names to Russian names
                const natMap = {
                    'TJK': 'Таджикистан', 'TAJIKISTAN': 'Таджикистан',
                    'RUS': 'Россия', 'RUSSIA': 'Россия',
                    'UZB': 'Узбекистан', 'UZBEKISTAN': 'Узбекистан',
                    'KAZ': 'Казахстан', 'KAZAKHSTAN': 'Казахстан',
                    'KGZ': 'Кыргызстан', 'KYRGYZSTAN': 'Кыргызстан',
                    'TKM': 'Туркменистан', 'TURKMENISTAN': 'Туркменистан',
                    'BLR': 'Беларусь', 'BELARUS': 'Беларусь',
                    'UKR': 'Украина', 'UKRAINE': 'Украина',
                    'AZE': 'Азербайджан', 'AZERBAIJAN': 'Азербайджан',
                    'ARM': 'Армения', 'ARMENIA': 'Армения',
                    'GEO': 'Грузия', 'GEORGIA': 'Грузия'
                };
                const rawNat = (msg.nationality || msg.country || '').toUpperCase();
                const citizenship = natMap[rawNat] || (msg.nationality || msg.country);

                // 5. Fill passenger data
                const p = { ...this.passengersData[targetIndex] };
                if (lastName) p.lastName = lastName;
                if (firstName) p.firstName = firstName;
                if (birthDate) p.birthDate = birthDate;
                
                const docNum = msg.passportNumber || msg.passport_number || msg.doc_number;
                if (docNum) p.docNumber = docNum;
                
                const rawGender = msg.gender || msg.sex;
                if (rawGender) {
                    p.gender = (rawGender === 'M' || rawGender === 'MALE') ? 'male' : 
                               (rawGender === 'F' || rawGender === 'FEMALE') ? 'female' : '';
                }
                
                if (citizenship) {
                    // Check if citizenship exists in our predefined list, if not set to 'Другое'
                    if (this.countries.includes(citizenship)) {
                        p.citizenship = citizenship;
                    } else {
                        p.citizenship = 'Другое';
                        p.customCitizenship = citizenship;
                    }
                }
                
                p.docType = 'Загран паспорт';
                p.isExpanded = true;

                // Use splice to ensure Vue reactivity
                this.passengersData.splice(targetIndex, 1, p);

                this.saveState();
            } catch (e) {
                console.error('OCR Error:', e);
                this.showAlert('Ошибка', e.message || 'Не удалось распознать паспорт. Попробуйте еще раз или введите данные вручную.', 'error');
            } finally {
                this.ocrLoadingIndex = -1;
                event.target.value = '';
            }
        }
    },

    async mounted() {
        if (!this.user) {
            this.$router.replace('/auth');
            return;
        }
        acquisitionService.trackBookingStarted({ bus_ticket_id: Number(this.ticketId) });
        await this.fetchTicket();
        this.loadState();
    },

    watch: {
        // When step changes via router, reload state
        '$route.params.step'() {
            this.loadState();
        }
    }
};
</script>

<template>
    <div class="min-h-screen bg-slate-50 pb-10">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center h-screen">
            <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>

        <template v-else-if="ticket">
            <!-- Header -->
            <div class="bg-gradient-to-br from-blue-600 to-indigo-700 px-5 pt-14 pb-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>

                <!-- Back + Title row -->
                <div class="flex items-center gap-4 relative z-10 mb-5">
                    <button @click="goBack"
                        class="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shrink-0">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="flex-1">
                        <p class="text-white/60 text-xs font-medium">{{ ticket.from_city }} → {{ ticket.to_city }}</p>
                        <h1 class="text-white text-xl font-bold">{{ stepTitle }}</h1>
                    </div>
                    <!-- Step badge -->
                    <div class="bg-white/20 backdrop-blur px-3 py-1 rounded-full shrink-0">
                        <span class="text-white text-xs font-bold">{{ step }} / 3</span>
                    </div>
                </div>

                <!-- Progress bar -->
                <div class="flex gap-2 relative z-10">
                    <div v-for="s in [1,2,3]" :key="s"
                        class="flex-1 h-1 rounded-full transition-all duration-500"
                        :class="step >= s ? 'bg-white' : 'bg-white/25'">
                    </div>
                </div>
            </div>

            <!-- ANIMATED STEPS CONTAINER -->
            <Transition name="fade-slide" mode="out-in">
                <div :key="step">
                    <!-- ============================================================ -->
                    <!-- STEP 1: SEAT SELECTION -->
                    <!-- ============================================================ -->
                    <div v-if="step === 1" class="px-5 pt-6 pb-6">
                        <!-- Ticket mini-card -->
                        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 flex items-center justify-between">
                            <div>
                                <div class="text-xs text-gray-400 font-medium">Отправление</div>
                                <div class="font-bold text-slate-800 text-lg">{{ ticket.departure_time }} · {{ ticket.departure_date }}</div>
                                <div class="text-sm text-gray-500">{{ ticket.from_address }}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-gray-400 font-medium">Сумма (1 пасс)</div>
                                <div class="font-bold text-blue-600 text-lg">{{ ticket.price }} с.</div>
                                <div v-if="ticket.premium_price && ticket.bus_type === 'double'" class="text-xs text-amber-500 font-bold">★ {{ ticket.premium_price }} с.</div>
                                <div class="text-xs text-gray-400">{{ availableSeats }} из {{ ticket.total_seats }} мест</div>
                            </div>
                        </div>

                        <!-- Passenger count selector -->
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 transition-all hover:border-blue-100">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="font-bold text-slate-800">Количество пассажиров</div>
                                    <div class="text-sm text-gray-400 mt-0.5">Итого: {{ totalPrice }} с.</div>
                                </div>
                                <div class="flex items-center gap-4">
                                    <button
                                        @click="if(passengerCount > 1){ passengerCount--; onPassengerCountChange(); }"
                                        class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xl transition-colors active:bg-slate-200">
                                        −
                                    </button>
                                    <span class="text-2xl font-bold text-slate-800 w-8 text-center">{{ passengerCount }}</span>
                                    <button
                                        @click="if(passengerCount < Math.min(6, availableSeats)){ passengerCount++; onPassengerCountChange(); }"
                                        class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/30 transition-colors active:bg-blue-700">
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Seat map -->
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                            <h3 class="font-bold text-slate-700 mb-4">Схема салона</h3>
                            <BusSeatSelector
                                v-model="selectedSeats"
                                :bookedSeats="bookedSeats"
                                :seatGenders="ticket.seatGenders"
                                :totalSeats="ticket.total_seats"
                                :floor1Seats="ticket.floor1_seats || 20"
                                :floor2Seats="ticket.floor2_seats || 56"
                                :maxSelectable="passengerCount"
                                :busType="ticket.bus_type"
                                :premiumSeats="ticket.premiumSeats || []"
                                :premiumPrice="ticket.premium_price || 0"
                                :regularPrice="ticket.price || 0"
                            />
                        </div>

                        <!-- Selected summary chip -->
                        <Transition name="fade">
                            <div v-if="selectedSeats.length > 0"
                                class="mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700 font-semibold text-center">
                                ✓ Выбраны места: {{ [...selectedSeats].sort((a,b) => a-b).join(', ') }}
                                <span class="text-blue-400 font-medium">({{ selectedSeats.length }} из {{ passengerCount }})</span>
                            </div>
                        </Transition>
                    </div>

                    <!-- ============================================================ -->
                    <!-- STEP 2: PASSENGER DATA -->
                    <!-- ============================================================ -->
                    <div v-if="step === 2" class="px-5 pt-6 pb-6 space-y-4">
                        <!-- Route Selection -->
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                            <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                Где вы сядете и где выйдете?
                            </h3>
                            <div class="grid grid-cols-1 gap-4">
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Город посадки *</label>
                                    <div class="relative">
                                        <select v-model="pickupCity" @change="saveState"
                                            class="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium appearance-none cursor-pointer pr-10">
                                            <option v-for="city in allRouteCities" :key="'pickup-'+city" :value="city">{{ city }}</option>
                                        </select>
                                        <svg class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Город высадки *</label>
                                    <div class="relative">
                                        <select v-model="dropOffCity" @change="saveState"
                                            class="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium appearance-none cursor-pointer pr-10">
                                            <option v-for="city in allRouteCities" :key="'dropoff-'+city" :value="city">{{ city }}</option>
                                        </select>
                                        <svg class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Hidden File Input -->
                        <input type="file" ref="passportInput" class="hidden" accept="image/*" @change="handlePassportUpload" />

                        <div v-for="(p, i) in passengersData" :key="i"
                            class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <!-- Card header -->
                            <div class="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{{ i + 1 }}</div>
                                    <div>
                                        <div class="font-bold text-slate-800 text-sm">Пассажир {{ i + 1 }}</div>
                                        <div class="text-xs text-gray-400">Место {{ [...selectedSeats].sort((a,b)=>a-b)[i] }}</div>
                                    </div>
                                </div>
                                <div v-if="p.gender" class="text-xs font-bold px-3 py-1.5 rounded-full"
                                    :class="p.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'">
                                    {{ p.gender === 'male' ? '♂ Мужчина' : '♀ Женщина' }}
                                </div>
                            </div>

                            <div class="p-5 space-y-3">
                                <!-- OCR Scanner for this passenger (Small, if expanded) -->
                                <div v-if="p.isExpanded" class="bg-blue-50/50 rounded-xl p-3 flex items-center justify-between border border-blue-100/50 mb-2">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                            <svg v-if="ocrLoadingIndex !== i" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                            <div v-else class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <div>
                                            <div class="text-xs font-bold text-slate-700">Заполнить по паспорту</div>
                                            <div class="text-[10px] text-gray-500">Автоматически из фото</div>
                                        </div>
                                    </div>
                                    <button @click="triggerScanner(i)" :disabled="ocrLoadingIndex !== -1"
                                        class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all disabled:opacity-50">
                                        {{ ocrLoadingIndex === i ? 'Загрузка...' : 'Скан' }}
                                    </button>
                                </div>

                                <!-- Big Scanner if not expanded -->
                                <div v-else class="bg-slate-50 rounded-2xl p-6 border border-gray-100 text-center">
                                    <div class="w-16 h-16 mx-auto bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                                        <svg v-if="ocrLoadingIndex !== i" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                        <div v-else class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                    <h3 class="font-black text-slate-800 text-lg mb-1">Сканировать паспорт</h3>
                                    <p class="text-sm text-gray-500 mb-5">Автоматическое заполнение всех данных</p>
                                    <button @click="triggerScanner(i)" :disabled="ocrLoadingIndex !== -1"
                                        class="w-full py-4 bg-slate-900 text-white rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50">
                                        {{ ocrLoadingIndex === i ? 'Распознаем...' : 'Выбрать фото паспорта' }}
                                    </button>
                                    <button @click="p.isExpanded = true; saveState()" class="mt-4 text-xs font-bold text-blue-600 tracking-wider uppercase inline-flex items-center gap-1">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                        Заполнить вручную
                                    </button>
                                </div>

                                <!-- Expandable Forms block -->
                                <div v-if="p.isExpanded" class="space-y-3 animate-fade-in-down">
                                    <!-- Gender -->
                                <div class="grid grid-cols-2 gap-2">
                                    <button @click="p.gender = 'male'; saveState()"
                                        :class="[
                                            p.gender === 'male' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'border-gray-200 text-gray-500 bg-white',
                                            showValidationErrors && !p.gender ? 'border-red-400 bg-red-50' : ''
                                        ]"
                                        class="py-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                                        Мужчина
                                    </button>
                                    <button @click="p.gender = 'female'; saveState()"
                                        :class="[
                                            p.gender === 'female' ? 'bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-500/20' : 'border-gray-200 text-gray-500 bg-white',
                                            showValidationErrors && !p.gender ? 'border-red-400 bg-red-50' : ''
                                        ]"
                                        class="py-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                                        Женщина
                                    </button>
                                </div>

                                <!-- Surname -->
                                <div class="relative">
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Фамилия *</label>
                                    <input v-model="p.lastName" @input="saveState" type="text" placeholder="Иванов"
                                        class="w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium"
                                        :class="showValidationErrors && !p.lastName ? 'border-red-400 bg-red-50' : 'border-gray-200'"/>
                                </div>

                                <!-- Name + Patronymic -->
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Имя *</label>
                                        <input v-model="p.firstName" @input="saveState" type="text" placeholder="Иван"
                                            class="w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium"
                                        :class="showValidationErrors && !p.firstName ? 'border-red-400 bg-red-50' : 'border-gray-200'"/>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Отчество</label>
                                        <input v-model="p.middleName" @input="saveState" type="text" placeholder="Иванович"
                                            class="w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium"
                                        :class="showValidationErrors && !p.middleName ? 'border-red-400 bg-red-50' : 'border-gray-200'"/>
                                    </div>
                                </div>

                                <!-- Birth date -->
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Дата рождения *</label>
                                    <input v-model="p.birthDate" @change="saveState" type="date"
                                        class="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium"
                                        :class="showValidationErrors && !p.birthDate ? 'border-red-400 bg-red-50' : 'border-gray-200'"/>
                                </div>

                                <!-- Citizenship -->
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Гражданство *</label>
                                    <div class="relative">
                                        <select v-model="p.citizenship" @change="saveState"
                                            class="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium appearance-none cursor-pointer pr-10"
                                            :class="showValidationErrors && !p.citizenship ? 'border-red-400 bg-red-50' : 'border-gray-200'">
                                            <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
                                        </select>
                                        <svg class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                    <input v-if="p.citizenship === 'Другое'" v-model="p.customCitizenship" @input="saveState" type="text" placeholder="Введите название страны"
                                        class="w-full mt-2 px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium"/>
                                </div>

                                <!-- Doc type -->
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Тип документа *</label>
                                    <div class="relative">
                                        <select v-model="p.docType" @change="saveState"
                                            class="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium appearance-none cursor-pointer pr-10">
                                            <option>Загран паспорт</option>
                                            <option>Внутренний паспорт</option>
                                            <option>Свидетельство о рождении</option>
                                        </select>
                                        <svg class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                </div>

                                <!-- Doc number -->
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Серия / Номер документа *</label>
                                    <input v-model="p.docNumber" @input="saveState" type="text" placeholder="АА 1234567"
                                        class="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium tracking-widest"
                                        :class="showValidationErrors && !p.docNumber ? 'border-red-400 bg-red-50' : 'border-gray-200'"/>
                                </div>
                                </div>
                            </div>
                        </div>

                        <!-- Contact phone (shared) -->
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                            <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Контактный телефон *</label>
                            <div class="relative">
                                <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none">📞</div>
                                <input v-model="phone" @input="filterPhone" @keypress="onlyNumber" type="number" placeholder="Номер телефона (только цифры)"
                                    class="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl text-slate-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-medium"/>
                            </div>
                        </div>
                    </div>

                    <!-- ============================================================ -->
                    <!-- STEP 3: REVIEW & CONFIRM -->
                    <!-- ============================================================ -->
                    <div v-if="step === 3" class="px-5 pt-7 pb-10 space-y-6">
                        <!-- Ticket Preview (Minimalist Perforated Design) -->
                        <div class="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-gray-100 overflow-hidden relative">
                            <!-- Ticket Header / Top Part -->
                            <div class="px-7 py-6 border-b-2 border-dashed border-gray-100 relative">
                                <div class="flex items-center justify-between mb-6">
                                    <div class="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50">
                                        {{ ticket.transport_company }}
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Проверка данных</span>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <div class="text-3xl font-black text-slate-800 tracking-tight leading-none mb-2">{{ ticket.departure_time }}</div>
                                        <div class="text-sm font-bold text-slate-600 truncate">{{ ticket.from_city }}</div>
                                        <div class="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]">{{ ticket.from_address }}</div>
                                    </div>

                                    <div class="flex flex-col items-center gap-1.5 px-4 shrink-0 -mt-2">
                                        <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest">{{ formattedDuration }}</div>
                                        <div class="flex items-center gap-1 w-16 relative">
                                            <div class="flex-1 border-t-2 border-gray-100"></div>
                                            <svg class="h-3 w-3 text-blue-500 absolute left-1/2 -translate-x-1/2 -top-1.5 bg-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5-5 5M6 7l5 5-5 5"/>
                                            </svg>
                                        </div>
                                    </div>

                                    <div class="flex-1 text-right">
                                        <div class="text-3xl font-black text-slate-800 tracking-tight leading-none mb-2">{{ ticket.arrival_time }}</div>
                                        <div class="text-sm font-bold text-slate-600 truncate">{{ ticket.to_city }}</div>
                                        <div class="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px] ml-auto">{{ ticket.to_address }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Perforated Line -->
                            <div class="relative w-full h-1 flex items-center bg-white overflow-visible">
                                <div class="absolute -left-3 w-6 h-6 rounded-full bg-slate-50 border border-gray-100 z-10 shadow-inner"></div>
                                <div class="absolute -right-3 w-6 h-6 rounded-full bg-slate-50 border border-gray-100 z-10 shadow-inner"></div>
                            </div>

                            <!-- Ticket Bottom / Details -->
                            <div class="px-7 py-6 space-y-5 bg-white font-medium">
                                <div class="grid grid-cols-2 gap-x-8 gap-y-5">
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Пассажиры</div>
                                        <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <svg class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                            {{ passengerCount }} человек(а)
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 text-right">Дата рейса</div>
                                        <div class="font-bold text-slate-800 text-sm text-right">{{ formatDate(ticket.departure_date) }}</div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Места</div>
                                        <div class="flex gap-1 flex-wrap">
                                            <span v-for="seat in selectedSeats" :key="seat" class="px-2 py-0.5 text-[11px] font-black rounded-md border"
                                                :class="(ticket.premiumSeats || []).includes(seat) ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-100'">
                                                №{{ seat }}<span v-if="(ticket.premiumSeats || []).includes(seat)" class="ml-0.5">★</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 text-right">Стоимость билета</div>
                                        <div class="font-black text-slate-900 text-xl text-right leading-none">{{ totalPrice }} с.</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Ticket Code -->
                            <div class="px-7 pb-7 pt-2 flex items-center justify-between border-t border-gray-50 bg-slate-50/30">
                                <div>
                                    <div class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Предпросмотр</div>
                                    <div class="text-xs font-mono font-bold text-slate-400">
                                        TK-PREVIEW-{{ Math.floor(Math.random() * 900) + 100 }}
                                    </div>
                                </div>
                                <div class="flex items-center h-8 gap-[2px] opacity-20">
                                    <div v-for="n in [1.5,1,2,1,0.5,3,1,0.5,2,1,2]" :key="n" class="h-full bg-slate-800" :style="{ width: n + 'px' }"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Phone -->
                        <div class="bg-white rounded-2xl px-6 py-4 flex items-center justify-between border border-gray-100 shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                   <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                </div>
                                <span class="text-xs text-gray-500 font-bold">Телефон для связи</span>
                            </div>
                            <div class="font-bold text-slate-800 text-sm">{{ phone }}</div>
                        </div>

                        <!-- Passengers List -->
                        <div class="space-y-3">
                            <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Список пассажиров</h3>
                            <div v-for="(p, i) in passengersData" :key="i"
                                class="bg-white rounded-2xl px-6 py-4 border border-gray-100 shadow-sm flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-inner"
                                    :class="p.gender === 'male' ? 'bg-blue-50 text-blue-500' : 'bg-pink-50 text-pink-500'">
                                    {{ p.firstName[0] }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{{ p.lastName }} {{ p.firstName }}</div>
                                    <div class="text-[10px] text-gray-400 mt-0.5 truncate">{{ p.docType }} · {{ p.docNumber }}</div>
                                </div>
                                <div class="text-right shrink-0">
                                    <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Место</div>
                                    <div class="text-sm font-black text-slate-900">№ {{ [...selectedSeats].sort((a,b)=>a-b)[i] }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Platform fee info banner -->
                        <div class="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                            <div class="flex items-start gap-3">
                                <div class="text-amber-500 text-lg shrink-0 mt-0.5">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
                                </div>
                                <div>
                                    <div class="text-xs font-black text-amber-800 mb-1">Информация об оплате</div>
                                    <p class="text-[11px] text-amber-700 leading-relaxed">
                                        Через SmartPay вы оплачиваете только <strong>сервисный сбор платформы — {{ feePercent }}%</strong> от стоимости билета.
                                        Оставшуюся сумму вы оплачиваете перевозчику напрямую.
                                    </p>
                                    <div class="mt-3 flex items-center justify-between bg-white/70 rounded-xl px-4 py-2.5 border border-amber-100">
                                        <div>
                                            <div class="text-[9px] text-amber-500 font-bold uppercase tracking-widest">Сейчас через SmartPay</div>
                                            <div class="text-lg font-black text-amber-700">{{ platformFee }} с.</div>
                                        </div>
                                        <div class="text-amber-300 font-bold text-lg">+</div>
                                        <div class="text-right">
                                            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Перевозчику напрямую</div>
                                            <div class="text-lg font-black text-slate-700">{{ totalPrice - platformFee }} с.</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer disclaimer -->
                        <div class="pt-4 px-6 text-center">
                            <p class="text-[11px] text-gray-400 leading-relaxed max-w-[280px] mx-auto">
                                Проверьте правильность введенных данных. Ошибка в данных может быть причиной отказа в посадке.
                            </p>
                        </div>
                    </div>
                </div>
            </Transition>

            <!-- Sticky Footer CTA -->
            <div class="bg-white/95 backdrop-blur-xl border-t border-gray-100 px-5 py-4 z-40 mt-auto sticky bottom-0">
                <button v-if="step === 1"
                    @click="goToStep2"
                    :disabled="!canProceedStep1"
                    class="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 border-b-2"
                    :class="canProceedStep1
                        ? 'bg-slate-900 text-white border-slate-700 shadow-lg shadow-slate-200'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'">
                    Продолжить → Данные
                </button>

                <button v-if="step === 2"
                    @click="goToStep3"
                    :disabled="!canProceedStep2"
                    class="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 border-b-2"
                    :class="canProceedStep2
                        ? 'bg-slate-900 text-white border-slate-700 shadow-lg shadow-slate-200'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'">
                    Проверить заказ →
                </button>

                <button v-if="step === 3"
                    @click="confirmBooking"
                    :disabled="bookingLoading"
                    class="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 border-b-2 flex items-center justify-center gap-3"
                    :class="bookingLoading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-600 text-white border-blue-800 shadow-lg shadow-blue-200'">
                    <span v-if="bookingLoading" class="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></span>
                    <span class="tracking-tight">{{ bookingLoading ? 'Оформляем...' : `Оплатить сервисный сбор — ${platformFee} с.` }}</span>
                </button>
            </div>
        </template>

        <AppModal
            :show="modal.show" :title="modal.title" :message="modal.message"
            :type="modal.type" :confirmText="modal.confirmText" :showCancel="modal.showCancel"
            :showBotLink="modal.showBotLink"
            @confirm="modal.onConfirm" @cancel="modal.show = false" @close="modal.show = false"
        />
    </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: all 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

.fade-slide-enter-active, .fade-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-slide-enter-from {
    opacity: 0;
    transform: translateX(10px);
}
.fade-slide-leave-to {
    opacity: 0;
    transform: translateX(-10px);
}
</style>
