<script>
import api from '../api';
import { getTelegramUser } from '../telegram';
import acquisitionService from '../services/acquisitionService';

export default {
    data() {
        return {
            user: null,
            vehicle: null,
            loading: true,
            rides: [],
            stats: {
                passenger: 0,
                driver: 0
            },
            referral: {
                code: '',
                url: '',
                invitedCount: 0,
                loading: false
            },
            marketingConsent: false,
            consentLoading: false,
            copySuccess: false
        }
    },
    computed: {
        tgUser() {
            return getTelegramUser();
        }
    },
    async mounted() {
        await this.fetchProfile();
        this.fetchReferralLink();
        this.fetchMarketingConsent();
    },
    methods: {
        async fetchProfile() {
            const u = JSON.parse(localStorage.getItem('user') || 'null');
            if (!u) {
                this.$router.push('/auth');
                return;
            }
            try {
                const res = await api.get(`/users/${u.id}/profile`);
                if (res.data) {
                    this.user = res.data;
                    localStorage.setItem('user', JSON.stringify(res.data));
                }
            } catch (e) {
                console.error(e);
            }
        },
        async fetchVehicle() {
            if (!this.user?.id) return;
            try {
                const res = await api.get(`/users/${this.user.id}/vehicle`);
                this.vehicle = res.data;
            } catch (e) {
                console.error(e);
            }
        },
        async fetchReferralLink() {
            if (!this.user?.id) return;
            this.referral.loading = true;
            try {
                const res = await api.post('/referrals/link');
                if (res.data?.referral_code) {
                    this.referral.code = res.data.referral_code;
                    this.referral.url = res.data.referral_url;
                }
                const meRes = await api.get('/referrals/me');
                if (meRes.data?.total_invitees !== undefined) {
                    this.referral.invitedCount = meRes.data.total_invitees;
                }
            } catch (e) {
                console.error('[Referral] Fetch link error:', e);
            } finally {
                this.referral.loading = false;
            }
        },
        async fetchMarketingConsent() {
            if (!this.user?.id) return;
            try {
                const res = await api.get('/marketing-consents/me');
                const list = res.data?.consents || [];
                const active = list.some(c => c.status === 'granted');
                this.marketingConsent = Boolean(active);
            } catch (e) {
                console.error('[Consent] Fetch error:', e);
            }
        },
        async toggleMarketingConsent() {
            this.consentLoading = true;
            try {
                if (this.marketingConsent) {
                    await api.post('/marketing-consents', {
                        channel: 'all',
                        purpose: 'promotions',
                        consent_source: 'profile_settings'
                    });
                } else {
                    await api.post('/marketing-consents/revoke', {
                        channel: 'all',
                        purpose: 'promotions'
                    });
                }
            } catch (e) {
                console.error('[Consent] Update error:', e);
                this.marketingConsent = !this.marketingConsent;
            } finally {
                this.consentLoading = false;
            }
        },
        copyReferralLink() {
            if (!this.referral.url) return;
            navigator.clipboard?.writeText(this.referral.url);
            this.copySuccess = true;
            setTimeout(() => { this.copySuccess = false; }, 2000);
            acquisitionService.trackShareClicked({
                referral_code: this.referral.code,
                channel: 'clipboard'
            });
        },
        shareWhatsApp() {
            if (!this.referral.url) return;
            const text = encodeURIComponent(`Привет! Забронируй поездку или билет на POPUTKI.ONLINE: ${this.referral.url}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
            acquisitionService.trackShareClicked({
                referral_code: this.referral.code,
                channel: 'whatsapp'
            });
        },
        shareTelegram() {
            if (!this.referral.url) return;
            const url = encodeURIComponent(this.referral.url);
            const text = encodeURIComponent('Поездки между городами и билеты на автобусы на POPUTKI.ONLINE');
            window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
            acquisitionService.trackShareClicked({
                referral_code: this.referral.code,
                channel: 'telegram'
            });
        },
        async shareNative() {
            if (!this.referral.url) return;
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'POPUTKI.ONLINE',
                        text: 'Поездки между городами и билеты на автобусы на POPUTKI.ONLINE',
                        url: this.referral.url
                    });
                    acquisitionService.trackShareClicked({
                        referral_code: this.referral.code,
                        channel: 'native_share'
                    });
                } catch {
                    // User cancelled share dialog
                }
            } else {
                this.copyReferralLink();
            }
        },
        logout() {
           localStorage.removeItem('user');
           localStorage.removeItem('token');
           this.$router.push('/');
        }
    }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    <!-- Header Background -->
    <div class="bg-amber-500 h-48 rounded-b-[40px] relative overflow-hidden">
       <div class="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
       <div class="absolute -bottom-32 -left-32 w-64 h-64 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
    </div>

    <!-- Profile Card -->
    <div class="px-6 -mt-32 relative z-10">
       <div class="bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.05)] border border-white/50 text-center">
        <div v-if="user?.photo_url || tgUser?.photo_url" class="w-24 h-24 rounded-full mx-auto shadow-xl shadow-orange-500/20 mb-4 border-4 border-white overflow-hidden bg-white">
           <img :src="user?.photo_url || tgUser?.photo_url" alt="Profile" class="w-full h-full object-cover" />
         </div>
         <div v-else class="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto flex items-center justify-center text-4xl font-bold text-white shadow-xl shadow-orange-500/20 mb-4 border-4 border-white">
           {{ (user?.name || tgUser?.first_name || 'U')[0] }}
         </div>
         
         <h2 class="text-2xl font-bold text-slate-800">
           {{ user?.name || (tgUser ? (tgUser.last_name ? `${tgUser.first_name} ${tgUser.last_name}` : tgUser.first_name) : 'Загрузка...') }}
         </h2>
         
         <div v-if="user?.tg_username || tgUser?.username || user?.telegram_id || tgUser?.id" class="mt-2 flex flex-col items-center gap-1">
            <span v-if="user?.tg_username || tgUser?.username" class="text-amber-600 font-bold text-sm bg-amber-50 px-3 py-1 rounded-full border border-amber-100/50">
              @{{ user?.tg_username || tgUser?.username }}
            </span>
            <span v-if="user?.telegram_id || tgUser?.id" class="text-slate-400 text-[10px] font-medium tracking-tight uppercase">
              ID: {{ user?.telegram_id || tgUser?.id }}
            </span>
         </div>

         <p v-if="user?.phone" class="text-slate-500 font-medium mt-3">{{ user.phone }}</p>

         <div class="flex justify-center mt-6 gap-2 flex-wrap">
            <span v-if="user?.age" class="px-4 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold uppercase tracking-wide">
              {{ user.age }} лет
            </span>
            <span class="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-yellow-500 mr-1 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              {{ user?.rating || '5.0' }}
            </span>
          </div>
       </div>
    </div>

    <!-- Menu -->
    <div class="px-6 mt-6 space-y-4">
      <div class="bg-white rounded-[32px] p-2 shadow-sm border border-gray-100">
        
        <button @click="$router.push('/preferences')" class="flex items-center w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors group">
          <div class="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          <div class="text-left flex-1">
            <h3 class="font-bold text-slate-800">Предпочтения</h3>
            <p class="text-sm text-gray-400">Настроить свои привычки</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>

        <div class="h-px bg-gray-50 mx-4"></div>

        <button v-if="vehicle" @click="$router.push('/vehicle')" class="flex items-center w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors group">
           <div class="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
             <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
               <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
             </svg>
           </div>
           <div class="text-left flex-1">
             <h3 class="font-bold text-slate-800">Мой автомобиль</h3>
             <p class="text-sm text-gray-400">{{ vehicle.make }} {{ vehicle.model }}</p>
           </div>
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>

        <button v-else @click="$router.push('/vehicle')" class="flex items-center w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors group">
            <div class="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mr-4 group-hover:bg-yellow-100 group-hover:text-yellow-600 transition-colors">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
             <div class="text-left flex-1">
             <h3 class="font-bold text-slate-800">Добавить транспорт</h3>
             <p class="text-sm text-gray-400">Для предложений поездок</p>
           </div>
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div class="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
        <button @click="$router.push('/my-rides')" class="flex items-center w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors group">
          <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
            </svg>
          </div>
          <div class="text-left flex-1">
            <h3 class="font-bold text-slate-800">Мои поездки</h3>
            <p class="text-sm text-gray-400">История поездок и бронирований</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>

        <div class="h-px bg-gray-50 mx-4"></div>

        <button @click="$router.push('/my-bus-tickets')" class="flex items-center w-full p-4 hover:bg-gray-50 rounded-2xl transition-colors group">
          <div class="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 19v2M17 19v2"/>
            </svg>
          </div>
          <div class="text-left flex-1">
            <h3 class="font-bold text-slate-800">Мои билеты</h3>
            <p class="text-sm text-gray-400">Автобусные бронирования</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>

        <div class="h-px bg-gray-50 mx-4"></div>

        <button class="w-full text-left p-4 hover:bg-gray-50 rounded-2xl flex justify-between items-center group transition-colors">
          <div class="flex items-center space-x-4">
             <div class="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
             </div>
             <div>
               <h3 class="font-bold text-slate-800">Настройки</h3>
               <p class="text-sm text-gray-400">Уведомления, язык</p>
             </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <!-- Referral Program Card -->
      <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[32px] p-5 text-white shadow-lg shadow-teal-500/10">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <span class="text-xl">🎁</span>
            <h3 class="font-bold text-lg">Рекомендовать друзьям</h3>
          </div>
          <span v-if="referral.invitedCount > 0" class="text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
            Приглашено: {{ referral.invitedCount }}
          </span>
        </div>
        <p class="text-xs text-white/90 mb-4 leading-relaxed">
          Поделитесь вашей ссылкой на POPUTKI.ONLINE. Ваши друзья откроют удобный сервис поездок и автобусных билетов!
        </p>

        <div v-if="referral.url" class="space-y-3">
          <div class="flex items-center bg-black/20 rounded-2xl p-2.5 backdrop-blur-sm border border-white/10">
            <span class="text-xs text-white/80 font-mono truncate flex-1 px-2 select-all">{{ referral.url }}</span>
            <button @click="copyReferralLink" class="px-3 py-1.5 bg-white text-teal-800 rounded-xl text-xs font-bold hover:bg-teal-50 transition-colors shadow-sm">
              {{ copySuccess ? '✓ Скопировано' : 'Копировать' }}
            </button>
          </div>

          <div class="flex gap-2">
            <button @click="shareTelegram" class="flex-1 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-white/10">
              <span>✈️ Telegram</span>
            </button>
            <button @click="shareWhatsApp" class="flex-1 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-white/10">
              <span>💬 WhatsApp</span>
            </button>
            <button @click="shareNative" class="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors border border-white/10" title="Поделиться">
              <span>🔗</span>
            </button>
          </div>
        </div>
        <div v-else class="text-xs text-white/70 py-2">
          Загрузка персональной ссылки...
        </div>
      </div>

      <!-- Notifications & Marketing Consent -->
      <div class="bg-white rounded-[32px] p-5 shadow-sm border border-gray-100">
        <div class="flex items-center justify-between">
          <div class="pr-4">
            <h4 class="font-bold text-slate-800 text-sm">Маркетинговые предложения</h4>
            <p class="text-xs text-gray-500 mt-0.5">Получать новости, акции и специальные предложения POPUTKI.ONLINE</p>
            <p class="text-[11px] text-gray-400 mt-1">Только по вашему прямому согласию. Никакого спама.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input 
              type="checkbox" 
              v-model="marketingConsent" 
              @change="toggleMarketingConsent" 
              :disabled="consentLoading"
              class="sr-only peer"
            >
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      <button @click="logout" class="w-full bg-white text-red-500 font-bold py-4 rounded-3xl shadow-sm border border-red-50 hover:bg-red-50 transition-colors flex items-center justify-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        <span>Выйти</span>
      </button>
    </div>
  </div>
</template>
