<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
          <span>Мой автопарк</span>
          <span v-if="!loading && buses.length > 0" class="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600">
            {{ buses.length }}
          </span>
        </h2>
        <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">
          Транспортные средства, схемы салона и характеристики
        </p>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <button
          v-if="canEdit"
          @click="openAddModal"
          class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span class="text-lg leading-none">+</span>
          <span>Добавить автобус</span>
        </button>
      </div>
    </div>

    <!-- Search & Filter Bar (when buses exist or searching) -->
    <div v-if="buses.length > 0 || searchQuery || statusFilter !== 'all'" class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      <!-- Search Input -->
      <div class="relative flex-1">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Поиск по названию, марке, модели или номеру..."
          class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
        >
          ✕
        </button>
      </div>

      <!-- Status Filter Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
        <button
          v-for="st in statusFilterOptions"
          :key="st.value"
          @click="statusFilter = st.value"
          :class="statusFilter === st.value ? 'bg-slate-900 text-white font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium'"
          class="px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer"
        >
          {{ st.label }}
        </button>
      </div>
    </div>

    <!-- Loading Skeleton State -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="n in 3" :key="n" class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4 animate-pulse">
        <div class="h-44 bg-slate-100 rounded-2xl w-full"></div>
        <div class="space-y-2">
          <div class="h-5 bg-slate-100 rounded-md w-3/4"></div>
          <div class="h-3 bg-slate-100 rounded-md w-1/2"></div>
        </div>
        <div class="flex gap-2 pt-2">
          <div class="h-8 bg-slate-100 rounded-xl w-1/3"></div>
          <div class="h-8 bg-slate-100 rounded-xl w-1/3"></div>
        </div>
      </div>
    </div>

    <!-- Error / Retry State -->
    <div v-else-if="fetchError" class="bg-white rounded-3xl p-10 text-center border border-rose-100 shadow-sm space-y-4">
      <div class="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center text-2xl font-bold">
        ⚠️
      </div>
      <div>
        <h3 class="text-base font-bold text-slate-900">Не удалось загрузить автопарк</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">{{ fetchError }}</p>
      </div>
      <button
        @click="fetchBuses"
        class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
      >
        <span>🔄</span>
        <span>Повторить</span>
      </button>
    </div>

    <!-- Empty State (No Buses in Fleet) -->
    <div v-else-if="buses.length === 0" class="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-100 shadow-sm space-y-5">
      <div class="w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center text-4xl shadow-inner">
        🚌
      </div>
      <div class="space-y-2 max-w-lg mx-auto">
        <h3 class="text-xl font-bold text-slate-900">В автопарке пока нет автобусов</h3>
        <p class="text-xs text-slate-500 leading-relaxed">
          Добавьте автобус один раз, чтобы хранить его фотографии, вместимость и характеристики и использовать их при создании рейсов.
        </p>
      </div>
      <div v-if="canEdit" class="pt-2">
        <button
          @click="openAddModal"
          class="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <span class="text-lg leading-none">+</span>
          <span>Добавить автобус</span>
        </button>
      </div>
    </div>

    <!-- Search No Results -->
    <div v-else-if="filteredBuses.length === 0" class="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm space-y-3">
      <div class="text-3xl">🔍</div>
      <h3 class="text-base font-bold text-slate-900">Ничего не найдено</h3>
      <p class="text-xs text-slate-400">По запросу "{{ searchQuery }}" автобусы не найдены</p>
      <button
        @click="searchQuery = ''; statusFilter = 'all'"
        class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
      >
        Сбросить фильтры
      </button>
    </div>

    <!-- Bus Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="bus in filteredBuses"
        :key="bus.id"
        class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
      >
        <!-- Photo Container -->
        <div class="relative h-48 bg-slate-100 overflow-hidden">
          <img
            v-if="getMainPhotoUrl(bus)"
            :src="getMainPhotoUrl(bus)"
            :alt="bus.name"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <span class="text-4xl mb-1">🚌</span>
            <span class="text-[11px] font-semibold">Нет фото</span>
          </div>

          <!-- Status Badge Overlay -->
          <div class="absolute top-3 left-3">
            <span
              :class="getStatusBadgeClass(bus.status)"
              class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-sm inline-flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="getStatusDotClass(bus.status)"></span>
              {{ getStatusLabel(bus.status) }}
            </span>
          </div>

          <!-- Deck Type Badge Overlay -->
          <div class="absolute top-3 right-3">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-900/80 text-white backdrop-blur-md">
              {{ bus.bus_type === 'double' ? '2 этажа' : '1 этаж' }}
            </span>
          </div>

          <!-- Total Photos Counter -->
          <div v-if="Array.isArray(bus.photos) && bus.photos.length > 1" class="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm flex items-center gap-1">
            <span>📷</span>
            <span>{{ bus.photos.length }}</span>
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div class="space-y-2">
            <!-- Brand & Model + Internal Name -->
            <div>
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-extrabold text-slate-900 text-base leading-tight">
                  {{ bus.brand }} {{ bus.model }}
                </h3>
              </div>
              <p class="text-xs text-amber-600 font-bold mt-0.5">
                {{ bus.name }}
              </p>
            </div>

            <!-- License Plate & Specs -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-mono font-black text-xs tracking-wider">
                {{ bus.license_plate }}
              </span>

              <span class="text-xs font-bold text-slate-700">
                {{ bus.total_seats }} мест
                <span v-if="bus.bus_type === 'double' && bus.floor1_seats" class="text-[11px] text-slate-400 font-normal">
                  ({{ bus.floor1_seats }} + {{ bus.floor2_seats }})
                </span>
              </span>

              <span v-if="bus.year_built" class="text-[11px] text-slate-400 font-medium">
                • {{ bus.year_built }} г.
              </span>
            </div>

            <!-- Amenities Badges (Compact) -->
            <div v-if="Array.isArray(bus.amenities) && bus.amenities.length > 0" class="flex flex-wrap gap-1 pt-1">
              <span
                v-for="amenity in bus.amenities.slice(0, 4)"
                :key="amenity"
                class="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600 inline-flex items-center gap-1"
              >
                <span>{{ getAmenityIcon(amenity) }}</span>
                <span>{{ getAmenityLabel(amenity) }}</span>
              </span>
              <span v-if="bus.amenities.length > 4" class="px-1.5 py-0.5 text-[10px] text-slate-400 font-bold">
                +{{ bus.amenities.length - 4 }}
              </span>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              @click="openDetailsModal(bus)"
              class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer flex-1"
            >
              Карточка
            </button>

            <button
              v-if="canEdit"
              @click="openEditModal(bus)"
              class="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-all cursor-pointer flex-1"
            >
              Редактировать
            </button>

            <button
              v-if="isOwner"
              @click="openArchiveConfirm(bus)"
              class="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-all cursor-pointer"
              title="Архивировать"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- ADD / EDIT BUS MODAL                                                  -->
    <!-- ===================================================================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showFormModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <!-- Backdrop -->
          <div @click="closeFormModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"></div>

          <!-- Modal Window -->
          <div class="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10">
            <!-- Modal Header -->
            <div class="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
              <div>
                <h3 class="text-lg sm:text-xl font-bold text-slate-900">
                  {{ isEditing ? 'Редактировать автобус' : 'Добавить автобус в автопарк' }}
                </h3>
                <p class="text-xs text-slate-400">
                  {{ isEditing ? form.name : 'Характеристики и фотографии транспортного средства' }}
                </p>
              </div>
              <button @click="closeFormModal" class="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold text-sm">
                ✕
              </button>
            </div>

            <!-- Modal Form Body (Scrollable) -->
            <div class="p-6 overflow-y-auto space-y-6 flex-1">
              <!-- Form Error Banner -->
              <div v-if="formError" class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                <span class="text-base leading-none">⚠️</span>
                <span>{{ formError }}</span>
              </div>

              <!-- Section 1: Basic Information -->
              <div class="space-y-4">
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>1. Основные данные</span>
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- Internal Name -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Внутреннее название *</label>
                    <input
                      v-model="form.name"
                      type="text"
                      placeholder="Например: Setra #1 Синяя"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      maxlength="100"
                    />
                    <p class="text-[10px] text-slate-400 mt-1">Отображается внутри кабинета для удобства</p>
                  </div>

                  <!-- License Plate -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Гос. номер *</label>
                    <input
                      v-model="form.license_plate"
                      type="text"
                      placeholder="01 777 TJ 01"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 uppercase focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      maxlength="30"
                    />
                  </div>

                  <!-- Brand -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Марка *</label>
                    <input
                      v-model="form.brand"
                      type="text"
                      placeholder="Setra, Neoplan, Yutong..."
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      maxlength="50"
                    />
                  </div>

                  <!-- Model -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Модель *</label>
                    <input
                      v-model="form.model"
                      type="text"
                      placeholder="S 431 DT, Cityliner..."
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      maxlength="80"
                    />
                  </div>

                  <!-- Year Built -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Год выпуска</label>
                    <input
                      v-model.number="form.year_built"
                      type="number"
                      placeholder="2018"
                      min="1950"
                      max="2100"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <!-- Color -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Цвет кузова</label>
                    <input
                      v-model="form.color"
                      type="text"
                      placeholder="Белый, Синий..."
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      maxlength="30"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 2: Deck Type & Capacity -->
              <div class="space-y-4 pt-4 border-t border-slate-100">
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>2. Этажность и вместимость</span>
                </h4>

                <!-- Bus Type Radio Selector -->
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    @click="setBusType('single')"
                    :class="form.bus_type === 'single' ? 'border-amber-500 bg-amber-50/40 text-amber-900 font-bold ring-2 ring-amber-500/20' : 'border-slate-200 bg-slate-50 text-slate-700'"
                    class="p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <span class="text-2xl">🚌</span>
                    <div>
                      <div class="text-xs font-bold">Одноэтажный</div>
                      <div class="text-[10px] text-slate-400">Стандартный салон</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    @click="setBusType('double')"
                    :class="form.bus_type === 'double' ? 'border-amber-500 bg-amber-50/40 text-amber-900 font-bold ring-2 ring-amber-500/20' : 'border-slate-200 bg-slate-50 text-slate-700'"
                    class="p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <span class="text-2xl">🚍</span>
                    <div>
                      <div class="text-xs font-bold">Двухэтажный</div>
                      <div class="text-[10px] text-slate-400">1-й и 2-й этажи</div>
                    </div>
                  </button>
                </div>

                <!-- Single Deck Capacity -->
                <div v-if="form.bus_type === 'single'" class="max-w-xs">
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">Количество мест *</label>
                  <input
                    v-model.number="form.total_seats"
                    type="number"
                    min="1"
                    max="150"
                    placeholder="53"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <!-- Double Deck Capacity Inputs -->
                <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-amber-50/30 border border-amber-200/50">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Мест на 1 этаже *</label>
                    <input
                      v-model.number="form.floor1_seats"
                      type="number"
                      min="1"
                      max="100"
                      placeholder="22"
                      class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Мест на 2 этаже *</label>
                    <input
                      v-model.number="form.floor2_seats"
                      type="number"
                      min="1"
                      max="100"
                      placeholder="56"
                      class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Всего мест (автоматически)</label>
                    <input
                      :value="computedTotalSeats"
                      type="number"
                      disabled
                      class="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-extrabold text-amber-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                <!-- Interactive Seat Layout Preview Toggle -->
                <div class="pt-2">
                  <button
                    type="button"
                    @click="showSeatPreview = !showSeatPreview"
                    class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span>{{ showSeatPreview ? '▼ Скрыть предпросмотр схемы' : '▶ Предпросмотр схемы мест' }}</span>
                  </button>

                  <div v-if="showSeatPreview" class="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <p class="text-[11px] text-slate-500 mb-3 font-medium">
                      Предпросмотр сгенерированной схемы салона на основе выбранного количества мест:
                    </p>
                    <div class="max-w-sm mx-auto bg-white p-3 rounded-2xl shadow-inner border border-slate-100">
                      <BusSeatSelector
                        :bus-type="form.bus_type"
                        :total-seats="form.bus_type === 'single' ? (Number(form.total_seats) || 53) : (computedTotalSeats || 78)"
                        :floor1-seats="Number(form.floor1_seats) || 20"
                        :floor2-seats="Number(form.floor2_seats) || 56"
                        :model-value="[]"
                        :max-selectable="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 3: Amenities -->
              <div class="space-y-4 pt-4 border-t border-slate-100">
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>3. Удобства в автобусе</span>
                </h4>

                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  <label
                    v-for="item in canonicalAmenities"
                    :key="item.key"
                    :class="form.amenities.includes(item.key) ? 'bg-amber-500/10 border-amber-400 text-amber-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'"
                    class="p-3 rounded-xl border flex items-center gap-2 text-xs cursor-pointer transition-all hover:bg-slate-100"
                  >
                    <input
                      type="checkbox"
                      :value="item.key"
                      v-model="form.amenities"
                      class="rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span class="text-sm">{{ item.icon }}</span>
                    <span class="text-[11px] font-semibold">{{ item.label }}</span>
                  </label>
                </div>
              </div>

              <!-- Section 4: Photo Gallery -->
              <div class="space-y-4 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span>4. Фотографии автобуса (до 6 фото)</span>
                  </h4>
                  <span class="text-[11px] text-slate-400 font-bold">{{ form.photos.length }} / 6</span>
                </div>

                <!-- Photos Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    v-for="(photo, idx) in form.photos"
                    :key="photo.public_id || idx"
                    class="relative h-32 rounded-2xl overflow-hidden border-2 transition-all bg-slate-100 group"
                    :class="photo.is_main ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200'"
                  >
                    <img :src="photo.url" class="w-full h-full object-cover" />

                    <!-- Main Photo Badge / Selector -->
                    <div class="absolute top-2 left-2">
                      <button
                        type="button"
                        @click="setMainPhoto(idx)"
                        :class="photo.is_main ? 'bg-amber-500 text-white font-black' : 'bg-black/60 text-white/80 hover:bg-black/80'"
                        class="px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider backdrop-blur-sm transition-all cursor-pointer"
                      >
                        {{ photo.is_main ? '★ Главное' : 'Сделать главным' }}
                      </button>
                    </div>

                    <!-- Delete Photo Button -->
                    <button
                      type="button"
                      @click="removePhoto(idx)"
                      class="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs flex items-center justify-center shadow-md transition-all cursor-pointer"
                      title="Удалить фото"
                    >
                      ✕
                    </button>
                  </div>

                  <!-- Upload Trigger Card -->
                  <label
                    v-if="form.photos.length < 6"
                    class="h-32 rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/30 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group"
                  >
                    <span v-if="photoLoading" class="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                    <template v-else>
                      <span class="text-2xl text-slate-400 group-hover:text-amber-500 transition-colors">📷</span>
                      <span class="text-[11px] font-bold text-slate-600 group-hover:text-amber-700 mt-1">Добавить фото</span>
                      <span class="text-[9px] text-slate-400">JPG, PNG до 10MB</span>
                    </template>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      @change="handlePhotoUpload"
                      :disabled="photoLoading"
                      class="hidden"
                    />
                  </label>
                </div>
              </div>

              <!-- Section 5: Additional Details -->
              <div class="space-y-4 pt-4 border-t border-slate-100">
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>5. Дополнительные данные</span>
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- Status -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">Статус автобуса</label>
                    <select
                      v-model="form.status"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                    >
                      <option value="active">Активен (готов к рейсам)</option>
                      <option value="maintenance">На техобслуживании (ТО)</option>
                      <option value="inactive">Неактивен</option>
                    </select>
                  </div>

                  <!-- VIN -->
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">VIN номер (необязательно)</label>
                    <input
                      v-model="form.vin"
                      type="text"
                      placeholder="WDB..."
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 uppercase focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      maxlength="50"
                    />
                  </div>
                </div>

                <!-- Internal Notes -->
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1.5">
                    Внутреннее примечание
                    <span class="text-[10px] font-normal text-slate-400 ml-1">(не показывается пассажирам)</span>
                  </label>
                  <textarea
                    v-model="form.notes"
                    rows="2"
                    placeholder="Например: Закреплен за водителем Али, плановое ТО в октябре..."
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
                    maxlength="1000"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Modal Footer Buttons -->
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 z-20">
              <button
                type="button"
                @click="closeFormModal"
                class="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                @click="saveBus"
                :disabled="submitting || photoLoading"
                class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span v-if="submitting" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>{{ isEditing ? 'Сохранить изменения' : 'Создать автобус' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===================================================================== -->
    <!-- BUS DETAILS MODAL (READ-ONLY)                                         -->
    <!-- ===================================================================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDetailsModal && selectedBus"
          class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <!-- Backdrop -->
          <div @click="showDetailsModal = false" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"></div>

          <!-- Details Card -->
          <div class="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10">
            <!-- Details Header -->
            <div class="p-6 bg-slate-900 text-white flex items-start justify-between relative">
              <div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                  {{ selectedBus.bus_type === 'double' ? 'Двухэтажный лайнер' : 'Одноэтажный автобус' }}
                </span>
                <h3 class="text-xl font-black mt-1">
                  {{ selectedBus.brand }} {{ selectedBus.model }}
                </h3>
                <p class="text-xs text-amber-400 font-bold font-mono mt-0.5">
                  {{ selectedBus.name }} • {{ selectedBus.license_plate }}
                </p>
              </div>

              <button @click="showDetailsModal = false" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm transition-colors">
                ✕
              </button>
            </div>

            <!-- Details Body -->
            <div class="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <!-- Gallery Preview -->
              <div v-if="Array.isArray(selectedBus.photos) && selectedBus.photos.length > 0" class="space-y-2">
                <div class="h-64 rounded-2xl overflow-hidden bg-slate-100">
                  <img :src="activePreviewPhotoUrl || getMainPhotoUrl(selectedBus)" class="w-full h-full object-cover" />
                </div>
                <div v-if="selectedBus.photos.length > 1" class="flex gap-2 overflow-x-auto pb-1">
                  <img
                    v-for="(p, pIdx) in selectedBus.photos"
                    :key="pIdx"
                    :src="p.url"
                    @click="activePreviewPhotoUrl = p.url"
                    class="w-16 h-16 rounded-xl object-cover border-2 cursor-pointer transition-all"
                    :class="(activePreviewPhotoUrl || getMainPhotoUrl(selectedBus)) === p.url ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-transparent opacity-70 hover:opacity-100'"
                  />
                </div>
              </div>

              <!-- Specs Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Вместимость</div>
                  <div class="text-sm font-black text-slate-900 mt-0.5">{{ selectedBus.total_seats }} мест</div>
                  <div v-if="selectedBus.bus_type === 'double' && selectedBus.floor1_seats" class="text-[10px] text-slate-500">
                    1 эт: {{ selectedBus.floor1_seats }} | 2 эт: {{ selectedBus.floor2_seats }}
                  </div>
                </div>

                <div>
                  <div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Гос. номер</div>
                  <div class="text-sm font-mono font-black text-slate-900 mt-0.5">{{ selectedBus.license_plate }}</div>
                </div>

                <div>
                  <div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Статус</div>
                  <div class="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full" :class="getStatusDotClass(selectedBus.status)"></span>
                    {{ getStatusLabel(selectedBus.status) }}
                  </div>
                </div>

                <div v-if="selectedBus.year_built">
                  <div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Год выпуска</div>
                  <div class="text-xs font-bold text-slate-900 mt-0.5">{{ selectedBus.year_built }} г.</div>
                </div>

                <div v-if="selectedBus.color">
                  <div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Цвет</div>
                  <div class="text-xs font-bold text-slate-900 mt-0.5">{{ selectedBus.color }}</div>
                </div>

                <div v-if="selectedBus.vin">
                  <div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">VIN</div>
                  <div class="text-xs font-mono font-bold text-slate-900 mt-0.5 truncate">{{ selectedBus.vin }}</div>
                </div>
              </div>

              <!-- Amenities List -->
              <div v-if="Array.isArray(selectedBus.amenities) && selectedBus.amenities.length > 0" class="space-y-2">
                <h4 class="text-[10px] font-black uppercase tracking-wider text-slate-400">Удобства</h4>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="a in selectedBus.amenities"
                    :key="a"
                    class="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/50 text-amber-900 font-bold inline-flex items-center gap-1.5"
                  >
                    <span>{{ getAmenityIcon(a) }}</span>
                    <span>{{ getAmenityLabel(a) }}</span>
                  </span>
                </div>
              </div>

              <!-- Internal Notes -->
              <div v-if="selectedBus.notes" class="p-3 bg-amber-50/50 rounded-xl border border-amber-200/40 space-y-1">
                <div class="text-[10px] font-black uppercase tracking-wider text-amber-800">Внутреннее примечание:</div>
                <p class="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{{ selectedBus.notes }}</p>
              </div>

              <!-- Active Trips Warning / Info -->
              <div v-if="Array.isArray(selectedBus.active_tickets) && selectedBus.active_tickets.length > 0" class="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2">
                <div class="font-bold text-blue-900 flex items-center gap-1.5">
                  <span>📅</span>
                  <span>Назначен на активные рейсы ({{ selectedBus.active_tickets.length }}):</span>
                </div>
                <div class="divide-y divide-blue-100 text-xs">
                  <div v-for="t in selectedBus.active_tickets" :key="t.id" class="py-1.5 flex justify-between items-center text-blue-800">
                    <span class="font-bold">{{ t.from_city }} → {{ t.to_city }}</span>
                    <span class="font-mono text-[11px]">{{ t.departure_date }} {{ t.departure_time?.substring(0, 5) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Details Footer Actions -->
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                @click="showDetailsModal = false"
                class="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
              >
                Закрыть
              </button>
              <button
                v-if="canEdit"
                @click="showDetailsModal = false; openEditModal(selectedBus)"
                class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20"
              >
                Редактировать
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===================================================================== -->
    <!-- ARCHIVE CONFIRMATION MODAL WITH 409 WARNING                           -->
    <!-- ===================================================================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showArchiveModal && busToArchive"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <!-- Backdrop -->
          <div @click="closeArchiveModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"></div>

          <!-- Dialog Box -->
          <div class="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 overflow-hidden z-10 text-center space-y-4">
            <!-- Icon -->
            <div
              class="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-sm"
              :class="archiveConflict ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'"
            >
              {{ archiveConflict ? '⚠️' : '🗑️' }}
            </div>

            <!-- Title & Message -->
            <div>
              <h3 class="text-lg font-bold text-slate-900">
                {{ archiveConflict ? 'Невозможно архивировать автобус' : 'Архивировать автобус?' }}
              </h3>
              <p v-if="!archiveConflict" class="text-xs text-slate-500 mt-1 leading-relaxed">
                Автобус <strong class="text-slate-800 font-bold">{{ busToArchive.name }}</strong> ({{ busToArchive.license_plate }}) будет перемещен в архив и скрыт из активного автопарка.
              </p>
              <div v-else class="mt-2 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-left text-xs text-amber-900 space-y-1">
                <p class="font-bold">К автобусу привязано активных рейсов: {{ archiveConflict.active_tickets_count }}</p>
                <p class="text-[11px] text-amber-800 leading-tight">
                  Автобус нельзя архивировать, пока он назначен на будущие рейсы. Сначала измените или завершите эти рейсы.
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-2">
              <button
                @click="closeArchiveModal"
                class="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                {{ archiveConflict ? 'Понятно' : 'Отмена' }}
              </button>

              <button
                v-if="!archiveConflict"
                @click="confirmArchive"
                :disabled="archiving"
                class="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/20 active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span v-if="archiving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Подтвердить</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast Notification -->
    <AppToast
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @close="toast.show = false"
    />
  </div>
</template>

<script>
import api from '../../api';
import { compressImage } from '../../utils/imageCompression';
import { uploadToCloudinaryDirect } from '../../utils/cloudinary';
import BusSeatSelector from '../BusSeatSelector.vue';
import AppToast from '../AppToast.vue';

export default {
  name: 'CarrierFleet',
  components: {
    BusSeatSelector,
    AppToast
  },
  props: {
    user: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      loading: true,
      fetchError: null,
      buses: [],
      searchQuery: '',
      statusFilter: 'all',
      statusFilterOptions: [
        { label: 'Все', value: 'all' },
        { label: 'Активные', value: 'active' },
        { label: 'На ТО', value: 'maintenance' },
        { label: 'Неактивные', value: 'inactive' }
      ],

      // Canonical Amenities
      canonicalAmenities: [
        { key: 'wifi', label: 'Wi-Fi', icon: '📶' },
        { key: 'ac', label: 'Кондиционер', icon: '❄️' },
        { key: 'usb', label: 'USB зарядка', icon: '🔌' },
        { key: 'power_220v', label: 'Розетки 220V', icon: '⚡' },
        { key: 'wc', label: 'Туалет', icon: '🚻' },
        { key: 'tv', label: 'Телевизор', icon: '📺' },
        { key: 'kitchen', label: 'Мини-кухня', icon: '☕' },
        { key: 'blanket', label: 'Одеяла/пледы', icon: '🛋️' },
        { key: 'reclining_seats', label: 'Откидные кресла', icon: '💺' },
        { key: 'luggage', label: 'Багаж', icon: '🧳' }
      ],

      // Form State
      showFormModal: false,
      isEditing: false,
      editingBusId: null,
      submitting: false,
      formError: null,
      showSeatPreview: false,
      photoLoading: false,
      uploadPreset: 'poputki',

      form: {
        name: '',
        brand: '',
        model: '',
        license_plate: '',
        vin: '',
        year_built: null,
        color: '',
        bus_type: 'single',
        total_seats: 53,
        floor1_seats: 20,
        floor2_seats: 56,
        photos: [],
        amenities: ['wifi', 'ac'],
        status: 'active',
        notes: ''
      },

      // Details Modal State
      showDetailsModal: false,
      selectedBus: null,
      activePreviewPhotoUrl: null,

      // Archive Confirmation State
      showArchiveModal: false,
      busToArchive: null,
      archiving: false,
      archiveConflict: null,

      // Toast Notification
      toast: {
        show: false,
        message: '',
        type: 'success'
      }
    };
  },
  computed: {
    role() {
      return this.user?.memberRole || this.user?.role || 'owner';
    },
    isOwner() {
      return this.role === 'owner';
    },
    canEdit() {
      return ['owner', 'dispatcher'].includes(this.role);
    },
    computedTotalSeats() {
      if (this.form.bus_type === 'single') {
        return Number(this.form.total_seats) || 0;
      }
      const f1 = Number(this.form.floor1_seats) || 0;
      const f2 = Number(this.form.floor2_seats) || 0;
      return f1 + f2;
    },
    filteredBuses() {
      return this.buses.filter(bus => {
        // Status filter
        if (this.statusFilter !== 'all' && bus.status !== this.statusFilter) {
          return false;
        }

        // Search query filter
        if (this.searchQuery) {
          const q = this.searchQuery.toLowerCase().trim();
          const nameMatch = (bus.name || '').toLowerCase().includes(q);
          const brandMatch = (bus.brand || '').toLowerCase().includes(q);
          const modelMatch = (bus.model || '').toLowerCase().includes(q);
          const plateMatch = (bus.license_plate || '').toLowerCase().includes(q);
          return nameMatch || brandMatch || modelMatch || plateMatch;
        }

        return true;
      });
    }
  },
  mounted() {
    this.fetchBuses();
  },
  methods: {
    showToast(message, type = 'success') {
      this.toast.message = message;
      this.toast.type = type;
      this.toast.show = true;
    },

    async fetchBuses() {
      this.loading = true;
      this.fetchError = null;
      try {
        const res = await api.get('/bus-admin/buses');
        this.buses = Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.error('[CarrierFleet] Error loading buses:', err);
        this.fetchError = err.response?.data?.error || 'Ошибка при загрузке списка автобусов';
      } finally {
        this.loading = false;
      }
    },

    getMainPhotoUrl(bus) {
      if (!bus || !Array.isArray(bus.photos) || bus.photos.length === 0) return null;
      const main = bus.photos.find(p => p && p.is_main);
      return (main && main.url) || (bus.photos[0] && bus.photos[0].url) || null;
    },

    getStatusLabel(status) {
      const map = {
        active: 'Активен',
        maintenance: 'На ТО',
        inactive: 'Неактивен',
        archived: 'В архиве'
      };
      return map[status] || status || 'Активен';
    },

    getStatusBadgeClass(status) {
      switch (status) {
        case 'active':
          return 'bg-emerald-500/90 text-white';
        case 'maintenance':
          return 'bg-amber-500/90 text-white';
        case 'inactive':
          return 'bg-slate-700/90 text-white';
        case 'archived':
          return 'bg-rose-500/90 text-white';
        default:
          return 'bg-slate-700/90 text-white';
      }
    },

    getStatusDotClass(status) {
      switch (status) {
        case 'active':
          return 'bg-emerald-300';
        case 'maintenance':
          return 'bg-amber-300';
        case 'inactive':
          return 'bg-slate-400';
        case 'archived':
          return 'bg-rose-300';
        default:
          return 'bg-white';
      }
    },

    getAmenityIcon(key) {
      const found = this.canonicalAmenities.find(a => a.key === key);
      return found ? found.icon : '✨';
    },

    getAmenityLabel(key) {
      const found = this.canonicalAmenities.find(a => a.key === key);
      return found ? found.label : key;
    },

    setBusType(type) {
      this.form.bus_type = type;
      if (type === 'double') {
        if (!this.form.floor1_seats) this.form.floor1_seats = 22;
        if (!this.form.floor2_seats) this.form.floor2_seats = 56;
      }
    },

    openAddModal() {
      this.isEditing = false;
      this.editingBusId = null;
      this.formError = null;
      this.showSeatPreview = false;
      this.form = {
        name: '',
        brand: '',
        model: '',
        license_plate: '',
        vin: '',
        year_built: null,
        color: '',
        bus_type: 'single',
        total_seats: 53,
        floor1_seats: 22,
        floor2_seats: 56,
        photos: [],
        amenities: ['wifi', 'ac'],
        status: 'active',
        notes: ''
      };
      this.showFormModal = true;
    },

    openEditModal(bus) {
      if (!bus) return;
      this.isEditing = true;
      this.editingBusId = bus.id;
      this.formError = null;
      this.showSeatPreview = false;

      // Defensive clone of bus data
      this.form = {
        name: bus.name || '',
        brand: bus.brand || '',
        model: bus.model || '',
        license_plate: bus.license_plate || '',
        vin: bus.vin || '',
        year_built: bus.year_built || null,
        color: bus.color || '',
        bus_type: bus.bus_type || 'single',
        total_seats: bus.total_seats || 53,
        floor1_seats: bus.floor1_seats || 22,
        floor2_seats: bus.floor2_seats || 56,
        photos: Array.isArray(bus.photos) ? JSON.parse(JSON.stringify(bus.photos)) : [],
        amenities: Array.isArray(bus.amenities) ? [...bus.amenities] : ['wifi', 'ac'],
        status: bus.status || 'active',
        notes: bus.notes || ''
      };
      this.showFormModal = true;
    },

    closeFormModal() {
      this.showFormModal = false;
      this.formError = null;
    },

    async handlePhotoUpload(event) {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const remainingSlots = 6 - this.form.photos.length;
      if (remainingSlots <= 0) {
        alert('Максимальное количество фотографий — 6');
        return;
      }

      const filesToUpload = files.slice(0, remainingSlots);
      this.photoLoading = true;
      try {
        for (const file of filesToUpload) {
          const compressed = await compressImage(file, { maxWidth: 1200, quality: 0.75 });
          const result = await uploadToCloudinaryDirect(compressed, { uploadPreset: this.uploadPreset });

          // First photo is automatically marked as main
          const isMain = this.form.photos.length === 0;

          this.form.photos.push({
            url: result.url,
            public_id: result.public_id,
            is_main: isMain
          });
        }
      } catch (err) {
        console.error('[CarrierFleet] Photo upload failed:', err);
        alert('Ошибка загрузки фото: ' + (err.message || 'Сбой Cloudinary'));
      } finally {
        this.photoLoading = false;
        if (event.target) event.target.value = '';
      }
    },

    setMainPhoto(index) {
      this.form.photos.forEach((p, idx) => {
        p.is_main = idx === index;
      });
    },

    removePhoto(index) {
      const wasMain = this.form.photos[index]?.is_main;
      this.form.photos.splice(index, 1);
      // If deleted photo was main and there are other photos left, make the first one main
      if (wasMain && this.form.photos.length > 0) {
        this.form.photos[0].is_main = true;
      }
    },

    validateForm() {
      if (!this.form.name || !this.form.name.trim()) return 'Укажите внутреннее название автобуса';
      if (!this.form.brand || !this.form.brand.trim()) return 'Укажите марку автобуса';
      if (!this.form.model || !this.form.model.trim()) return 'Укажите модель автобуса';
      if (!this.form.license_plate || !this.form.license_plate.trim()) return 'Укажите госномер автобуса';

      if (this.form.bus_type === 'single') {
        const seats = Number(this.form.total_seats);
        if (!seats || seats <= 0 || seats > 150) return 'Укажите корректное количество мест (от 1 до 150)';
      } else if (this.form.bus_type === 'double') {
        const f1 = Number(this.form.floor1_seats);
        const f2 = Number(this.form.floor2_seats);
        if (!f1 || f1 <= 0) return 'Укажите количество мест на 1 этаже';
        if (!f2 || f2 <= 0) return 'Укажите количество мест на 2 этаже';
      }

      return null;
    },

    async saveBus() {
      this.formError = this.validateForm();
      if (this.formError) return;

      this.submitting = true;
      this.formError = null;

      // Construct clean payload (carrier_id is never sent from frontend)
      const payload = {
        name: this.form.name.trim(),
        brand: this.form.brand.trim(),
        model: this.form.model.trim(),
        license_plate: this.form.license_plate.trim(),
        vin: this.form.vin ? this.form.vin.trim() : null,
        year_built: this.form.year_built ? Number(this.form.year_built) : null,
        color: this.form.color ? this.form.color.trim() : null,
        bus_type: this.form.bus_type,
        total_seats: this.form.bus_type === 'single' ? Number(this.form.total_seats) : this.computedTotalSeats,
        floor1_seats: this.form.bus_type === 'double' ? Number(this.form.floor1_seats) : null,
        floor2_seats: this.form.bus_type === 'double' ? Number(this.form.floor2_seats) : null,
        photos: this.form.photos,
        amenities: this.form.amenities,
        status: this.form.status || 'active',
        notes: this.form.notes ? this.form.notes.trim() : null
      };

      try {
        if (this.isEditing) {
          const res = await api.patch(`/bus-admin/buses/${this.editingBusId}`, payload);
          this.showToast('Автобус успешно обновлен');
        } else {
          const res = await api.post('/bus-admin/buses', payload);
          this.showToast('Автобус успешно добавлен в автопарк');
        }

        this.closeFormModal();
        await this.fetchBuses();
      } catch (err) {
        console.error('[CarrierFleet] Save bus error:', err);
        this.formError = err.response?.data?.error || 'Ошибка при сохранении автобуса';
      } finally {
        this.submitting = false;
      }
    },

    async openDetailsModal(bus) {
      this.selectedBus = bus;
      this.activePreviewPhotoUrl = this.getMainPhotoUrl(bus);
      this.showDetailsModal = true;

      // Refresh single bus with active tickets from backend
      try {
        const res = await api.get(`/bus-admin/buses/${bus.id}`);
        if (res.data) {
          this.selectedBus = res.data;
        }
      } catch (e) {
        // Safe fallback to local card data
      }
    },

    openArchiveConfirm(bus) {
      this.busToArchive = bus;
      this.archiveConflict = null;
      this.showArchiveModal = true;
    },

    closeArchiveModal() {
      this.showArchiveModal = false;
      this.busToArchive = null;
      this.archiveConflict = null;
      this.archiving = false;
    },

    async confirmArchive() {
      if (!this.busToArchive) return;
      this.archiving = true;
      this.archiveConflict = null;

      try {
        const res = await api.post(`/bus-admin/buses/${this.busToArchive.id}/archive`);
        this.showToast('Автобус успешно перенесен в архив');
        this.closeArchiveModal();
        await this.fetchBuses();
      } catch (err) {
        console.error('[CarrierFleet] Archive error:', err);
        if (err.response && err.response.status === 409) {
          // Strict 409 Conflict Handling
          this.archiveConflict = err.response.data || { active_tickets_count: 1 };
        } else {
          alert('Ошибка при архивации: ' + (err.response?.data?.error || err.message));
          this.closeArchiveModal();
        }
      } finally {
        this.archiving = false;
      }
    }
  }
};
</script>

<style scoped>
/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
