<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
    <div class="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-slate-800">Оставить отзыв</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-6">
        <!-- Stars -->
        <div class="flex flex-col items-center space-y-2">
          <label class="text-sm font-bold text-gray-400 uppercase tracking-wider">Ваша оценка</label>
          <div class="flex space-x-2">
            <button 
              v-for="star in 5" 
              :key="star" 
              @click="rating = star"
              class="w-10 h-10 transition-all transform active:scale-90"
            >
              <svg 
                class="w-full h-full" 
                :class="star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-200'"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Comment -->
        <div class="space-y-2">
          <label class="text-sm font-bold text-gray-400 uppercase tracking-wider">Комментарий</label>
          <textarea 
            v-model="comment"
            maxlength="2000"
            placeholder="Расскажите как прошла поездка..."
            class="w-full h-32 p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all resize-none text-slate-700"
          ></textarea>
        </div>

        <button 
          @click="submitReview" 
          :disabled="!rating || loading"
          class="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold rounded-2xl shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
        >
          <span v-if="loading" class="flex items-center justify-center space-x-2">
            <span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <span>Отправка...</span>
          </span>
          <span v-else>Опубликовать отзыв</span>
        </button>
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
import AppModal from './AppModal.vue';

export default {
  components: {
    AppModal
  },
  props: {
    show: Boolean,
    rideId: Number,
    bookingId: Number,
    driverId: Number
  },
  data() {
    return {
      rating: 0,
      comment: '',
      loading: false,
      user: JSON.parse(localStorage.getItem('user') || 'null'),
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
    async submitReview() {
      this.loading = true;
      try {
        await api.post(this.bookingId ? '/reviews/bus' : '/reviews', {
          ...(this.bookingId ? { booking_id: this.bookingId } : { ride_id: this.rideId }),
          rating: this.rating,
          comment: this.comment
        });
        this.showAlert('Спасибо!', 'Ваш отзыв успешно опубликован', 'success');
        setTimeout(() => {
          this.$emit('success');
        }, 1500);
      } catch (err) {
        console.error(err);
        this.showAlert('Ошибка', err.response?.data?.message || err.response?.data?.error || 'Ошибка при отправке отзыва', 'error');
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
