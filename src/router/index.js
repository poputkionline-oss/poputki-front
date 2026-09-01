import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import RideSeatSelectionView from '../views/RideSeatSelectionView.vue';
import BusAdminView from '../views/BusAdminView.vue';
import { getTelegramApp, getTelegramUser, getTelegramInitData, ensureTelegramMiniAppAuth } from '../telegram';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'landing',
            component: LandingView
        },
        {
            path: '/search',
            name: 'search',
            component: () => import('../views/SearchResultsView.vue')
        },
        {
            path: '/create',
            name: 'create-ride',
            component: () => import('../views/CreateRideView.vue')
        },
        {
            path: '/preferences',
            name: 'preferences-edit',
            component: () => import('../views/PreferencesView.vue')
        },
        {
            path: '/bookings',
            name: 'bookings',
            component: () => import('../views/BookingsView.vue')
        },
        {
            path: '/ride/:id',
            name: 'ride-details',
            component: () => import('../views/RideDetailsView.vue')
        },
        {
            path: '/ride/:id/select-seat',
            name: 'ride-seats',
            component: RideSeatSelectionView
        },
        {
            path: '/bus-admin',
            name: 'bus-admin',
            component: BusAdminView,
            meta: { hideBottomNav: true }
        },
        {
            path: '/terms',
            name: 'terms',
            component: () => import('../views/TermsView.vue'),
            meta: { hideBottomNav: true }
        },

        {
            path: '/profile',
            name: 'profile',
            component: () => import('../views/ProfileView.vue')
        },
        {
            path: '/auth',
            name: 'auth',
            component: () => import('../views/AuthView.vue')
        },
        {
            path: '/my-rides',
            name: 'my-rides',
            component: () => import('../views/MyRidesView.vue')
        },
        {
            path: '/vehicle',
            name: 'vehicle',
            component: () => import('../views/VehicleView.vue')
        },
        {
            path: '/driver/:id/reviews',
            name: 'driver-reviews',
            component: () => import('../views/UserProfileView.vue')
        },
        {
            path: '/user/:id',
            name: 'user-profile',
            component: () => import('../views/UserProfileView.vue')
        },
        {
            path: '/bus-ticket/:id',
            name: 'bus-ticket-details',
            component: () => import('../views/BusTicketDetailsView.vue')
        },

        {
            path: '/bus-booking/:id/step/:step',
            name: 'bus-booking',
            component: () => import('../views/BusBookingView.vue')
        },
        {
            path: '/my-bus-tickets',
            name: 'my-bus-tickets',
            component: () => import('../views/MyBusTicketsView.vue')
        },
        {
            path: '/admin',
            name: 'admin',
            component: () => import('../views/AdminView.vue'),
            meta: { hideBottomNav: true }
        },
        {
            path: '/payment-result',
            name: 'payment-result',
            component: () => import('../views/PaymentResultView.vue'),
            meta: { hideBottomNav: true }
        },
        {
            path: '/ticket/:token',
            name: 'ticket-verification',
            component: () => import('../views/TicketVerificationView.vue'),
            meta: { hideBottomNav: true }
        },
        {
            path: '/ticket-verify/:token',
            name: 'ticket-verify-alias',
            component: () => import('../views/TicketVerificationView.vue'),
            meta: { hideBottomNav: true }
        },
        {
            path: '/ticket-preview',
            name: 'ticket-preview',
            component: () => import('../views/TicketPreviewView.vue'),
            meta: { hideBottomNav: true }
        }
    ],
    scrollBehavior(to, from, savedPosition) {
        // always scroll to top
        return { top: 0 }
    }
})

function isProfileComplete(user) {
    return Boolean(user && user.name);
}

router.beforeEach(async (to, from, next) => {
    // 1. Telegram Auth / Seamless Sync logic (Must run & await BEFORE navigation decisions if in Telegram WebApp)
    const isTelegramContext = Boolean(
        getTelegramApp() ||
        (typeof window !== 'undefined' && (window.Telegram?.WebApp || window.location?.hash?.includes('tgWebAppData')))
    );

    if (isTelegramContext) {
        let user = JSON.parse(localStorage.getItem('user') || 'null');
        const token = localStorage.getItem('token');

        if (!token || !isProfileComplete(user)) {
            const syncedUser = await ensureTelegramMiniAppAuth();
            if (syncedUser && isProfileComplete(syncedUser) && to.name === 'auth') {
                const target = to.query.redirect || { name: 'my-bus-tickets' };
                return next(target);
            }
        } else {
            // Background sync
            ensureTelegramMiniAppAuth();
        }
    }

    const tg = getTelegramApp();
    let user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    // 2. Handle Deep Links (Telegram startParam)
    if (tg?.initDataUnsafe?.start_param && !to.query.processedStartParam) {
        const startParam = tg.initDataUnsafe.start_param;
        if (startParam.startsWith('ride_')) {
            const rideId = startParam.replace('ride_', '');
            if (rideId && !(to.name === 'ride-details' && to.params.id === rideId)) {
                return next({ 
                    name: 'ride-details', 
                    params: { id: rideId },
                    query: { ...to.query, processedStartParam: '1' } 
                });
            }
        } else if (startParam.startsWith('bus_')) {
            const rawParam = startParam.replace('bus_', '');
            const parts = rawParam.split('_');
            const busTicketId = parts[0];
            let refCarrierId = null;
            if (parts[1]) {
                refCarrierId = parts[1].replace(/^[cr]/, '');
            }

            // Capture attribution for this specific ticket without polluting other tickets
            if (busTicketId) {
                try {
                    const attr = {
                        channel: 'telegram',
                        source_type: refCarrierId ? 'carrier_link' : 'bot',
                        source_id: refCarrierId || null,
                        ticket_id: String(busTicketId),
                        timestamp: Date.now()
                    };
                    sessionStorage.setItem(`booking_attribution_${busTicketId}`, JSON.stringify(attr));
                } catch (e) {
                    console.error('Error saving deep link attribution:', e);
                }

                if (!(to.name === 'bus-ticket-details' && to.params.id === busTicketId)) {
                    return next({ 
                        name: 'bus-ticket-details', 
                        params: { id: busTicketId },
                        query: { ...to.query, processedStartParam: '1' } 
                    });
                }
            }
        }
    }

    // 3. Final Navigation Guard
    const isAuthenticated = !!localStorage.getItem('token');
    user = JSON.parse(localStorage.getItem('user')); // Re-fetch after possible sync
    const isComplete = isProfileComplete(user);
    const publicRoutes = ['auth', 'admin', 'bus-admin', 'ride-details', 'landing', 'search', 'payment-result', 'ticket-verification', 'ticket-verify-alias', 'ticket-preview', 'terms'];

    if (!publicRoutes.includes(to.name)) {
        if (!isAuthenticated || !isComplete) {
            return next({ 
                name: 'auth', 
                query: { redirect: to.fullPath } 
            });
        }
    }
    
    next();
});

// Handle dynamic import errors (e.g. after a new deployment)
router.onError((error, to) => {
    const errorsToCheck = [
        'Failed to fetch dynamically imported module',
        'Importing a module that was discontinued',
        'TypeError: Failed to fetch dynamically imported module'
    ];
    
    if (errorsToCheck.some(msg => error.message?.includes(msg))) {
        console.warn('Dynamic import failed, reloading page to get latest version...');
        window.location.reload();
    }
});

export default router
