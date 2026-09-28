<template>
  <div v-if="show" class="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
    <div class="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200 my-8">
      
      <!-- Header -->
      <div class="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
        <div>
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            AI Passport Scanner
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Безопасное сканирование паспорта и документов</p>
        </div>
        <button @click="closeModal" class="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- STEP 1: Upload / Multi-photo Selection -->
      <div v-if="step === 'upload'" class="space-y-6">
        <p class="text-sm text-slate-600">
          Сфотографируйте или загрузите главную страницу паспорта (или обе стороны ID-карты).
        </p>

        <!-- Image Grid -->
        <div class="grid grid-cols-2 gap-3">
          <div 
            v-for="(img, idx) in images" 
            :key="idx"
            class="relative aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-200 group bg-slate-50"
          >
            <img :src="img" class="w-full h-full object-cover" alt="Document page" />
            <button 
              @click="removeImage(idx)"
              class="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition-transform active:scale-90"
              title="Удалить снимок"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span class="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Стр. {{ idx + 1 }}
            </span>
          </div>

          <!-- Add Photo Card -->
          <div 
            v-if="images.length < 4"
            @click="triggerFileInput"
            class="aspect-[4/3] border-2 border-dashed border-blue-300 rounded-2xl flex flex-col items-center justify-center p-4 bg-blue-50/50 hover:bg-blue-50 cursor-pointer transition-all hover:border-blue-500 group"
          >
            <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span class="text-xs font-bold text-blue-600">
              {{ images.length === 0 ? 'Загрузить фото' : 'Добавить страницу' }}
            </span>
            <span class="text-[10px] text-slate-400 mt-1">До 4 снимков (JPG, PNG, WEBP)</span>
          </div>
        </div>

        <input 
          type="file" 
          ref="fileInput" 
          class="hidden" 
          accept="image/jpeg,image/png,image/webp" 
          multiple
          @change="handleFileSelect" 
        />

        <!-- Action Buttons -->
        <div class="flex flex-col gap-3 pt-2">
          <button 
            @click="startScan"
            :disabled="images.length === 0"
            class="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Распознать документ AI
          </button>
          <button 
            @click="closeModal"
            class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-2xl transition-colors text-sm"
          >
            Ввести данные вручную
          </button>
        </div>
      </div>

      <!-- STEP 2: Scanning Loading State -->
      <div v-else-if="step === 'scanning'" class="py-12 flex flex-col items-center justify-center text-center space-y-4">
        <div class="relative w-20 h-20">
          <div class="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-75"></div>
          <div class="relative w-20 h-20 rounded-full border-4 border-blue-600 border-t-transparent animate-spin flex items-center justify-center">
            <svg class="w-8 h-8 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-800">Идёт мультимодальное распознавание...</h3>
          <p class="text-xs text-slate-500 mt-1">OpenAI Vision проверят текст, фасеты и контрольные суммы MRZ</p>
        </div>
      </div>

      <!-- STEP 3: Quality Check Warning -->
      <div v-else-if="step === 'quality_warning'" class="space-y-6">
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <svg class="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 class="text-sm font-bold text-amber-900">Качество фотографии недостаточно</h4>
            <p class="text-xs text-amber-700 mt-1">
              AI обнаружил следующие проблемы при сканировании:
            </p>
            <ul class="list-disc list-inside text-xs text-amber-800 mt-2 space-y-1">
              <li v-for="(warn, i) in warnings" :key="i">{{ warn }}</li>
            </ul>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <button 
            @click="step = 'upload'"
            class="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            Переснять документ
          </button>
          <button 
            @click="proceedToVerify"
            class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition-colors text-sm"
          >
            Всё равно проверить распознанное
          </button>
        </div>
      </div>

      <!-- STEP 4: Human Verification Form -->
      <div v-else-if="step === 'verify'" class="space-y-5">
        <div class="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
          <span class="text-xs font-bold text-blue-900 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Проверьте и подтвердите данные
          </span>
          <span class="text-[10px] bg-blue-200 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase">
            {{ documentTypeDisplay }}
          </span>
        </div>

        <!-- Discrepancy / Warnings Box -->
        <div v-if="conflicts.length > 0 || warnings.length > 0" class="p-3 bg-yellow-50 border border-yellow-200 rounded-xl space-y-1">
          <div v-for="(c, i) in conflicts" :key="'c'+i" class="text-xs font-bold text-amber-800 flex items-center gap-1">
            ⚠ {{ c }}
          </div>
          <div v-for="(w, i) in warnings" :key="'w'+i" class="text-xs text-amber-700">
            ℹ {{ w }}
          </div>
        </div>

        <!-- Form Fields -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          <!-- Surname -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Фамилия</label>
            <input 
              v-model="formData.lastName" 
              type="text" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Иванов"
            />
          </div>

          <!-- Given Name -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Имя</label>
            <input 
              v-model="formData.firstName" 
              type="text" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Иван"
            />
          </div>

          <!-- Patronymic -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Отчество (если есть)</label>
            <input 
              v-model="formData.middleName" 
              type="text" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Иванович"
            />
          </div>

          <!-- Birth Date -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Дата рождения</label>
            <input 
              v-model="formData.birthDate" 
              type="date" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <!-- Gender -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Пол</label>
            <select 
              v-model="formData.gender" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">-- Выберите пол --</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>

          <!-- Doc Number -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Номер документа</label>
            <input 
              v-model="formData.docNumber" 
              type="text" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold tracking-wider text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="A1234567"
            />
          </div>

          <!-- Doc Type -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Тип документа</label>
            <select 
              v-model="formData.docType" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="Загранпаспорт">Загранпаспорт</option>
              <option value="Паспорт">Внутренний паспорт</option>
              <option value="ID-карта">ID-карта</option>
              <option value="Свидетельство о рождении">Свидетельство о рождении</option>
            </select>
          </div>

          <!-- Citizenship -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Гражданство</label>
            <select 
              v-model="formData.citizenship" 
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <!-- Error Banner -->
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 text-xs text-red-700 font-bold rounded-xl">
          {{ error }}
        </div>

        <!-- Buttons -->
        <div class="flex flex-col gap-2 pt-2">
          <button 
            @click="confirmData"
            class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Подтвердить данные
          </button>
          <button 
            @click="step = 'upload'"
            class="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 font-semibold"
          >
            Сфотографировать другой документ
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { compressImage } from '../utils/imageCompression';

export const NATIONALITY_MAP = {
  'TJK': 'Таджикистан', 'TAJIKISTAN': 'Таджикистан',
  'RUS': 'Россия', 'RUSSIA': 'Россия',
  'UZB': 'Узбекистан', 'UZBEKISTAN': 'Узбекистан',
  'KAZ': 'Казахстан', 'KAZAKHSTAN': 'Казахстан',
  'KGZ': 'Кыргызстан', 'KYRGYZSTAN': 'Кыргызстан',
  'TKM': 'Туркменистан', 'TURKMENISTAN': 'Туркменистан',
  'BLR': 'Беларусь', 'BELARUS': 'Беларусь',
  'UKR': 'Украина', 'UKRAINE': 'Украина',
  'ARM': 'Армения', 'ARMENIA': 'Армения',
  'GEO': 'Грузия', 'GEORGIA': 'Грузия'
};

export default {
  name: 'PassportScannerModal',
  props: {
    show: { type: Boolean, default: false },
    passengerIndex: { type: Number, default: 0 }
  },
  emits: ['close', 'confirm'],
  data() {
    return {
      step: 'upload', // 'upload' | 'scanning' | 'quality_warning' | 'verify'
      images: [],
      scanning: false,
      error: null,
      quality: null,
      warnings: [],
      conflicts: [],
      confidence: {},
      documentTypeDisplay: 'Паспорт',
      formData: {
        lastName: '',
        firstName: '',
        middleName: '',
        birthDate: '',
        gender: '',
        docNumber: '',
        docType: 'Загранпаспорт',
        citizenship: 'Таджикистан',
        customCitizenship: ''
      },
      countries: [
        'Таджикистан',
        'Россия',
        'Узбекистан',
        'Казахстан',
        'Кыргызстан',
        'Туркменистан',
        'Беларусь',
        'Украина',
        'Армения',
        'Грузия',
        'Другое'
      ]
    };
  },
  watch: {
    show(val) {
      if (val) {
        this.resetState();
      }
    }
  },
  methods: {
    resetState() {
      this.step = 'upload';
      this.images = [];
      this.scanning = false;
      this.error = null;
      this.quality = null;
      this.warnings = [];
      this.conflicts = [];
      this.confidence = {};
      this.formData = {
        lastName: '',
        firstName: '',
        middleName: '',
        birthDate: '',
        gender: '',
        docNumber: '',
        docType: 'Загранпаспорт',
        citizenship: 'Таджикистан',
        customCitizenship: ''
      };
    },
    closeModal() {
      this.$emit('close');
    },
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    async handleFileSelect(event) {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;

      for (const file of files) {
        if (this.images.length >= 4) break;
        try {
          const compressedUri = await compressImage(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.6
          });
          this.images.push(compressedUri);
        } catch (e) {
          console.error('[Scanner UI] Image compression failed:', e);
        }
      }
      event.target.value = '';
    },
    removeImage(idx) {
      this.images.splice(idx, 1);
    },
    async startScan() {
      if (!this.images.length) return;
      this.step = 'scanning';
      this.error = null;

      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://poputki-backend-9dv6.onrender.com/api';
        const res = await fetch(`${apiBaseUrl}/ocr/scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mana-man': 'nasa.2006'
          },
          body: JSON.stringify({ images: this.images })
        });

        const json = await res.json();

        if (!res.ok || json.status !== 'OK') {
          throw new Error(json.message || 'Сбой автоматического распознавания');
        }

        const data = json.data;
        const doc = data.document || {};
        this.quality = data.quality || {};
        this.warnings = data.warnings || [];
        this.conflicts = data.conflicts || [];
        this.confidence = data.confidence || {};

        // Map extracted fields to form
        this.formData.lastName = doc.surname || '';
        this.formData.firstName = doc.given_name || '';
        this.formData.middleName = doc.patronymic || '';
        this.formData.birthDate = doc.birth_date || '';
        this.formData.docNumber = doc.document_number || '';
        
        if (doc.sex === 'M' || doc.sex === 'MALE') this.formData.gender = 'male';
        else if (doc.sex === 'F' || doc.sex === 'FEMALE') this.formData.gender = 'female';
        else this.formData.gender = '';

        const rawNat = (doc.nationality || doc.country || '').toUpperCase();
        const mappedCitizenship = NATIONALITY_MAP[rawNat] || doc.nationality || doc.country;
        if (mappedCitizenship) {
          if (this.countries.includes(mappedCitizenship)) {
            this.formData.citizenship = mappedCitizenship;
          } else {
            this.formData.citizenship = 'Другое';
            this.formData.customCitizenship = mappedCitizenship;
          }
        }

        this.documentTypeDisplay = doc.document_type === 'id_card' ? 'ID-Карта' : 'Паспорт';
        this.formData.docType = doc.document_type === 'id_card' ? 'ID-карта' : 'Загранпаспорт';

        if (this.quality && this.quality.acceptable === false) {
          this.step = 'quality_warning';
        } else {
          this.step = 'verify';
        }
      } catch (e) {
        console.error('[AI Passport Scanner]:', e);
        this.error = e.message || 'Не удалось распознать документ. Введите данные вручную.';
        this.step = 'verify';
      }
    },
    proceedToVerify() {
      this.step = 'verify';
    },
    confirmData() {
      if (!this.formData.lastName.trim() || !this.formData.firstName.trim()) {
        this.error = 'Укажите фамилию и имя пассажира';
        return;
      }

      this.$emit('confirm', {
        passengerIndex: this.passengerIndex,
        data: {
          lastName: this.formData.lastName.trim(),
          firstName: this.formData.firstName.trim(),
          middleName: this.formData.middleName.trim(),
          birthDate: this.formData.birthDate,
          gender: this.formData.gender,
          docNumber: this.formData.docNumber.trim(),
          docType: this.formData.docType,
          citizenship: this.formData.citizenship,
          customCitizenship: this.formData.customCitizenship
        }
      });
      this.closeModal();
    }
  }
};
</script>
