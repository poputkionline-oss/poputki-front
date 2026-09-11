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
                    Добавить билет в Telegram
                </a>

                <p v-if="subscribeError" class="text-xs text-rose-600 text-center">{{ subscribeError }}</p>
            </div>
        </div>
    </div>
</template>

<script>
import api from '../api';

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
            subscribeError: null
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
            // A deep link already fetched on a previous tap is followed as-is
            // via the native <a href> on THIS synchronous tap (iOS Safari
            // only honors a Telegram universal link from a direct,
            // synchronous user gesture — same constraint documented in
            // TicketVerificationView.vue's startClaimSession()). The first
            // tap only fetches the link and never navigates.
            if (this.telegramDeepLink || this.starting) return;
            e.preventDefault();
            this.starting = true;
            this.subscribeError = null;
            try {
                const res = await api.post('/claims/start-subscription', { verificationToken: this.token });
                const deepLink = res.data?.deepLink;
                if (typeof deepLink !== 'string' || !deepLink.startsWith('https://t.me/')) {
                    throw new Error('INVALID_TELEGRAM_LINK');
                }
                this.telegramDeepLink = deepLink;
            } catch (err) {
                this.subscribeError = 'Не удалось подготовить Telegram. Попробуйте ещё раз.';
            } finally {
                this.starting = false;
            }
        }
    }
};
</script>
