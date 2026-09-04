<script>
import { RouterView } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import acquisitionService from './services/acquisitionService'

export default {
  components: {
    BottomNav
  },
  mounted() {
    acquisitionService.initSession();
  }
}
</script>

<template>
  <div :class="['app-container', { 'admin-mode': $route.meta?.hideBottomNav, 'landing-mode': $route.name === 'landing' }]">
    <main :class="{ 'pb-20': !$route.meta?.hideBottomNav && $route.name !== 'landing' }" class="min-h-screen">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <BottomNav v-if="!$route.meta?.hideBottomNav && $route.name !== 'auth' && $route.name !== 'landing'" />
  </div>
</template>

<style scoped>
.app-container {
  max-width: 480px;
  margin: 0 auto;
  background: white;
  min-height: 100vh;
  position: relative;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.05);
}

.app-container.admin-mode {
  max-width: 100%;
  margin: 0;
  background: #0f172a;
  box-shadow: none;
}

.app-container.landing-mode {
  max-width: 100%;
  margin: 0;
  background: white;
  box-shadow: none;
}
</style>
