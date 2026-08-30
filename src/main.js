import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { initTelegram } from './telegram'
import { initTicketTelegramBridge } from './utils/ticketTelegramBridge'

// Initialize Telegram SDK
initTelegram();

createApp(App)
    .use(router)
    .mount('#app')

// Phase E.4: augment active manual passenger tickets with a secure
// "Open in Telegram" action backed by a short-lived claim session.
initTicketTelegramBridge();

// Reload on preload errors (e.g. after a new deployment)
window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error detected, reloading page...');
    window.location.reload();
});
