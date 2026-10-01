<template>
  <div class="min-h-screen bg-slate-50 pb-10">
    <!-- Header -->
    <div class="bg-white border-b border-slate-100 p-6 pt-12 flex items-center justify-between sticky top-0 z-20">
      <div class="flex items-center space-x-4">
        <button @click="$router.back()" class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 class="text-xl font-bold text-slate-800">Профиль пользователя</h1>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center pt-20">
        <div class="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-4 text-gray-500 font-medium">Загрузка профиля...</p>
    </div>

    <div v-else class="max-w-xl mx-auto p-6 space-y-6">
        <!-- Profile Card -->
        <div class="bg-white rounded-[32px] p-6 text-center shadow-sm border border-gray-100">
            <div class="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mx-auto flex items-center justify-center text-4xl font-bold text-white shadow-xl shadow-orange-500/20 mb-4">
                {{ user.name ? user.name[0] : 'U' }}
            </div>
            <h2 class="text-2xl font-bold text-slate-800">{{ user.name }} {{ user.surname || '' }}</h2>
            <div class="flex items-center justify-center space-x-2 mt-2 text-gray-500 text-sm">
                <span v-if="user.age">{{ user.age }} лет</span>
                <span v-if="user.age && user.created_at">•</span>
                <span v-if="user.created_at">На сайте с {{ new Date(user.created_at).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) }}</span>
            </div>
            
            <div class="grid grid-cols-3 gap-3 mt-6">
                <div class="bg-gray-50 rounded-2xl p-3">
                    <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Рейтинг</p>
                    <div class="flex items-center justify-center space-x-1 mt-1">
                        <span class="text-lg font-bold text-slate-800">{{ reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 'Нет оценок' }}</span>
                        <svg class="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-2xl p-3">
                    <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">За рулем</p>
                    <p class="text-lg font-bold text-slate-800 mt-1">{{ user.rides_as_driver || 0 }}</p>
                </div>
                <div class="bg-gray-50 rounded-2xl p-3">
                    <p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Пассажиром</p>
                    <p class="text-lg font-bold text-slate-800 mt-1">{{ user.rides_as_passenger || 0 }}</p>
                </div>
            </div>
        </div>

        <!-- Preferences -->
        <div v-if="user.preferences?.length > 0" class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <h3 class="font-bold text-slate-800 mb-4">Предпочтения</h3>
            <div class="space-y-3">
                <div v-for="pref in user.preferences" :key="pref" class="flex items-center space-x-3 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                    <div class="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></div>
                    <span class="text-xs font-bold text-slate-700 tracking-tight">{{ pref }}</span>
                </div>
            </div>
        </div>

        <!-- Vehicle Info -->
        <div v-if="user.vehicle" class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <h3 class="font-bold text-slate-800 mb-4">Автомобиль</h3>
            <div class="flex items-center space-x-4">
                <div class="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
                    </svg>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-lg">{{ user.vehicle.make }} {{ user.vehicle.model }}</p>
                    <p class="text-sm font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg inline-block mt-1">{{ user.vehicle.plate_number }}</p>
                </div>
            </div>
        </div>

        <!-- Reviews -->
        <div>
            <h3 class="font-bold text-slate-800 mb-4 px-2">Отзывы ({{ reviews.length }})</h3>
            <div v-if="reviews.length > 0" class="space-y-4">
                <div v-for="review in reviews" :key="review.id" class="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 transition-all hover:border-blue-100 active:scale-[0.98]">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                                {{ review.reviewer_name?.[0] || 'U' }}
                            </div>
                            <div>
                                <p class="font-bold text-slate-800 text-sm">{{ review.reviewer_name }}</p>
                                <p class="text-[10px] text-gray-400">{{ formatDate(review.created_at) }}</p>
                            </div>
                        </div>
                        <div class="bg-yellow-50 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                             <span class="font-bold text-yellow-700 text-xs">{{ review.rating }}</span>
                             <svg class="w-3 h-3 text-yellow-500 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        </div>
                    </div>
                    <p class="text-slate-600 text-sm leading-relaxed">{{ review.comment }}</p>
                </div>
            </div>
            <div v-else class="text-center py-12 bg-white rounded-[32px] border border-gray-100 border-dashed">
                <p class="text-gray-400 font-medium">Отзывов пока нет</p>
            </div>
        </div>
    </div>

    <!-- Custom Modal -->
    <AppModal 
        :show="modal.show" 
        :title="modal.title" 
        :message="modal.message" 
        :type="modal.type"
        @confirm="modal.show = false"
        @close="modal.show = false"
    />
  </div>
</template>

<script>
import api from '../api';
import AppModal from '../components/AppModal.vue';

export default {
  components: {
    AppModal
  },
  data() {
    return {
      user: {},
      reviews: [],
      loading: true,
      modal: {
        show: false,
        title: '',
        message: '',
        type: 'info'
      }
    };
  },
  methods: {
    showAlert(title, message, type = 'info') {
      this.modal.title = title;
      this.modal.message = message;
      this.modal.type = type;
      this.modal.show = true;
    },
    async fetchData() {
      this.loading = true;
      try {
        const id = this.$route.params.id;
        const profileRes = await api.get(`/users/${id}/profile`);
        this.user = profileRes.data;

        try {
            const reviewsRes = await api.get(`/users/${id}/reviews`);
            this.reviews = reviewsRes.data;
        } catch (e) {
            console.error('Reviews load error:', e);
            this.reviews = [];
        }
      } catch (err) {
        console.error(err);
        this.showAlert('Ошибка', 'Не удалось загрузить профиль', 'error');
      } finally {
        this.loading = false;
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
  },
  mounted() {
    this.fetchData();
  },
  watch: {
    '$route.params.id': {
        handler: 'fetchData',
        immediate: false
    }
  }
};
</script>
