<script>
import MyReviewsPanel from '../components/MyReviewsPanel.vue';
export default {
    components: { MyReviewsPanel },
    data: () => ({ hasSession: Boolean(localStorage.getItem('token')) }),
    mounted() {
        if (!localStorage.getItem('token')) this.$router.replace({ path: '/auth', query: { redirect: '/my-reviews' } });
    }
};
</script>
<template>
    <main class="max-w-3xl mx-auto px-4 pt-6 pb-28 space-y-5">
        <router-link to="/profile" class="text-sm text-slate-500">← Профиль</router-link>
        <MyReviewsPanel v-if="hasSession" />
    </main>
</template>
