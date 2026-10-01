<script>
import api from '../api';
export default {
    props: { received: { type: Boolean, default: false } },
    data: () => ({ result: null, page: 1, loading: true, failed: false }),
    mounted() { this.load(1); },
    methods: {
        async load(page) {
            this.loading = true; this.failed = false;
            try {
                const { data } = await api.get(this.received ? '/bus-admin/reviews' : '/reviews/sent', { params: { page } });
                this.result = data; this.page = page;
            } catch { this.failed = true; }
            finally { this.loading = false; }
        },
        date(value) { return value ? new Date(value).toLocaleDateString('ru-RU') : ''; }
    }
};
</script>
<template>
    <div class="space-y-5">
        <div class="flex items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl font-bold text-slate-900">Мои отзывы</h2>
                <p class="text-sm text-slate-500 mt-1">{{ received ? 'Оценки пассажиров о Ваших автобусных поездках' : 'Отзывы, которые Вы оставили после поездок' }}</p>
            </div>
            <button @click="load(page)" :disabled="loading" class="px-4 py-2 bg-white border rounded-xl text-sm font-semibold disabled:opacity-50">Обновить</button>
        </div>
        <p v-if="loading" class="text-slate-500 py-8">Загрузка отзывов…</p>
        <div v-else-if="failed" class="bg-white p-6 rounded-2xl border text-slate-600">
            Не удалось загрузить отзывы. <button @click="load(page)" class="underline text-amber-700">Повторить</button>
        </div>
        <template v-else-if="result">
            <div class="bg-white border border-slate-100 rounded-2xl p-5 flex flex-wrap gap-6">
                <div><p class="text-sm text-slate-500">{{ received ? 'Получено отзывов' : 'Отправлено отзывов' }}</p><p class="text-2xl font-bold mt-1">{{ result.count }}</p></div>
                <div v-if="received"><p class="text-sm text-slate-500">Общий рейтинг</p><p class="text-2xl font-bold text-amber-600 mt-1">{{ result.rating === null ? 'Нет оценок' : '★ ' + result.rating }}</p></div>
            </div>
            <div v-if="!result.count" class="bg-white border border-slate-100 rounded-2xl p-6 text-slate-500">
                {{ received ? 'Вы пока не получили отзывов. Они появятся после завершённых поездок, когда пассажиры оценят перевозчика.' : 'Вы пока не оставили отзывов. После завершения автобусного рейса и подтверждения посадки оценить перевозчика можно в «Мои билеты».' }}
                <router-link v-if="!received" to="/my-bus-tickets" class="block mt-3 text-amber-700 font-semibold">Перейти в «Мои билеты» →</router-link>
            </div>
            <article v-for="review in result.reviews" :key="review.id" class="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                <div class="flex justify-between gap-3">
                    <div><p class="font-bold text-slate-800">{{ received ? review.person_name : (review.company || review.person_name) }}</p><p class="text-xs text-slate-400 mt-1">Отзыв от {{ date(review.created_at) }}</p></div>
                    <span class="text-amber-600 font-bold whitespace-nowrap">★ {{ review.rating }} / 5</span>
                </div>
                <p class="text-sm text-slate-600">{{ review.from_city }} → {{ review.to_city }}<span v-if="review.trip_date"> · {{ date(review.trip_date) }}</span><span class="ml-2 text-xs text-slate-400">{{ review.type === 'bus' ? 'Автобус' : 'Попутка' }}</span></p>
                <p v-if="review.comment" class="text-slate-700 text-sm whitespace-pre-wrap break-words">{{ review.comment }}</p>
                <p v-else class="text-sm text-slate-400">Оценка без комментария</p>
            </article>
            <div v-if="result.count > result.page_size" class="flex items-center justify-center gap-4">
                <button :disabled="page <= 1" @click="load(page - 1)" class="px-4 py-2 bg-white border rounded-xl disabled:opacity-40">Назад</button>
                <span class="text-sm text-slate-500">{{ page }} / {{ Math.ceil(result.count / result.page_size) }}</span>
                <button :disabled="page * result.page_size >= result.count" @click="load(page + 1)" class="px-4 py-2 bg-white border rounded-xl disabled:opacity-40">Далее</button>
            </div>
        </template>
    </div>
</template>
