<script>
import api from '../api';
export default {
    props: { carrierId: { type: Number, required: true } },
    data: () => ({ summary: null, loading: true, failed: false }),
    watch: { carrierId: { immediate: true, handler() { this.loadReviews(); } } },
    methods: {
        async loadReviews() {
            this.loading = true; this.failed = false;
            const requestedId = this.carrierId;
            try {
                const { data } = await api.get(`/reviews/carrier/${requestedId}`);
                if (requestedId === this.carrierId) this.summary = data;
            } catch { if (requestedId === this.carrierId) this.failed = true; }
            finally { if (requestedId === this.carrierId) this.loading = false; }
        }
    }
};
</script>
<template>
    <section class="bg-white rounded-3xl p-5 border border-slate-100 space-y-4">
        <h3 class="font-bold text-slate-800">Отзывы о перевозчике</h3>
        <p v-if="loading" class="text-sm text-slate-500">Загрузка отзывов…</p>
        <p v-else-if="failed" class="text-sm text-slate-500">Отзывы временно недоступны. <button @click="loadReviews" class="underline">Повторить</button></p>
        <template v-else-if="summary">
            <p v-if="summary.count" class="text-sm font-semibold text-amber-700">★ {{ summary.rating }} · Отзывов: {{ summary.count }}</p>
            <p v-else class="text-sm text-slate-500">Пока нет отзывов о завершённых автобусных рейсах.</p>
            <article v-for="review in summary.reviews" :key="review.id" class="border-t border-slate-100 pt-3 space-y-1">
                <div class="flex justify-between gap-3"><span class="text-sm font-bold">{{ review.reviewer_name }}</span><span class="text-sm text-amber-600">★ {{ review.rating }}</span></div>
                <p class="text-xs text-slate-500">{{ review.from_city }} → {{ review.to_city }} · {{ new Date(review.created_at).toLocaleDateString('ru-RU') }}</p>
                <p class="text-sm text-slate-700 whitespace-pre-wrap break-words">{{ review.comment }}</p>
            </article>
        </template>
    </section>
</template>
