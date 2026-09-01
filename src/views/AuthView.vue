<script>
import api from '../api';
import AppModal from '../components/AppModal.vue';
import AppLogo from '../components/AppLogo.vue';
import { getTelegramUser, getTelegramInitData } from '../telegram';

export default {
  components: {
    AppModal,
    AppLogo
  },
  data() {
    return {
      step: 1, // 1: Phone, 2: Profile
      phone: '',
      needsPhone: false,
      registration: {
        id: null,
        name: '',
        age: '',
        phone: ''
      },
      selectedCountry: '+992',
      countries: [
        { name: 'Таджикистан', code: '+992', flag: '🇹🇯' },
        { name: 'Узбекистан', code: '+998', flag: '🇺🇿' },
        { name: 'Казахстан', code: '+7', flag: '🇰🇿' },
        { name: 'Кыргызстан', code: '+996', flag: '🇰🇬' },
        { name: 'Россия', code: '+7', flag: '🇷🇺' }
      ],
      loading: false,
      modal: {
        show: false,
        title: '',
        message: '',
        type: 'info'
      }
    };
  },
  computed: {
    tgUser() {
      return getTelegramUser();
    },
    tgName() {
      return this.tgUser?.first_name || '';
    }
  },
  async mounted() {
    this.syncTelegram();
    
    if (this.$route.query.tg_complete === '1') {
        const userStr = localStorage.getItem('user');
        if (userStr) {
           const user = JSON.parse(userStr);
           this.registration.id = user.id;
           this.registration.name = user.name || '';
           this.needsPhone = !user.phone;
           this.step = 2;
        }
    }
  },
  methods: {
    async syncTelegram() {
      if (!this.tgUser) return;

      const user = JSON.parse(localStorage.getItem('user') || 'null');
      console.log('[AuthView] Syncing Telegram user:', this.tgUser.first_name, 'ID:', this.tgUser.id);
      this.loading = true;

      try {
        const res = await api.post('/auth/telegram-miniapp', {
          initData: getTelegramInitData(),
          userId: user?.id
        });

        console.log('[AuthView] Telegram miniapp sync response:', res.data);

        if (res.data.user) {
          const syncedUser = res.data.user;
          const token = res.data.token || ('mock-token-' + syncedUser.id);
          localStorage.setItem('user', JSON.stringify(syncedUser));
          localStorage.setItem('token', token);

          if (syncedUser.name) {
            console.log('[AuthView] Seamless Telegram login complete, navigating');
            this.completeAuth(syncedUser, token);
            return;
          }

          if (this.step === 2) {
             this.registration.id = syncedUser.id;
             this.registration.name = syncedUser.name || this.tgName || '';
          }
        }
      } catch (e) {
        console.error("[AuthView] Telegram sync error:", e);
      } finally {
        this.loading = false;
      }
    },
    showAlert(title, message, type = 'info') {
      this.modal.title = title;
      this.modal.message = message;
      this.modal.type = type;
      this.modal.show = true;
    },
    async handleLogin() {
      // Combine code and phone, then normalize: strip country code if already present at start
      const digitsOnly = this.phone.replace(/\D/g, '');
      const countryDigits = this.selectedCountry.replace(/\D/g, '');
      let phonePart = digitsOnly;
      if (phonePart.startsWith(countryDigits)) {
          phonePart = phonePart.substring(countryDigits.length);
      }
      const cleanPhone = this.selectedCountry + phonePart;
      if (!cleanPhone || cleanPhone.length < 5) {
        this.showAlert('Внимание', 'Пожалуйста, введите корректный номер телефона', 'warning');
        return;
      }

      this.loading = true;
      try {
        console.log('[AuthView] Attempting login with phone:', cleanPhone);
        const res = await api.post('/auth/login', {
           phone: cleanPhone
        });

        console.log('[AuthView] Login response:', JSON.stringify(res.data, null, 2));

        // Check if response has user data
        if (!res.data || !res.data.user) {
          console.error('[AuthView] Invalid response structure:', res.data);
          const errorMsg = res.data?.message || res.data?.error || 'Неверный формат ответа сервера';
          throw new Error(errorMsg);
        }

        // Save token immediately
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
          console.log('[AuthView] Token saved:', res.data.token);
        } else {
          console.warn('[AuthView] No token in response');
        }

        const user = res.data.user;
        console.log('[AuthView] User object:', {
          id: user.id,
          phone: user.phone,
          name: user.name,
          age: user.age,
          isNew: user.isNew
        });

        if (user.isNew || !user.name) {
            console.log('[AuthView] User needs profile name completion.');
            this.registration.id = user.id;
            this.registration.phone = user.phone || '';
            this.step = 2;
        } else {
            console.log('[AuthView] User profile complete, logging in');
            this.completeAuth(user, res.data.token);
        }
      } catch (e) {
        console.error('[AuthView] Login error details:', {
          message: e.message,
          status: e.response?.status,
          data: e.response?.data,
          fullError: e
        });

        let errorMsg = 'Ошибка входа. ';
        if (e.response?.status === 400) {
          errorMsg += 'Проверьте номер телефона. ' + (e.response?.data?.error || '');
        } else if (e.response?.status === 500) {
          errorMsg += 'Ошибка сервера. ' + (e.response?.data?.error || '');
        } else if (e.message) {
          errorMsg += e.message;
        } else {
          errorMsg += 'Пожалуйста, попробуйте позже.';
        }

        this.showAlert('Ошибка входа', errorMsg, 'error');
      } finally {
        this.loading = false;
      }
    },
    async handleRegister() {
        if (!this.registration.name || (this.needsPhone && !this.registration.phone)) {
            this.showAlert('Заполните поля', 'Пожалуйста, укажите ваше имя', 'warning');
            return;
        }

        let cleanedPhone = this.registration.phone;
        if (this.needsPhone) {
             const digitsOnly = this.registration.phone.replace(/\D/g, '');
             const countryDigits = this.selectedCountry.replace(/\D/g, '');
             let phonePart = digitsOnly;
             if (phonePart.startsWith(countryDigits)) {
                 phonePart = phonePart.substring(countryDigits.length);
             }
             cleanedPhone = this.selectedCountry + phonePart;
             if (!cleanedPhone || cleanedPhone.length < 5) {
                 this.showAlert('Внимание', 'Пожалуйста, введите корректный номер телефона', 'warning');
                 return;
             }
        }

        this.loading = true;
        try {
            const payload = { ...this.registration, phone: cleanedPhone, age: parseInt(this.registration.age) || null };
            const res = await api.post('/auth/register', payload);
            const token = localStorage.getItem('token') || ('mock-token-' + res.data.user.id);
            this.completeAuth(res.data.user, token);
        } catch (e) {
            console.error('Register error:', e);
            const errorMsg = e.response?.data?.error || 'Ошибка регистрации. Пожалуйста, попробуйте позже.';
            this.showAlert('Ошибка', errorMsg, 'error');
        } finally {
            this.loading = false;
        }
    },
    completeAuth(user, token) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        const redirect = this.$route.query.redirect;
        if (redirect) {
            this.$router.push(redirect);
            return;
        }

        if (user.role === 'bus_driver') {
            this.$router.push({ name: 'bus-admin' });
        } else if (this.tgUser || user.telegram_id) {
            this.$router.push({ name: 'my-bus-tickets' });
        } else {
            this.$router.push({ name: 'search' });
        }
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-white flex flex-col relative overflow-hidden">
    <!-- Background Decor -->
    <div class="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
    <div class="absolute -bottom-32 -left-32 w-64 h-64 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

    <div class="flex-1 flex flex-col justify-center p-8 relative z-10">
      <div v-if="step === 1">
        <div class="mb-8">
           <AppLogo 
              :showText="false" 
              containerClass="mb-6 transform -rotate-6"
              iconSizeClass="w-16 h-16"
              iconClass="h-8 w-8"
              iconBgClass="bg-yellow-500 shadow-lg shadow-yellow-500/30"
           />
           <h1 class="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
             Салом{{ tgName ? ', ' + tgName : '' }}!
           </h1>
           <p class="text-slate-500 text-lg">Введите ваш номер телефона</p>
        </div>

        <div class="space-y-6">
          <label class="block space-y-2 group">
             <span class="text-sm font-bold text-slate-400 uppercase tracking-wider ml-1 group-focus-within:text-yellow-500 transition-colors">Номер телефона</span>
             <div class="flex space-x-2">
               <!-- Country Selector -->
               <div class="relative w-1/3">
                 <select v-model="selectedCountry" class="w-full h-full bg-gray-50 border-2 border-transparent focus:border-yellow-400/50 focus:bg-white rounded-2xl p-4 text-lg font-bold outline-none transition-all appearance-none">
                   <option v-for="c in countries" :key="c.code + c.name" :value="c.code">
                     {{ c.flag }} {{ c.code }}
                   </option>
                 </select>
                 <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                 </div>
               </div>
               
               <!-- Phone Input -->
               <div class="relative flex-1">
                 <input v-model="phone" type="tel" placeholder="Номер телефона" class="w-full bg-gray-50 border-2 border-transparent focus:border-yellow-400/50 focus:bg-white rounded-2xl p-4 text-xl font-bold outline-none transition-all placeholder-gray-300 text-slate-800" />
                 <div class="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" v-if="phone.length > 5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                 </div>
               </div>
             </div>
          </label>
          
          <button @click="handleLogin" :disabled="loading" class="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all hover:-translate-y-1 hover:shadow-2xl disabled:opacity-70 disabled:transform-none mt-4 flex items-center justify-center space-x-2">
            <span v-if="!loading">Войти</span>
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </button>
        </div>
      </div>

      <div v-else-if="step === 2" class="space-y-6">
        <div class="mb-4">
           <h2 class="text-3xl font-bold text-slate-900 mb-2">О себе</h2>
           <p class="text-slate-500">Заполните данные для профиля</p>
        </div>

        <div class="space-y-4">
            <input v-model="registration.name" placeholder="Имя (ФИО)" class="w-full bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl p-4 text-lg font-bold outline-none transition-all" />
            <input v-model="registration.age" type="number" placeholder="Возраст" class="w-full bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl p-4 text-lg font-bold outline-none transition-all" />
            
            <div v-if="needsPhone" class="flex space-x-2">
                <select v-model="selectedCountry" class="w-1/3 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl p-4 text-lg font-bold outline-none transition-all">
                    <option v-for="c in countries" :key="'reg-'+c.code + c.name" :value="c.code">
                        {{ c.flag }} {{ c.code }}
                    </option>
                </select>
                <input v-model="registration.phone" type="tel" placeholder="Номер телефона" class="flex-1 bg-gray-50 border-2 border-transparent focus:border-yellow-400 rounded-2xl p-4 text-lg font-bold outline-none transition-all" />
            </div>
        </div>

        <button @click="handleRegister" :disabled="loading" class="w-full bg-yellow-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-yellow-500/20 active:scale-[0.98] transition-all hover:-translate-y-1 mt-4">
            <span v-if="!loading">Завершить регистрацию</span>
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
        </button>
      </div>

      <p class="text-center text-gray-400 text-sm mt-8">
          Продолжая, вы соглашаетесь с <a href="#" class="text-slate-800 font-bold hover:text-yellow-500 transition-colors">правилами сервиса</a>
      </p>
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
