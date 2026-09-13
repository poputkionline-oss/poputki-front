<template>
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div class="text-center mb-6">
                <div class="text-lg font-semibold text-slate-900">POPUTKI.ONLINE</div>
                <div class="text-sm text-slate-500 mt-1">Билет</div>
            </div>

            <div v-if="loading" class="text-center text-slate-500 py-8">
                Загрузка…
            </div>

            <div v-else-if="error" class="text-center py-6">
                <div class="text-rose-600 font-medium mb-2">{{ errorTitle }}</div>
                <p class="text-sm text-slate-500">{{ errorHint }}</p>
            </div>

            <div v-else-if="trip" class="space-y-4">
                <div class="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <div class="text-base font-semibold text-slate-900">
                        {{ trip.fromCity || '—' }} → {{ trip.toCity || '—' }}
                    </div>
                    <div class="text-sm text-slate-500 mt-1" v-if="trip.departureDate">
                        {{ trip.departureDate }} {{ (trip.departureTime || '').slice(0, 5) }}
                    </div>
                    <div class="text-sm text-slate-500 mt-1" v-if="trip.carrierName">
                        {{ trip.carrierName }}
                    </div>
                    <div class="text-sm text-slate-500 mt-1" v-if="seatsLabel">
                        {{ seatsLabel }}
                    </div>
                    <div class="text-sm text-slate-500 mt-1" v-if="!canSubscribe">
                        {{ statusLabel }}
                    </div>
                </div>

                <p class="text-xs text-slate-500 text-center leading-relaxed">
                    Если билет оформлен для вас — добавьте его в Telegram.
                    Если вы оформляли билет для другого пассажира — перешлите
                    ему эту ссылку.
                </p>

                <a
                    v-if="canSubscribe"
                    :href="telegramDeepLink || '#'"
                    class="block w-full text-center bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-xl py-3 transition-colors"
                    :class="{ 'opacity-60 pointer-events-none': starting }"
                    @click="onSubscribeClick"
                >
                    {{ starting ? 'Открываем Telegram…' : 'Добавить билет в Telegram' }}
                </a>

                <p v-if="subscribeError" class="text-xs text-rose-600 text-center">{{ subscribeError }}</p>

                <button
                    v-if="canSubscribe"
                    type="button"
                    class="block w-full text-center bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl py-3 border border-slate-200 transition-colors"
                    @click="onForwardClick"
                >
                    Переслать билет пассажиру
                </button>

                <p v-if="forwardFeedback" class="text-xs text-emerald-600 text-center">{{ forwardFeedback }}</p>
            </div>
        </div>
    </div>
</template>

<script>
import api from '../api';
import { copyToClipboard } from '../telegram';

const ERROR_MESSAGES = {
    INVALID_TOKEN: {
        title: 'Ссылка недействительна',
        hint: 'Проверьте, что ссылка скопирована полностью, либо обратитесь к перевозчику.'
    },
    BOOKING_NOT_FOUND: {
        title: 'Билет не найден',
        hint: 'Обратитесь к перевозчику за новой ссылкой.'
    },
    DEFAULT: {
        title: 'Не удалось открыть билет',
        hint: 'Попробуйте ещё раз чуть позже или обратитесь к перевозчику.'
    }
};

export default {
    name: 'TicketSubscribeView',
    data() {
        return {
            token: this.$route.params.verificationToken || '',
            loading: true,
            error: null,
            trip: null,
            canSubscribe: false,
            telegramDeepLink: null,
            starting: false,
            subscribeError: null,
            forwardFeedback: null
        };
    },
    computed: {
        errorTitle() {
            return (ERROR_MESSAGES[this.error] || ERROR_MESSAGES.DEFAULT).title;
        },
        errorHint() {
            return (ERROR_MESSAGES[this.error] || ERROR_MESSAGES.DEFAULT).hint;
        },
        seatsLabel() {
            const seats = Array.isArray(this.trip?.seatNumbers) ? this.trip.seatNumbers : [];
            if (seats.length === 0) return null;
            if (seats.length === 1) return `Место: ${seats[0]}`;
            return `Места: ${seats.join(', ')}`;
        },
        statusLabel() {
            if (this.trip?.status === 'cancelled') return 'Поездка отменена.';
            return 'Ссылка на добавление в Telegram для этой поездки больше не действует.';
        }
    },
    async mounted() {
        // Same defense-in-depth as ClaimLandingView.vue: never leak this
        // token via the Referer header to any external link (Telegram
        // included).
        this._previousReferrerMeta = document.querySelector('meta[name="referrer"]');
        this._previousReferrerContent = this._previousReferrerMeta?.getAttribute('content') || null;
        let metaTag = this._previousReferrerMeta;
        if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.name = 'referrer';
            document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', 'no-referrer');

        if (!this.token) {
            this.error = 'INVALID_TOKEN';
            this.loading = false;
            return;
        }
        try {
            const res = await api.post('/claims/subscribe-preview', { verificationToken: this.token });
            this.trip = res.data?.trip || null;
            this.canSubscribe = Boolean(res.data?.canSubscribe);
        } catch (err) {
            this.error = err.response?.data?.code || 'DEFAULT';
        } finally {
            this.loading = false;
        }
    },
    unmounted() {
        const metaTag = document.querySelector('meta[name="referrer"]');
        if (!metaTag) return;
        if (this._previousReferrerContent !== null) {
            metaTag.setAttribute('content', this._previousReferrerContent);
        } else {
            metaTag.remove();
        }
    },
    methods: {
        async onSubscribeClick(e) {
            e.preventDefault();
            // Guard against a second tap firing a second session-start request
            // while the first is still in flight, and against re-fetching a
            // link we already have.
            if (this.starting) return;

            if (this.telegramDeepLink) {
                // Retry tap after a link was already fetched (e.g. the popup
                // was closed or Telegram didn't launch) — reopen the same
                // link, never start a second subscription session.
                window.open(this.telegramDeepLink, '_blank');
                return;
            }

            this.starting = true;
            this.subscribeError = null;

            // Open a blank tab synchronously, inside this click's user
            // gesture, and only navigate it once the deep link is known.
            // iOS Safari (and other mobile browsers) only allow a Telegram
            // universal-link navigation within a direct synchronous user
            // gesture; a window opened synchronously keeps that gesture
            // alive across the await below, so the first tap can open
            // Telegram directly instead of merely fetching the link. Same
            // pattern as BusAdminView.vue's openHandoffTelegram().
            let newWindow = null;
            try {
                newWindow = window.open('about:blank', '_blank');
            } catch (wErr) {
                newWindow = null;
            }

            try {
                const res = await api.post('/claims/start-subscription', { verificationToken: this.token });
                const deepLink = res.data?.deepLink;
                if (typeof deepLink !== 'string' || !deepLink.startsWith('https://t.me/')) {
                    throw new Error('INVALID_TELEGRAM_LINK');
                }
                this.telegramDeepLink = deepLink;
                if (newWindow && !newWindow.closed) {
                    newWindow.location.href = deepLink;
                } else {
                    // Popup was blocked (e.g. browser blocked the
                    // about:blank open itself) — fall back to a direct
                    // open, which still runs inside this same click
                    // handler's gesture.
                    window.open(deepLink, '_blank');
                }
            } catch (err) {
                if (newWindow && !newWindow.closed) newWindow.close();
                this.subscribeError = 'Не удалось подготовить Telegram. Попробуйте ещё раз.';
            } finally {
                this.starting = false;
            }
        },
        async onForwardClick() {
            // Pure client-side share/copy of the already-known public
            // subscribe link — must never call the backend or create any
            // session, follower, or claim record.
            this.forwardFeedback = null;
            const shareUrl = window.location.href;

            if (navigator.share) {
                try {
                    await navigator.share({ url: shareUrl });
                } catch (err) {
                    // User cancelled the native share sheet, or the browser
                    // refused it — not an error worth surfacing.
                }
                return;
            }

            const success = await copyToClipboard(shareUrl);
            this.forwardFeedback = success
                ? 'Ссылка на билет скопирована'
                : 'Не удалось скопировать ссылку';
            setTimeout(() => {
                this.forwardFeedback = null;
            }, 3000);
        }
    }
};
</script>
