import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { initTelegram } from './telegram'
import { installSeo } from './seo/seoManager'

// Centralised <head> SEO management (title/meta/canonical/OG/JSON-LD)
installSeo(router);

// Initialize Telegram SDK
initTelegram();

createApp(App)
    .use(router)
    .mount('#app')

// Reload on preload errors (e.g. after a new deployment)
window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error detected, reloading page...');
    window.location.reload();
});
