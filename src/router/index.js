import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import RideSeatSelectionView from '../views/RideSeatSelectionView.vue';
import BusAdminView from '../views/BusAdminView.vue';
import { getTelegramUser, getTelegramInitData } from '../telegram';

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
        }
    ],
    scrollBehavior(to, from, savedPosition) {
        // always scroll to top
        return { top: 0 }
    }
})

function isProfileComplete(user) {
    return user && user.phone && user.name && user.age && parseInt(user.age) > 0;
}

router.beforeEach(async (to, from, next) => {
    const tg = window.Telegram?.WebApp;
    const tgUser = getTelegramUser();
    let user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    // 1. Handle Deep Links (Telegram startParam)
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

    // 2. Telegram Auth / Sync logic
    if (tgUser) {
        const syncAction = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/telegram-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: tgUser.id,
                        first_name: tgUser.first_name,
                        last_name: tgUser.last_name,
                        username: tgUser.username,
                        photo_url: tgUser.photo_url,
                        userId: user?.id,
                        initData: getTelegramInitData()
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    user = data.user; // Update local reference
                    return data.user;
                }
            } catch (error) {
                console.error("Background Telegram Sync Failure:", error);
            }
            return null;
        };

        // BLOCKING SYNC: If no token or profile is incomplete, we MUST wait for the server.
        if (!token || !isProfileComplete(user)) {
            const syncedUser = await syncAction();
            if (syncedUser && syncedUser.isNew && to.name !== 'auth') {
                return next({ name: 'auth', query: { tg_complete: 1 } });
            }
        } else {
            // FIRE AND FORGET: Profile is complete, just sync in background.
            syncAction();
        }
    }

    // 3. Final Navigation Guard
    const isAuthenticated = !!localStorage.getItem('token');
    user = JSON.parse(localStorage.getItem('user')); // Re-fetch after possible sync
    const isComplete = isProfileComplete(user);
    const publicRoutes = ['auth', 'admin', 'bus-admin', 'ride-details', 'landing', 'search', 'payment-result'];

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
