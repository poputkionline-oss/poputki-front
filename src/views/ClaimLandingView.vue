<template>
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div class="text-center mb-6">
                <div class="text-lg font-semibold text-slate-900">POPUTKI.ONLINE</div>
                <div class="text-sm text-slate-500 mt-1">Ваш билет</div>
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
                    <div class="text-sm text-slate-500 mt-1">
                        Мест: {{ trip.passengerCount || 1 }}
                    </div>
                </div>

                <p class="text-xs text-slate-500 text-center leading-relaxed">
                    Это сообщение вы получили, потому что перевозчик оформил на этот
                    номер телефона бронь. Чтобы получить билет и уведомления о поездке,
                    подтвердите свой номер в Telegram — нажмите кнопку ниже.
                </p>

                <a
                    :href="telegramDeepLink"
                    class="block w-full text-center bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-xl py-3 transition-colors"
                >
                    Открыть в Telegram и подтвердить билет
                </a>
            </div>
        </div>
    </div>
</template>

<script>
import api from '../api';

const ERROR_MESSAGES = {
    SESSION_EXPIRED: {
        title: 'Ссылка больше не действительна',
        hint: 'Срок действия ссылки истёк. Обратитесь к перевозчику — он сможет выслать новую.'
    },
    SESSION_ALREADY_CONSUMED: {
        title: 'Ссылка уже использована',
        hint: 'Этот билет уже был открыт и подтверждён ранее.'
    },
    SESSION_NOT_FOUND: {
        title: 'Ссылка не найдена',
        hint: 'Проверьте, что ссылка скопирована полностью, либо обратитесь к перевозчику.'
    },
    ALREADY_CLAIMED: {
        title: 'Билет уже привязан',
        hint: 'Этот билет уже привязан к аккаунту в Telegram.'
    },
    BOOKING_NOT_CONFIRMED: {
        title: 'Бронь недоступна',
        hint: 'Эта бронь была отменена или ещё не подтверждена.'
    },
    DEFAULT: {
        title: 'Не удалось открыть билет',
        hint: 'Попробуйте ещё раз чуть позже или обратитесь к перевозчику.'
    }
};

export default {
    name: 'ClaimLandingView',
    data() {
        return {
            token: this.$route.params.token || '',
            loading: true,
            error: null,
            trip: null
        };
    },
    computed: {
        telegramDeepLink() {
            return `https://t.me/Poputkionline_bot?start=claim_${this.token}`;
        },
        errorTitle() {
            return (ERROR_MESSAGES[this.error] || ERROR_MESSAGES.DEFAULT).title;
        },
        errorHint() {
            return (ERROR_MESSAGES[this.error] || ERROR_MESSAGES.DEFAULT).hint;
        }
    },
    async mounted() {
        if (!this.token) {
            this.error = 'SESSION_NOT_FOUND';
            this.loading = false;
            return;
        }
        try {
            const res = await api.post('/claims/preview-trip', { sessionToken: this.token });
            this.trip = res.data?.trip || null;
        } catch (err) {
            this.error = err.response?.data?.code || 'DEFAULT';
        } finally {
            this.loading = false;
        }
    }
};
</script>
