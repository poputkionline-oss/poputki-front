<script>
import jsQR from 'jsqr';
import api from '../../api';

export default {
    name: 'CarrierBoardingScanner',
    props: {
        trip: {
            type: Object,
            required: true
        },
        counts: {
            type: Object,
            default: () => ({ total: 0, pending: 0, boarded: 0, noShow: 0 })
        }
    },
    emits: ['close', 'boarded'],
    data() {
        return {
            cameraStatus: 'starting', // 'starting' | 'active' | 'denied' | 'unsupported' | 'error'
            cameraErrorMessage: '',
            locked: false, // true while a server request is in flight or during post-result cooldown
            feedback: null, // { type: 'success'|'info'|'warning'|'error', title, detail }
            usingBarcodeDetector: false,
            _stream: null,
            _rafId: null,
            _detector: null,
            _canvas: null,
            _ctx: null
        };
    },
    mounted() {
        this.startCamera();
    },
    beforeUnmount() {
        this.stopCamera();
    },
    methods: {
        async startCamera() {
            this.cameraStatus = 'starting';
            this.cameraErrorMessage = '';

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.cameraStatus = 'unsupported';
                return;
            }

            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false
                });
            } catch (e) {
                // Rear camera unavailable/unsupported on this device: fall back to any camera
                // rather than breaking the scanner entirely.
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                } catch (e2) {
                    this.cameraStatus = e2.name === 'NotAllowedError' ? 'denied' : 'error';
                    this.cameraErrorMessage = 'Не удалось получить доступ к камере.';
                    return;
                }
            }

            this._stream = stream;
            const video = this.$refs.video;
            if (!video) {
                this.stopCamera();
                return;
            }
            video.srcObject = stream;
            await video.play().catch(() => {});

            this.cameraStatus = 'active';

            if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
                try {
                    this._detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    this.usingBarcodeDetector = true;
                } catch (e) {
                    this.usingBarcodeDetector = false;
                }
            }

            if (!this.usingBarcodeDetector) {
                this._canvas = document.createElement('canvas');
                this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
            }

            this.tick();
        },
        stopCamera() {
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
            if (this._stream) {
                this._stream.getTracks().forEach(t => t.stop());
                this._stream = null;
            }
        },
        tick() {
            this._rafId = requestAnimationFrame(() => this.tick());
            if (this.locked || this.cameraStatus !== 'active') return;

            if (this.usingBarcodeDetector) {
                this.detectViaBarcodeDetector();
            } else {
                this.detectViaJsQr();
            }
        },
        async detectViaBarcodeDetector() {
            const video = this.$refs.video;
            if (!video || video.readyState < 2) return;
            try {
                const codes = await this._detector.detect(video);
                if (codes && codes.length > 0 && codes[0].rawValue) {
                    this.handleDetection(codes[0].rawValue);
                }
            } catch (e) {
                // Transient decode errors are expected between frames; ignore.
            }
        },
        detectViaJsQr() {
            const video = this.$refs.video;
            if (!video || video.readyState < 2 || !video.videoWidth) return;

            const w = video.videoWidth;
            const h = video.videoHeight;
            this._canvas.width = w;
            this._canvas.height = h;
            this._ctx.drawImage(video, 0, 0, w, h);

            let imageData;
            try {
                imageData = this._ctx.getImageData(0, 0, w, h);
            } catch (e) {
                return;
            }

            const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
                this.handleDetection(code.data);
            }
        },
        extractTicketToken(rawScanValue) {
            const text = String(rawScanValue || '').trim();
            if (!text) return '';
            try {
                const url = new URL(text);
                const segments = url.pathname.split('/').filter(Boolean);
                if (segments.length > 0) return segments[segments.length - 1];
            } catch (e) {
                // Not a URL — treat the whole scanned string as the token.
            }
            return text;
        },
        async handleDetection(rawScanValue) {
            if (this.locked) return;
            const ticketToken = this.extractTicketToken(rawScanValue);
            if (!ticketToken) return;

            this.locked = true;

            try {
                const res = await api.post('/bus-admin/bookings/scan-boarding', {
                    ticketToken,
                    tripId: this.trip.id
                });

                const data = res.data || {};
                this.$emit('boarded', data);

                if (data.already_boarded) {
                    this.showFeedback('info', 'Уже посажен', this.passengerSummary(data));
                    this.vibrate([40]);
                } else {
                    this.showFeedback('success', 'Пассажир посажен', this.passengerSummary(data));
                    this.vibrate([60, 40, 60]);
                }
            } catch (err) {
                this.handleScanError(err);
            } finally {
                this.scheduleCooldown();
            }
        },
        passengerSummary(data) {
            const seat = (data.passenger?.seats && data.passenger.seats.length > 0)
                ? data.passenger.seats.join(', ')
                : '—';
            const name = data.passenger?.displayName || '';
            return `Место №${seat}${name ? ' · ' + name : ''}`;
        },
        handleScanError(err) {
            if (!err.response) {
                this.showFeedback('error', 'Нет соединения с сервером', 'Проверьте интернет и попробуйте снова');
                return;
            }
            const code = err.response.data?.code;
            const serverMessage = err.response.data?.error;

            const messages = {
                WRONG_TRIP: ['warning', 'Билет относится к другому рейсу'],
                TRIP_COMPLETED: ['error', 'Рейс уже завершён'],
                TRIP_NOT_ACTIVE: ['error', 'Рейс недоступен для посадки'],
                PENDING_PAYMENT: ['error', 'Бронирование ожидает оплаты'],
                BOOKING_INVALID: ['error', 'Бронирование недействительно'],
                INVALID_TICKET: ['error', 'Недействительный билет'],
                INVALID_TRIP: ['error', 'Не выбран рейс']
            };

            const [type, title] = messages[code] || ['error', serverMessage || 'Недействительный билет'];
            this.showFeedback(type, title, code === 'WRONG_TRIP' ? `Текущий рейс: ${this.trip.from_city} → ${this.trip.to_city}` : '');
            this.vibrate([100]);
        },
        showFeedback(type, title, detail) {
            this.feedback = { type, title, detail: detail || '' };
        },
        scheduleCooldown() {
            const delay = this.feedback && this.feedback.type === 'success' ? 1200
                : this.feedback && this.feedback.type === 'info' ? 1000
                : 1600;
            setTimeout(() => {
                this.feedback = null;
                this.locked = false;
            }, delay);
        },
        vibrate(pattern) {
            try {
                if (navigator.vibrate) navigator.vibrate(pattern);
            } catch (e) { /* best-effort only */ }
        },
        close() {
            this.stopCamera();
            this.$emit('close');
        }
    }
};
</script>

<template>
    <div class="fixed inset-0 z-[100] bg-black flex flex-col">
        <!-- Header -->
        <div class="relative z-10 flex items-center justify-between px-4 py-3 bg-black/70 backdrop-blur text-white shrink-0">
            <button @click="close" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-sm font-bold">
                <span>←</span> <span>Назад</span>
            </button>
            <div class="text-sm font-bold">Сканирование билета</div>
            <div class="w-16"></div>
        </div>

        <!-- Camera / status area -->
        <div class="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
            <video
                ref="video"
                class="absolute inset-0 w-full h-full object-cover"
                playsinline
                muted
                autoplay
            ></video>

            <!-- Scan frame overlay -->
            <div v-if="cameraStatus === 'active'" class="relative z-10 w-64 h-64 sm:w-80 sm:h-80">
                <div class="absolute inset-0 border-2 border-white/60 rounded-3xl"></div>
                <div class="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-amber-400 rounded-tl-2xl"></div>
                <div class="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-amber-400 rounded-tr-2xl"></div>
                <div class="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-amber-400 rounded-bl-2xl"></div>
                <div class="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-amber-400 rounded-br-2xl"></div>
            </div>

            <p v-if="cameraStatus === 'active'" class="absolute bottom-6 left-0 right-0 z-10 text-center text-white/90 text-sm font-semibold px-6">
                Наведите камеру на QR-код пассажира
            </p>

            <!-- Camera unavailable / denied / unsupported states -->
            <div v-if="cameraStatus === 'starting'" class="z-10 text-white text-sm font-semibold flex flex-col items-center gap-3">
                <span class="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                <span>Включаем камеру…</span>
            </div>

            <div v-if="cameraStatus === 'denied' || cameraStatus === 'unsupported' || cameraStatus === 'error'" class="z-10 text-center text-white px-8 space-y-3 max-w-sm">
                <div class="text-3xl">📷🚫</div>
                <p class="font-bold">
                    {{ cameraStatus === 'denied' ? 'Доступ к камере запрещён' : cameraStatus === 'unsupported' ? 'Камера не поддерживается этим браузером' : 'Не удалось запустить камеру' }}
                </p>
                <p class="text-xs text-white/70">
                    Используйте ручную посадку кнопками «Посажен» / «Не явился» ниже, либо разрешите доступ к камере в настройках браузера.
                </p>
                <button @click="close" class="mt-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold transition-all">
                    Закрыть сканер
                </button>
            </div>

            <!-- Feedback overlay -->
            <transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
                <div v-if="feedback" class="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6">
                    <div
                        :class="{
                            'bg-emerald-600': feedback.type === 'success',
                            'bg-sky-600': feedback.type === 'info',
                            'bg-amber-500': feedback.type === 'warning',
                            'bg-rose-600': feedback.type === 'error'
                        }"
                        class="w-full max-w-xs rounded-[28px] px-6 py-8 text-center text-white shadow-2xl space-y-2"
                    >
                        <div class="text-4xl">
                            {{ feedback.type === 'success' ? '✅' : feedback.type === 'info' ? 'ℹ️' : feedback.type === 'warning' ? '⚠️' : '❌' }}
                        </div>
                        <div class="text-lg font-black">{{ feedback.title }}</div>
                        <div v-if="feedback.detail" class="text-sm opacity-90 font-semibold">{{ feedback.detail }}</div>
                    </div>
                </div>
            </transition>
        </div>

        <!-- Trip context + live counters -->
        <div class="relative z-10 bg-black/80 backdrop-blur text-white px-4 py-3.5 shrink-0 space-y-2">
            <div class="text-xs text-white/60 font-bold uppercase tracking-wide">Рейс</div>
            <div class="text-sm font-bold truncate">{{ trip.from_city }} → {{ trip.to_city }}</div>
            <div class="flex items-center gap-4 text-xs font-bold pt-1">
                <span class="text-emerald-400">Посажены: {{ counts.boarded }}</span>
                <span class="text-amber-400">Ожидают: {{ counts.pending }}</span>
            </div>
        </div>
    </div>
</template>
