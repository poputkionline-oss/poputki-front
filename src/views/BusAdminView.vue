<script>
import api from '../api';
import AppLogo from '../components/AppLogo.vue';
import { exportPassengerManifestExcel, sortPassengersBySeat } from '../utils/excelExport';
import { compressImage } from '../utils/imageCompression';
import { uploadToCloudinaryDirect } from '../utils/cloudinary';
import { copyToClipboard } from '../telegram';
import BusSeatSelector from '../components/BusSeatSelector.vue';
import CarrierBoarding from '../components/carrier/CarrierBoarding.vue';
import CarrierTripBookings from '../components/carrier/CarrierTripBookings.vue';
import CarrierFinance from '../components/carrier/CarrierFinance.vue';
import CarrierMembers from '../components/carrier/CarrierMembers.vue';
import CarrierCustomers from '../components/carrier/CarrierCustomers.vue';
import CarrierActivity from '../components/carrier/CarrierActivity.vue';
import CarrierDashboard from '../components/carrier/CarrierDashboard.vue';
import CarrierFleet from '../components/carrier/CarrierFleet.vue';
import {

  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement
} from 'chart.js';
import { Line, Pie, Bar } from 'vue-chartjs';

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement
);

export default {
    components: {
        AppLogo,
        LineChart: Line,
        PieChart: Pie,
        BarChart: Bar,
        BusSeatSelector,
        CarrierBoarding,
        CarrierTripBookings,
        CarrierFinance,
        CarrierMembers,
        CarrierCustomers,
        CarrierActivity,
        CarrierDashboard,
        CarrierFleet
    },

    async mounted() {
        const savedUser = localStorage.getItem('busUser');
        const savedJwt = localStorage.getItem('carrierJwt');
        if (savedUser && savedJwt) {
            try {
                this.user = JSON.parse(savedUser);
                this.isAuthenticated = true;
                const role = this.user?.memberRole || this.user?.role;
                if (role === 'driver') this.activeTab = 'boarding';
                else if (role === 'accountant') this.activeTab = 'finance';
                else if (role === 'dispatcher') this.activeTab = 'tickets';
                else this.activeTab = 'dashboard';
                this.fetchCities();
                await Promise.all([this.fetchStats(), this.fetchTickets()]);
            } catch (e) {
                console.error('Error restoring session', e);
                localStorage.removeItem('busUser');
                localStorage.removeItem('carrierJwt');
                this.isAuthenticated = false;
            }
        }
    },
    data() {
        return {
            isAuthenticated: false,
            phone: '',
            password: '',
            user: null,
            activeTab: 'dashboard', // 'dashboard', 'tickets', 'create', 'bookings'
            loading: false,
            stats: null,
            tickets: [],
            bookings: [],
            cities: [],
            busForm: {
                transport_company: '',
                from_city: '',
                from_address: '',
                to_city: '',
                to_address: '',
                departure_date: '',
                departure_time: '',
                arrival_date: '',
                arrival_time: '',
                duration_hours: '',
                price: '',
                premium_price: '',
                total_seats: 53,
                floor1_seats: 20,
                floor2_seats: 56,
                bus_type: 'single',
                passenger_comments: '',
                intermediate_stops: [],
                photos: [],
                bus_id: null,
                group_leader_name: '',
                group_leader_phone: '',
                group_leader_whatsapp: '',
                accept_terms: true
            },
            fleetBuses: [],
            fleetLoading: false,
            selectedFleetBusId: '',
            showScheduleConflictModal: false,
            scheduleConflicts: [],
            busErrors: {},
            mobileMenuOpen: false,
            navItems: [
                { id: 'dashboard', label: 'Обзор' },
                { id: 'boarding', label: 'Посадка' },
                { id: 'tickets', label: 'Мои рейсы' },
                { id: 'fleet', label: 'Мой автопарк' },
                { id: 'create', label: 'Создать рейс' },
                { id: 'create-booking', label: 'Создать бронь' },
                { id: 'bookings', label: 'Бронирования' },
                { id: 'finance', label: 'Финансы' },
                { id: 'team', label: 'Команда' },
                { id: 'crm', label: 'CRM Клиентов' },
                { id: 'activity', label: 'История' }
            ],

            bookingSearch: '',
            crmSearch: '',
            isEditingTicket: false,
            editingTicketId: null,
            editingOriginalBusId: null,
            bookingForm: {
                bus_ticket_id: '',
                passenger_count: 1,
                passengers_data: [
                        { lastName: '', firstName: '', middleName: '', gender: 'male', docType: 'Загранпаспорт', docNumber: '', birthDate: '', citizenship: 'Таджикистан', phone: '', seatNumber: '' }
                ],
                pickup_city: '',
                drop_off_city: ''
            },
            selectedBookingRideId: '',
            selectedManualSeats: [],
            showManualForm: false,
            prefilledCrmCustomer: null,
            photoLoading: false,
            ocrLoadingIndex: -1,
            uploadPreset: 'poputki',
            isEditingBooking: false,
            editingBookingId: null,
            showEditModal: false,
            showShareModal: false,
            selectedShareTicket: null,
            shareToast: false,
            shareToastMessage: '',
            ticketsState: 'idle', // 'idle' | 'loading' | 'success' | 'empty' | 'auth_error' | 'forbidden_error' | 'network_error'
            ticketsErrorMessage: '',
            authErrorMessage: '',
            chartOptions: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#475569' }
                    }
                },
                scales: {
                    y: {
                        grid: { color: '#f1f5f9' },
                        ticks: { color: '#64748b' }
                    },
                    x: {
                        grid: { color: '#f1f5f9' },
                        ticks: { color: '#64748b' }
                    }
                }
            },
            pieOptions: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#475569' }
                    }
                }
            }

        }
    },
    methods: {
        handleSeatDblClick(seatNum) {
            this.selectedManualSeats = [seatNum];
            this.showManualForm = true;
        },
        async handleLogin() {
            if (!this.phone || !this.password) {
                alert('Введите телефон и пароль');
                return;
            }
            this.loading = true;
            this.authErrorMessage = '';
            try {
                const res = await api.post('/auth/bus-login', { phone: this.phone, password: this.password });
                this.user = res.data.user;
                this.isAuthenticated = true;
                const role = this.user?.memberRole || this.user?.role;
                if (role === 'driver') this.activeTab = 'boarding';
                else if (role === 'accountant') this.activeTab = 'finance';
                else if (role === 'dispatcher') this.activeTab = 'tickets';
                else this.activeTab = 'dashboard';
                localStorage.setItem('busUser', JSON.stringify(this.user));

                if (res.data.token) {
                    localStorage.setItem('carrierJwt', res.data.token);
                }
                this.fetchCities();
                await Promise.all([this.fetchStats(), this.fetchTickets()]);
            } catch (e) {
                this.authErrorMessage = e.response?.data?.error || 'Ошибка входа';
                alert(this.authErrorMessage);
            } finally {
                this.loading = false;
            }
        },
        async fetchData() {
            if (!this.user) return;
            this.fetchCities();

            // Parallel fetch to avoid long sequential waits
            const promises = [];
            if (this.activeTab === 'dashboard') {
                promises.push(this.fetchStats());
            } else if (this.activeTab === 'tickets') {
                promises.push(this.fetchTickets());
            } else if (this.activeTab === 'bookings' || this.activeTab === 'crm' || this.activeTab === 'boarding') {
                promises.push(this.fetchBookings());
                if (this.activeTab === 'boarding' && this.tickets.length === 0) {
                    promises.push(this.fetchTickets());
                }
            } else if (this.activeTab === 'create' || this.activeTab === 'fleet') {
                promises.push(this.fetchFleetBuses());
            }
            await Promise.all(promises);
        },
        async fetchFleetBuses() {
            this.fleetLoading = true;
            try {
                const res = await api.get('/bus-admin/buses');
                this.fleetBuses = Array.isArray(res.data) ? res.data : [];
            } catch (e) {
                console.error('[BusAdminView] Error loading fleet buses:', e);
            } finally {
                this.fleetLoading = false;
            }
        },
        async fetchStats() {
            this.loading = true;
            try {
                const res = await api.get('/bus-admin/stats');
                this.stats = res.data;
            } catch (e) { console.error('Error fetching stats', e); } finally { this.loading = false; }
        },
        async fetchCities() {
            if (this.cities.length > 0) return;
            try {
                const res = await api.get('/general/cities', { params: { type: 'bus' } });
                this.cities = res.data;
            } catch (e) { console.error('Error fetching cities', e); }
        },
        async fetchTickets() {
            this.loading = true;
            this.ticketsState = 'loading';
            this.ticketsErrorMessage = '';
            try {
                const res = await api.get('/bus-admin/tickets');
                this.tickets = res.data || [];
                if (this.tickets.length === 0) {
                    this.ticketsState = 'empty';
                } else {
                    this.ticketsState = 'success';
                }
            } catch (e) {
                console.error('[BusAdmin] Error fetching tickets:', e);
                const status = e.response?.status;
                if (status === 401) {
                    this.ticketsState = 'auth_error';
                    this.tickets = [];
                    this.isAuthenticated = false;
                    this.authErrorMessage = 'Сессия истекла. Пожалуйста, войдите заново.';
                    localStorage.removeItem('carrierJwt');
                    localStorage.removeItem('busUser');
                } else if (status === 403) {
                    this.ticketsState = 'forbidden_error';
                    this.ticketsErrorMessage = 'У вас нет доступа к этому разделу.';
                } else {
                    this.ticketsState = 'network_error';
                    this.ticketsErrorMessage = 'Не удалось загрузить рейсы. Попробуйте ещё раз.';
                }
            } finally {
                this.loading = false;
            }
        },
        async fetchBookings() {
            this.loading = true;
            try {
                // Also fetch tickets if we haven't yet, to populate the filter dropdown
                if (this.tickets.length === 0) {
                    await this.fetchTickets();
                }
                const res = await api.get('/bus-admin/bookings');
                this.bookings = res.data;
            } catch (e) { console.error(e); } finally { this.loading = false; }
        },
        logout() {
            this.isAuthenticated = false;
            this.user = null;
            this.phone = '';
            this.password = '';
            this.tickets = [];
            this.bookings = [];
            this.ticketsState = 'idle';
            this.ticketsErrorMessage = '';
            this.authErrorMessage = '';
            localStorage.removeItem('busUser');
            localStorage.removeItem('carrierJwt');
        },
        // Bus Creation logic borrowed from AdminView.vue
        addStop() {
            this.busForm.intermediate_stops.push({ city: '', time: '', address: '' });
        },
        removeStop(index) {
            this.busForm.intermediate_stops.splice(index, 1);
        },
        validateBusForm() {
            const e = {};
            if (!this.busForm.transport_company.trim()) e.transport_company = 'Укажите название компании';
            if (!this.busForm.from_city) e.from_city = 'Укажите город отправления';
            if (!this.busForm.from_address.trim()) e.from_address = 'Укажите место отправления';
            if (!this.busForm.to_city) e.to_city = 'Укажите город прибытия';
            if (!this.busForm.to_address.trim()) e.to_address = 'Укажите место прибытия';
            if (!this.busForm.departure_date) e.departure_date = 'Укажите дату отправления';
            if (!this.busForm.departure_time) e.departure_time = 'Укажите время отправления';
            if (!this.busForm.arrival_time) e.arrival_time = 'Укажите время прибытия';
            if (!this.busForm.duration_hours || this.busForm.duration_hours <= 0) e.duration_hours = 'Укажите длительность (в часах)';
            if (!this.busForm.price || this.busForm.price <= 0) e.price = 'Укажите цену';

            // Only validate manual capacity if NOT using selectedFleetBus
            if (!this.selectedFleetBus) {
                if (this.busForm.bus_type === 'double') {
                    if (!this.busForm.floor1_seats || this.busForm.floor1_seats < 1) e.floor1_seats = 'Укажите кол-во мест 1 этажа';
                    if (!this.busForm.floor2_seats || this.busForm.floor2_seats < 1) e.floor2_seats = 'Укажите кол-во мест 2 этажа';
                } else {
                    if (!this.busForm.total_seats || this.busForm.total_seats < 1) e.total_seats = 'Укажите количество мест';
                }
            }

            if (!this.busForm.accept_terms) e.accept_terms = 'Необходимо согласиться с условиями использования и публичной офертой';

            this.busErrors = e;
            return Object.keys(e).length === 0;
        },
        async submitBusTicket(allowConflict = false) {
            if (!this.validateBusForm()) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }
            this.loading = true;
            try {
                const submitData = {
                    ...this.busForm,
                    operator_id: this.user.id,
                    duration_minutes: Number(this.busForm.duration_hours) * 60,
                    price: Number(this.busForm.price),
                    premium_price: this.busForm.premium_price ? Number(this.busForm.premium_price) : null,
                    photos: this.busForm.photos
                };

                if (this.selectedFleetBus) {
                    submitData.bus_id = this.selectedFleetBus.id;
                    submitData.bus_type = this.selectedFleetBus.bus_type;
                    submitData.total_seats = this.selectedFleetBus.total_seats;
                    submitData.floor1_seats = this.selectedFleetBus.floor1_seats;
                    submitData.floor2_seats = this.selectedFleetBus.floor2_seats;
                    submitData.photos = this.selectedFleetBus.photos;
                } else if (this.busForm.bus_type === 'double') {
                    submitData.floor1_seats = Number(this.busForm.floor1_seats);
                    submitData.floor2_seats = Number(this.busForm.floor2_seats);
                    submitData.total_seats = submitData.floor1_seats + submitData.floor2_seats;
                } else {
                    submitData.total_seats = Number(this.busForm.total_seats);
                    submitData.floor1_seats = null;
                    submitData.floor2_seats = null;
                    submitData.premium_price = null;
                }

                if (allowConflict) {
                    submitData.allow_bus_conflict = true;
                }

                await api.post('/bus-tickets', submitData);
                alert('Рейс успешно создан!');
                this.showScheduleConflictModal = false;
                this.scheduleConflicts = [];

                // Reset form
                this.selectedFleetBusId = '';
                this.busForm = {
                    transport_company: '', from_city: '', from_address: '',
                    to_city: '', to_address: '', departure_date: '',
                    departure_time: '', arrival_date: '', arrival_time: '',
                    duration_hours: '',
                    price: '',
                    floor1_seats: 20, floor2_seats: 56,
                    bus_type: 'single', passenger_comments: '',
                    intermediate_stops: [],
                    photos: [],
                    bus_id: null,
                    group_leader_name: '',
                    group_leader_phone: '',
                    group_leader_whatsapp: '',
                    accept_terms: true
                };

                this.activeTab = 'tickets';
            } catch (e) {
                if (e.response?.status === 409 && e.response?.data?.error === 'BUS_SCHEDULE_CONFLICT') {
                    this.scheduleConflicts = e.response.data.conflicts || [];
                    this.showScheduleConflictModal = true;
                } else {
                    alert(e.response?.data?.error || 'Ошибка при создании рейса');
                }
            } finally {
                this.loading = false;
            }
        },
        async deleteTicket(id) {
            if (!confirm('Удалить этот рейс?')) return;
            try {
                await api.delete(`/bus-admin/tickets/${id}`);
                this.fetchTickets();
            } catch (e) { alert('Ошибка при удалении'); }
        },
        editTicket(ticket) {
            this.isEditingTicket = true;
            this.editingTicketId = ticket.id;
            this.editingOriginalBusId = ticket.bus_id || null;
            this.selectedFleetBusId = ticket.bus_id ? String(ticket.bus_id) : '';
            this.busForm = {
                ...ticket,
                duration_hours: ticket.duration_minutes ? (ticket.duration_minutes / 60).toFixed(1) : '',
                intermediate_stops: ticket.intermediate_stops || [],
                photos: ticket.photos || []
            };
            this.fetchFleetBuses();
            this.activeTab = 'create';
        },
        duplicateTicket(ticket) {
            this.isEditingTicket = false;
            this.editingTicketId = null;
            this.editingOriginalBusId = null;

            let candidateBusId = '';
            if (ticket.bus_id) {
                const busExists = (this.activeFleetBuses || []).find(b => b.id === Number(ticket.bus_id));
                if (busExists) {
                    candidateBusId = String(ticket.bus_id);
                } else {
                    alert('Автобус исходного рейса сейчас недоступен или архивирован. Выберите другой автобус из автопарка.');
                }
            }
            this.selectedFleetBusId = candidateBusId;

            this.busForm = {
                transport_company: ticket.transport_company || '',
                from_city: ticket.from_city || '',
                from_address: ticket.from_address || '',
                to_city: ticket.to_city || '',
                to_address: ticket.to_address || '',
                departure_date: '',
                departure_time: ticket.departure_time ? ticket.departure_time.substring(0, 5) : '',
                arrival_date: '',
                arrival_time: ticket.arrival_time ? ticket.arrival_time.substring(0, 5) : '',
                duration_hours: ticket.duration_minutes ? (ticket.duration_minutes / 60).toFixed(1) : '',
                price: ticket.price || '',
                premium_price: ticket.premium_price || '',
                total_seats: ticket.total_seats || 53,
                floor1_seats: ticket.floor1_seats || 20,
                floor2_seats: ticket.floor2_seats || 56,
                bus_type: ticket.bus_type || 'single',
                passenger_comments: ticket.passenger_comments || '',
                intermediate_stops: JSON.parse(JSON.stringify(ticket.intermediate_stops || [])),
                photos: JSON.parse(JSON.stringify(ticket.photos || [])),
                bus_id: candidateBusId ? Number(candidateBusId) : null,
                accept_terms: true
            };
            this.fetchFleetBuses();
            this.activeTab = 'create';
            alert('Данные рейса скопированы. Выберите дату отправления для нового рейса.');
        },
        reverseTicket(ticket) {
            this.isEditingTicket = false;
            this.editingTicketId = null;
            this.editingOriginalBusId = null;

            let candidateBusId = '';
            if (ticket.bus_id) {
                const busExists = (this.activeFleetBuses || []).find(b => b.id === Number(ticket.bus_id));
                if (busExists) {
                    candidateBusId = String(ticket.bus_id);
                } else {
                    alert('Автобус исходного рейса сейчас недоступен или архивирован. Выберите другой автобус из автопарка.');
                }
            }
            this.selectedFleetBusId = candidateBusId;

            // Reverse intermediate stops order and reset times
            const reversedStops = [...(ticket.intermediate_stops || [])].reverse().map(s => ({
                city: s.city || '',
                address: s.address || '',
                time: '' // Reset time for opposite direction
            }));

            this.busForm = {
                transport_company: ticket.transport_company || '',
                from_city: ticket.to_city || '',
                from_address: ticket.to_address || '',
                to_city: ticket.from_city || '',
                to_address: ticket.from_address || '',
                departure_date: '', // Force choosing new date
                departure_time: ticket.departure_time || '08:00',
                arrival_date: '',
                arrival_time: ticket.arrival_time || '',
                duration_hours: ticket.duration_hours || '',
                price: ticket.price || '',
                premium_price: ticket.premium_price || '',
                total_seats: ticket.total_seats || 53,
                floor1_seats: ticket.floor1_seats || 20,
                floor2_seats: ticket.floor2_seats || 56,
                bus_type: ticket.bus_type || 'single',
                passenger_comments: ticket.passenger_comments || '',
                intermediate_stops: reversedStops,
                photos: JSON.parse(JSON.stringify(ticket.photos || [])),
                bus_id: candidateBusId ? Number(candidateBusId) : null,
                accept_terms: true
            };
            this.fetchFleetBuses();
            this.activeTab = 'create';
            alert('Обратный рейс сформирован: маршрут развернут в обратную сторону. Выберите дату отправления.');
        },
        async updateBusTicket(allowConflict = false) {
            if (!this.validateBusForm()) return;
            this.loading = true;
            try {
                const f = this.busForm;
                const updateData = {
                    transport_company: f.transport_company,
                    from_city: f.from_city,
                    from_address: f.from_address,
                    to_city: f.to_city,
                    to_address: f.to_address,
                    departure_date: f.departure_date,
                    departure_time: f.departure_time,
                    arrival_date: f.arrival_date,
                    arrival_time: f.arrival_time,
                    duration_minutes: Number(f.duration_hours) * 60,
                    price: Number(f.price),
                    bus_type: f.bus_type,
                    passenger_comments: f.passenger_comments,
                    intermediate_stops: f.intermediate_stops || [],
                    premium_price: f.premium_price ? Number(f.premium_price) : null,
                    photos: f.photos || []
                };

                if (this.selectedFleetBus) {
                    updateData.bus_id = this.selectedFleetBus.id;
                    updateData.bus_type = this.selectedFleetBus.bus_type;
                    updateData.total_seats = this.selectedFleetBus.total_seats;
                    updateData.floor1_seats = this.selectedFleetBus.floor1_seats;
                    updateData.floor2_seats = this.selectedFleetBus.floor2_seats;
                    updateData.photos = this.selectedFleetBus.photos;
                } else if (f.bus_type === 'double') {
                    updateData.floor1_seats = Number(f.floor1_seats);
                    updateData.floor2_seats = Number(f.floor2_seats);
                    updateData.total_seats = updateData.floor1_seats + updateData.floor2_seats;
                } else {
                    updateData.total_seats = Number(f.total_seats);
                    updateData.floor1_seats = null;
                    updateData.floor2_seats = null;
                    updateData.premium_price = null;
                }

                if (allowConflict) {
                    updateData.allow_bus_conflict = true;
                }

                await api.put(`/bus-admin/tickets/${this.editingTicketId}`, updateData);
                alert('Рейс успешно обновлен!');
                this.isEditingTicket = false;
                this.editingTicketId = null;
                this.showScheduleConflictModal = false;
                this.scheduleConflicts = [];
                this.activeTab = 'tickets';
                this.fetchTickets();
            } catch (e) {
                if (e.response?.status === 409 && e.response?.data?.error === 'BUS_SCHEDULE_CONFLICT') {
                    this.scheduleConflicts = e.response.data.conflicts || [];
                    this.showScheduleConflictModal = true;
                } else if (e.response?.status === 409 && e.response?.data?.error === 'BUS_REPLACEMENT_HAS_BOOKINGS') {
                    const count = e.response.data.activeBookingCount;
                    const countText = count !== undefined ? ` (активных бронирований: ${count})` : '';
                    alert(`Автобус нельзя заменить, потому что на этом рейсе уже есть активные бронирования${countText}.`);
                } else if (e.response?.status === 400 && e.response?.data?.error === 'BUS_UNASSIGN_FORBIDDEN') {
                    alert('Нельзя отвязать автобус от рейса. Вы можете выбрать другой автобус из своего автопарка.');
                } else {
                    console.error('Update error:', e.response?.data || e);
                    alert('Ошибка при обновлении: ' + (e.response?.data?.message || e.response?.data?.error || e.message));
                }
            } finally {
                this.loading = false;
            }
        },
        async completeTicket(ticket) {
            if (!confirm('Завершить этот рейс? Он больше не будет доступен для поиска.')) return;
            this.loading = true;
            try {
                await api.put(`/bus-admin/tickets/${ticket.id}`, { status: 'completed' });
                this.fetchTickets();
            } catch (e) {
                alert('Ошибка при завершении рейса');
                console.error(e);
            } finally {
                this.loading = false;
            }
        },
        handleQuickRebook(customerData) {
            if (!customerData) return;
            this.isEditingBooking = false;
            this.editingBookingId = null;

            // Store deep copy of prefilled CRM customer
            this.prefilledCrmCustomer = JSON.parse(JSON.stringify(customerData));

            const p0 = (customerData.passengers_data && customerData.passengers_data.length > 0)
                ? customerData.passengers_data[0]
                : {};

            this.bookingForm = {
                bus_ticket_id: '',
                passenger_count: 1,
                passengers_data: [
                    {
                        lastName: p0.lastName || '',
                        firstName: p0.firstName || customerData.passenger_name || '',
                        middleName: p0.middleName || '',
                        gender: p0.gender || 'male',
                        docType: p0.docType || 'Загранпаспорт',
                        docNumber: p0.docNumber || '',
                        birthDate: p0.birthDate || '',
                        citizenship: p0.citizenship || 'Таджикистан',
                        phone: p0.phone || customerData.phone || '',
                        seatNumber: ''
                    }
                ],
                pickup_city: '',
                drop_off_city: '',
                phone: customerData.phone || '',
                passenger_name: customerData.passenger_name || ''
            };
            this.selectedManualSeats = [];
            this.showManualForm = true;
            this.activeTab = 'create-booking';
        },
        resetManualBookingForm() {
            this.prefilledCrmCustomer = null;
            this.selectedManualSeats = [];
            this.showManualForm = false;
            this.isEditingBooking = false;
            this.editingBookingId = null;
            this.bookingForm = {
                bus_ticket_id: '',
                passenger_count: 1,
                passengers_data: [
                    { lastName: '', firstName: '', middleName: '', gender: 'male', docType: 'Загранпаспорт', docNumber: '', birthDate: '', citizenship: 'Таджикистан', phone: '', seatNumber: '' }
                ],
                pickup_city: '',
                drop_off_city: '',
                phone: '',
                passenger_name: ''
            };
        },
        initBooking(ticketId) {
            this.bookingForm.bus_ticket_id = ticketId;
            this.bookingForm.pickup_city = '';
            this.bookingForm.drop_off_city = '';
            this.activeTab = 'create-booking';
        },
        addPassenger() {
            this.bookingForm.passengers_data.push({ lastName: '', firstName: '', middleName: '', gender: 'male', docType: 'Загранпаспорт', docNumber: '', birthDate: '', citizenship: 'Таджикистан', phone: '', seatNumber: '' });
            this.bookingForm.passenger_count++;
        },
        initEditBooking(bookingId) {
            const booking = this.bookings.find(b => b.id === bookingId);
            if (!booking) return;
            this.isEditingBooking = true;
            this.editingBookingId = booking.id;
            this.bookingForm = {
                bus_ticket_id: booking.bus_ticket_id,
                passenger_count: booking.passenger_count,
                passengers_data: JSON.parse(JSON.stringify(booking.passengers_data || [])),
                pickup_city: booking.pickup_city || '',
                drop_off_city: booking.drop_off_city || '',
                phone: booking.phone || '',
                passenger_name: booking.passenger_name || ''
            };
            this.selectedManualSeats = (booking.passengers_data || []).map(p => Number(p.seatNumber)).filter(s => !isNaN(s));
            this.showManualForm = true;
            this.activeTab = 'create-booking';
        },
        async saveBookingUpdate() {
            this.loading = true;
            try {
                const seatNumbers = this.bookingForm.passengers_data.map(p => Number(p.seatNumber)).filter(s => !isNaN(s));
                await api.put(`/bus-admin/bookings/${this.editingBookingId}`, {
                    ...this.bookingForm,
                    seat_numbers: seatNumbers
                });
                alert('Бронирование успешно обновлено');
                this.isEditingBooking = false;
                this.editingBookingId = null;
                this.activeTab = 'bookings';
                this.fetchBookings();
            } catch (e) {
                alert('Ошибка при обновлении: ' + (e.response?.data?.error || e.message));
            } finally {
                this.loading = false;
            }
        },
        async deleteBooking(id) {
            if (!confirm('Вы уверены, что хотите полностью удалить это бронирование? Места будут освобождены.')) return;
            this.loading = true;
            try {
                await api.delete(`/bus-admin/bookings/${id}`);
                alert('Бронирование удалено');
                this.fetchBookings();
            } catch (e) {
                alert('Ошибка при удалении: ' + (e.response?.data?.error || e.message));
            } finally {
                this.loading = false;
            }
        },
        getTicketRoute(ticketId) {
            const ticket = this.tickets.find(t => t.id === ticketId);
            if (!ticket) return [];
            const stops = ticket.intermediate_stops || [];
            return [ticket.from_city, ...stops.map(s => s.city), ticket.to_city];
        },
        removePassenger(index) {
            this.bookingForm.passengers_data.splice(index, 1);
            this.bookingForm.passenger_count--;
        },
        triggerScanner(index) {
            this.ocrLoadingIndex = index;
            this.$refs.passportInput.click();
        },
        async handlePassportUpload(event) {
            const targetIndex = this.ocrLoadingIndex;
            if (targetIndex === -1) return;

            const file = event.target.files[0];
            if (!file) {
                this.ocrLoadingIndex = -1;
                return;
            }

            try {
                // 1. Compress image to < 200KB (OCR API recommendation)
                const compressedDataUri = await compressImage(file, {
                    maxWidth: 1200,
                    maxHeight: 1200,
                    quality: 0.6
                });

                // Send the full data URI so the API can identify image type
                const base64 = compressedDataUri;
                const sizeKB = Math.round(compressedDataUri.split(',')[1].length * 0.75 / 1024);
                console.log('[OCR] Compressed image size:', sizeKB, 'KB');

                // 2. Call OCR via Supabase Edge Function proxy
                const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-passport`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ img: base64 })
                });

                const data = await ocrRes.json();
                console.log('[OCR] Response:', data);

                if (data.status !== 'OK') {
                    throw new Error(data.message || 'OCR recognition failed');
                }

                // 4. Map response to passenger format
                const msg = data.message;
                console.log('[OCR] Mapping message:', msg);

                // Parse name
                let lastName = msg.surname || msg.lastName || msg.last_name || '';
                let firstName = msg.givenName || msg.given_name || msg.firstName || msg.first_name || '';

                if (!lastName && !firstName && msg.name) {
                    const cleanName = msg.name.replace(/<+/g, ' ').replace(',', '').trim();
                    const nameParts = cleanName.split(/\s+/);
                    lastName = nameParts[0] || '';
                    firstName = nameParts.slice(1).join(' ') || '';
                }

                // Parse birthDay "YYYYMMDD" or "YYYY-MM-DD" → "YYYY-MM-DD"
                const rawBirth = msg.birthDay || msg.birth_day || msg.dateOfBirth || msg.date_of_birth;
                let birthDate = '';
                if (rawBirth) {
                    if (rawBirth.includes('-')) {
                        birthDate = rawBirth;
                    } else if (rawBirth.length === 8) {
                        birthDate = `${rawBirth.slice(0, 4)}-${rawBirth.slice(4, 6)}-${rawBirth.slice(6, 8)}`;
                    }
                }

                // Map nationality codes/names to Russian names
                const natMap = {
                    'TJK': 'Таджикистан', 'TAJIKISTAN': 'Таджикистан',
                    'RUS': 'Россия', 'RUSSIA': 'Россия',
                    'UZB': 'Узбекистан', 'UZBEKISTAN': 'Узбекистан',
                    'KAZ': 'Казахстан', 'KAZAKHSTAN': 'Казахстан',
                    'KGZ': 'Кыргызстан', 'KYRGYZSTAN': 'Кыргызстан',
                    'TKM': 'Туркменистан', 'TURKMENISTAN': 'Туркменистан',
                    'BLR': 'Беларусь', 'BELARUS': 'Беларусь',
                    'UKR': 'Украина', 'UKRAINE': 'Украина',
                    'AZE': 'Азербайджан', 'AZERBAIJAN': 'Азербайджан',
                    'ARM': 'Армения', 'ARMENIA': 'Армения',
                    'GEO': 'Грузия', 'GEORGIA': 'Грузия'
                };
                const rawNat = (msg.nationality || msg.country || '').toUpperCase();
                const citizenship = natMap[rawNat] || (msg.nationality || msg.country) || 'Таджикистан';

                // 5. Fill passenger data
                const p = { ...this.bookingForm.passengers_data[targetIndex] };
                if (lastName) p.lastName = lastName;
                if (firstName) p.firstName = firstName;
                if (birthDate) p.birthDate = birthDate;

                const docNum = msg.passportNumber || msg.passport_number || msg.doc_number;
                if (docNum) p.docNumber = docNum;

                const rawGender = msg.gender || msg.sex;
                if (rawGender) {
                    p.gender = (rawGender === 'M' || rawGender === 'MALE') ? 'male' :
                               (rawGender === 'F' || rawGender === 'FEMALE') ? 'female' : '';
                }

                if (citizenship) {
                    p.citizenship = citizenship;
                }

                p.docType = 'Загранпаспорт';

                this.bookingForm.passengers_data.splice(targetIndex, 1, p);
            } catch (e) {
                console.error('OCR Error:', e);
                alert('Не удалось распознать паспорт: ' + (e.message || ''));
            } finally {
                this.ocrLoadingIndex = -1;
                event.target.value = '';
            }
        },
        async exportToExcel() {
            if (!this.passengerManifest || this.passengerManifest.length === 0) return;
            const selectedTicket = (this.tickets || []).find(t => t.id == this.selectedBookingRideId) || {};
            await exportPassengerManifestExcel(selectedTicket, this.passengerManifest, this.user);
        },
        async submitManualBooking() {
            const f = this.bookingForm;
            if (!f.bus_ticket_id) {
                alert('Выберите рейс');
                return;
            }
            // Validate each passenger has a seat number
            for (let i = 0; i < f.passengers_data.length; i++) {
                const p = f.passengers_data[i];
                const seatNum = Number(p.seatNumber);
                if (!seatNum || seatNum < 1) {
                    alert(`Пассажир ${i + 1}: укажите номер места`);
                    return;
                }
            }
            // Check for duplicate seat assignments within the form
            const assignedSeats = f.passengers_data.map(p => Number(p.seatNumber));
            const unique = new Set(assignedSeats);
            if (unique.size !== assignedSeats.length) {
                alert('Два пассажира не могут занимать одно место');
                return;
            }

            this.loading = true;
            try {
                const ticket = this.tickets.find(t => t.id === f.bus_ticket_id);
                if (!ticket) throw new Error('Рейс не найден');

                // Validate against already reserved seats
                const reserved = ticket.reserved_seats || [];
                const conflicts = assignedSeats.filter(s => reserved.includes(s));
                if (conflicts.length > 0) {
                    alert(`Место(а) ${conflicts.join(', ')} уже занято. Выберите другое.`);
                    this.loading = false;
                    return;
                }

                // Auto-copy contact info from first passenger
                const firstP = f.passengers_data[0];
                const contactName = `${firstP.lastName} ${firstP.firstName}`.trim();

                await api.post('/bus-admin/bookings/manual', {
                    bus_ticket_id: f.bus_ticket_id,
                    operator_id: this.user.id,
                    passenger_name: contactName,
                    seat_numbers: assignedSeats,
                    passengers_data: f.passengers_data,
                    phone: firstP.phone || '—',
                    pickup_city: f.pickup_city,
                    drop_off_city: f.drop_off_city
                });

                alert('Бронь успешно создана!');
                // Reset
                this.prefilledCrmCustomer = null;
                this.selectedManualSeats = [];
                this.showManualForm = false;
                this.bookingForm = {
                    bus_ticket_id: '',
                    passenger_count: 1,
                    passengers_data: [{ lastName: '', firstName: '', middleName: '', gender: 'male', docType: 'Загранпаспорт', docNumber: '', birthDate: '', citizenship: 'Таджикистан', phone: '', seatNumber: '' }],
                    pickup_city: '',
                    drop_off_city: '',
                    phone: '',
                    passenger_name: ''
                };
                this.activeTab = 'bookings';
                this.fetchBookings();
            } catch (e) {
                alert(e.response?.data?.error || 'Ошибка при бронировании');
            } finally { this.loading = false; }
        },
        async handlePhotoUpload(event) {
            const files = Array.from(event.target.files);
            if (files.length === 0) return;

            this.photoLoading = true;
            try {
                for (const file of files) {
                    // 1. Compress the image
                    const compressedBase64 = await compressImage(file, { maxWidth: 1200, quality: 0.7 });

                    // 2. Upload directly to Cloudinary
                    const result = await uploadToCloudinaryDirect(compressedBase64, {
                        uploadPreset: this.uploadPreset
                    });

                    // 3. Add to photos array
                    this.busForm.photos.push({
                        url: result.url,
                        public_id: result.public_id
                    });
                }
            } catch (err) {
                console.error('Photo upload error:', err);
                alert('Ошибка при загрузке фото: ' + err.message);
            } finally {
                this.photoLoading = false;
                event.target.value = ''; // Reset input
            }
        },
        removePhoto(index) {
            this.busForm.photos.splice(index, 1);
        },
        openShareModal(ticket) {
            this.selectedShareTicket = ticket;
            this.showShareModal = true;
        },
        getShareUrl(ticket, type = 'web') {
            if (!ticket) return '';
            const carrierId = this.user?.carrierId || this.user?.id || ticket.operator_id;
            if (type === 'telegram') {
                return `https://t.me/Poputkionline_bot?start=bus_${ticket.id}_c${carrierId}`;
            }
            return `https://www.poputki.online/bus-ticket/${ticket.id}?source=carrier_link&ref=c_${carrierId}`;
        },
        async copyShareLink(type = 'web') {
            if (!this.selectedShareTicket) return;
            const url = this.getShareUrl(this.selectedShareTicket, type);
            const success = await copyToClipboard(url);
            if (success) {
                this.showToastNotification('Ссылка скопирована в буфер обмена!');
            } else {
                this.showToastNotification('Не удалось скопировать ссылку');
            }
        },
        shareWhatsApp() {
            if (!this.selectedShareTicket) return;
            const t = this.selectedShareTicket;
            const url = this.getShareUrl(t, 'web');
            const text = encodeURIComponent(`🚌 Рейс ${t.from_city} → ${t.to_city}\n📅 Дата: ${t.departure_date} в ${t.departure_time}\n💰 Цена: ${t.price} сомони\n\nЗабронировать билет онлайн:\n${url}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
        },
        shareTelegram() {
            if (!this.selectedShareTicket) return;
            const t = this.selectedShareTicket;
            const tgUrl = this.getShareUrl(t, 'telegram');
            const text = encodeURIComponent(`🚌 Рейс ${t.from_city} → ${t.to_city}\n📅 Дата: ${t.departure_date} в ${t.departure_time}\n💰 Цена: ${t.price} сомони\n\nКупить билет в Telegram-боте:`);
            window.open(`https://t.me/share/url?url=${encodeURIComponent(tgUrl)}&text=${text}`, '_blank');
        },
        showToastNotification(msg) {
            this.shareToastMessage = msg;
            this.shareToast = true;
            setTimeout(() => {
                this.shareToast = false;
            }, 3000);
        }
    },
    computed: {
        passengerManifest() {
            if (!this.selectedBookingRideId) return [];

            const manifest = [];
            this.bookings
                .filter(b => b.bus_ticket_id == this.selectedBookingRideId)
                .forEach(b => {
                    const pData = b.passengers_data || [];
                    if (pData.length === 0) {
                        // Fallback: If no detailed passenger data is present, show the core booking info
                        manifest.push({
                            lastName: b.passenger_name || '—',
                            firstName: '',
                            middleName: '',
                            seat: (b.seat_numbers || []).join(', '),
                            gender: '—',
                            birthDate: '—',
                            docType: '—',
                            docNumber: '—',
                            citizenship: '—',
                            contactPhone: b.passenger_phone,
                            pickup_city: b.pickup_city,
                            drop_off_city: b.drop_off_city,
                            paymentStatus: b.status === 'pending_payment' ? 'Ожидает оплаты' : (b.total_price === 0 ? 'Ручная' : 'Оплачено'),
                            originalBookingId: b.id,
                            createdAt: b.created_at,
                            searchContext: `${b.passenger_name} ${b.passenger_phone} ${b.pickup_city} ${b.drop_off_city}`.toLowerCase()
                        });
                    } else {
                        pData.forEach((p, idx) => {
                            const passengerPhone = p.phone || b.passenger_phone;
                            const assignedSeat = (b.seat_numbers && b.seat_numbers[idx] !== undefined && b.seat_numbers[idx] !== null)
                                ? b.seat_numbers[idx]
                                : (p.seatNumber || p.seat || '—');
                            manifest.push({
                                    ...p,
                                    seat: assignedSeat,
                                    pickup_city: b.pickup_city,
                                    drop_off_city: b.drop_off_city,
                                    contactPhone: passengerPhone,
                                    paymentStatus: b.status === 'pending_payment' ? 'Ожидает оплаты' : (b.total_price === 0 ? 'Ручная' : 'Оплачено'),
                                    originalBookingId: b.id,
                                    createdAt: b.created_at,
                                    searchContext: `${p.lastName} ${p.firstName} ${p.middleName} ${passengerPhone} ${b.pickup_city} ${b.drop_off_city}`.toLowerCase()
                                });
                        });
                    }
                });

            const sortedManifest = sortPassengersBySeat(manifest);

            if (!this.bookingSearch) return sortedManifest;
            const s = this.bookingSearch.toLowerCase();
            return sortedManifest.filter(p => p.searchContext.includes(s));
        },
        currentBookingTicket() {
            if (!this.bookingForm.bus_ticket_id) return null;
            return this.tickets.find(t => t.id === this.bookingForm.bus_ticket_id) || null;
        },
        bookedSeatsForCurrentTicket() {
            if (!this.bookingForm.bus_ticket_id) return [];
            const ticket = this.tickets.find(t => t.id === this.bookingForm.bus_ticket_id);
            return ticket ? ticket.reserved_seats || [] : [];
        },
        crmPassengers() {
            const manifest = [];
            this.bookings.forEach(b => {
                const pData = b.passengers_data || [];
                const ticket = this.tickets.find(t => t.id === b.bus_ticket_id);
                const ticketInfo = ticket ? `${ticket.from_city} → ${ticket.to_city}` : '—';

                if (pData.length === 0) {
                    const lName = b.passenger_name || '';
                    if (lName.trim() && lName !== '—') {
                        manifest.push({
                            lastName: lName, firstName: '', middleName: '',
                            seat: (b.seat_numbers || []).join(', '),
                            gender: '—', birthDate: '—', docType: '—', docNumber: '—', citizenship: '—',
                            contactPhone: b.passenger_phone,
                            route: ticketInfo,
                            createdAt: b.created_at,
                            searchContext: `${lName} ${b.passenger_phone}`.toLowerCase()
                        });
                    }
                } else {
                    pData.forEach((p, idx) => {
                        const hasName = (p.lastName && p.lastName.trim() !== '—' && p.lastName.trim() !== '') ||
                                        (p.firstName && p.firstName.trim() !== '—' && p.firstName.trim() !== '') ||
                                        (p.middleName && p.middleName.trim() !== '—' && p.middleName.trim() !== '');

                        if (hasName) {
                            manifest.push({
                                ...p,
                                seat: (b.seat_numbers && b.seat_numbers[idx]) ? b.seat_numbers[idx] : '—',
                                contactPhone: p.phone || b.passenger_phone,
                                route: ticketInfo,
                                createdAt: b.created_at,
                                searchContext: `${p.lastName} ${p.firstName} ${p.middleName} ${p.phone} ${b.passenger_phone}`.toLowerCase()
                            });
                        }
                    });
                }
            });

            if (!this.crmSearch) return manifest;
            const s = this.crmSearch.toLowerCase();
            return manifest.filter(p => p.searchContext.includes(s));
        },
        dailyBookingsChartData() {
            if (!this.stats || !this.stats.dailyBookings) return null;
            return {
                labels: this.stats.dailyBookings.map(d => d.date),
                datasets: [{
                    label: 'Бронирований в день',
                    data: this.stats.dailyBookings.map(d => d.count),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            };
        },
        fillRateChartData() {
            if (!this.stats) return null;
            const avg = parseFloat(this.stats.avgFillRate) || 0;
            return {
                labels: ['Заполнено', 'Свободно'],
                datasets: [{
                    data: [avg, 100 - avg],
                    backgroundColor: ['#10b981', '#f1f5f9'],
                    borderWidth: 0
                }]
            };
        },
        visibleNavItems() {
            const role = this.user?.memberRole || this.user?.role;
            const isOwner = role === 'owner';

            return this.navItems.filter(item => {
                if (item.id === 'dashboard' || item.id === 'team' || item.id === 'activity') {
                    return isOwner;
                }
                if (role === 'driver') {
                    return ['boarding', 'tickets'].includes(item.id);
                }
                if (role === 'accountant') {
                    return ['finance', 'fleet'].includes(item.id);
                }
                return true;
            });
        },
        activeFleetBuses() {
            return (this.fleetBuses || []).filter(b => b && b.status === 'active');
        },
        selectedFleetBus() {
            if (!this.selectedFleetBusId) return null;
            return this.activeFleetBuses.find(b => b.id === Number(this.selectedFleetBusId)) || null;
        }


    },
watch: {
        selectedManualSeats(newVal) {
            const currentPassengers = [...this.bookingForm.passengers_data];
            const newPassengers = [];
            const usedIndices = new Set();

            const crmData = this.prefilledCrmCustomer ? (this.prefilledCrmCustomer.passengers_data?.[0] || {}) : null;

            newVal.forEach((seatNum, idx) => {
                // 1. Check if an existing passenger already holds this seat number
                let matchIdx = currentPassengers.findIndex((p, pIdx) => !usedIndices.has(pIdx) && String(p.seatNumber) === String(seatNum));

                // 2. If not found by seatNumber and unseated passenger exists, match unseated passenger
                if (matchIdx === -1) {
                    matchIdx = currentPassengers.findIndex((p, pIdx) => !usedIndices.has(pIdx) && (!p.seatNumber || p.seatNumber === ''));
                }

                if (matchIdx !== -1) {
                    usedIndices.add(matchIdx);
                    newPassengers.push({
                        ...currentPassengers[matchIdx],
                        seatNumber: seatNum
                    });
                } else if (idx === 0 && crmData) {
                    // Fallback: ensure first seat retains CRM customer
                    newPassengers.push({
                        lastName: crmData.lastName || '',
                        firstName: crmData.firstName || this.prefilledCrmCustomer.passenger_name || '',
                        middleName: crmData.middleName || '',
                        gender: crmData.gender || 'male',
                        docType: crmData.docType || 'Загранпаспорт',
                        docNumber: crmData.docNumber || '',
                        birthDate: crmData.birthDate || '',
                        citizenship: crmData.citizenship || 'Таджикистан',
                        phone: crmData.phone || this.prefilledCrmCustomer.phone || '',
                        seatNumber: seatNum
                    });
                } else {
                    // Additional seat creates a clean empty passenger template
                    newPassengers.push({
                        lastName: '', firstName: '', middleName: '', gender: 'male',
                        docType: 'Загранпаспорт', docNumber: '', birthDate: '',
                        citizenship: 'Таджикистан', phone: '', seatNumber: seatNum
                    });
                }
            });

            // Reassign CRM customer data to the first remaining seat if their previous seat was deselected
            if (crmData && newPassengers.length > 0) {
                const hasCrmCustomerSeated = newPassengers.some(p =>
                    (crmData.docNumber && p.docNumber === crmData.docNumber) ||
                    (crmData.phone && p.phone === crmData.phone) ||
                    (crmData.firstName && p.firstName === crmData.firstName)
                );
                if (!hasCrmCustomerSeated) {
                    newPassengers[0] = {
                        lastName: crmData.lastName || '',
                        firstName: crmData.firstName || this.prefilledCrmCustomer.passenger_name || '',
                        middleName: crmData.middleName || '',
                        gender: crmData.gender || 'male',
                        docType: crmData.docType || 'Загранпаспорт',
                        docNumber: crmData.docNumber || '',
                        birthDate: crmData.birthDate || '',
                        citizenship: crmData.citizenship || 'Таджикистан',
                        phone: crmData.phone || this.prefilledCrmCustomer.phone || '',
                        seatNumber: newPassengers[0].seatNumber
                    };
                }
            }

            // If all seats deselected:
            if (newPassengers.length === 0) {
                if (crmData) {
                    newPassengers.push({
                        lastName: crmData.lastName || '',
                        firstName: crmData.firstName || this.prefilledCrmCustomer.passenger_name || '',
                        middleName: crmData.middleName || '',
                        gender: crmData.gender || 'male',
                        docType: crmData.docType || 'Загранпаспорт',
                        docNumber: crmData.docNumber || '',
                        birthDate: crmData.birthDate || '',
                        citizenship: crmData.citizenship || 'Таджикистан',
                        phone: crmData.phone || this.prefilledCrmCustomer.phone || '',
                        seatNumber: ''
                    });
                } else {
                    newPassengers.push({
                        lastName: '', firstName: '', middleName: '', gender: 'male',
                        docType: 'Загранпаспорт', docNumber: '', birthDate: '',
                        citizenship: 'Таджикистан', phone: '', seatNumber: ''
                    });
                }
            }

            this.bookingForm.passengers_data = newPassengers;
            this.bookingForm.passenger_count = newPassengers.length;
        },
        'bookingForm.bus_ticket_id'() {
            this.selectedManualSeats = [];
            this.showManualForm = false;
            if (this.prefilledCrmCustomer) {
                const crmData = this.prefilledCrmCustomer.passengers_data?.[0] || {};
                this.bookingForm.passengers_data = [
                    {
                        lastName: crmData.lastName || '',
                        firstName: crmData.firstName || this.prefilledCrmCustomer.passenger_name || '',
                        middleName: crmData.middleName || '',
                        gender: crmData.gender || 'male',
                        docType: crmData.docType || 'Загранпаспорт',
                        docNumber: crmData.docNumber || '',
                        birthDate: crmData.birthDate || '',
                        citizenship: crmData.citizenship || 'Таджикистан',
                        phone: crmData.phone || this.prefilledCrmCustomer.phone || '',
                        seatNumber: ''
                    }
                ];
                this.bookingForm.passenger_count = 1;
                this.bookingForm.phone = this.prefilledCrmCustomer.phone || '';
                this.bookingForm.passenger_name = this.prefilledCrmCustomer.passenger_name || '';
            }
        },
        selectedFleetBusId(newId) {
            const bus = this.selectedFleetBus;
            if (bus) {
                this.busForm.bus_id = bus.id;
                this.busForm.bus_type = bus.bus_type || 'single';
                this.busForm.total_seats = bus.total_seats || 53;
                this.busForm.floor1_seats = bus.floor1_seats || 20;
                this.busForm.floor2_seats = bus.floor2_seats || 56;
                this.busForm.photos = Array.isArray(bus.photos) ? JSON.parse(JSON.stringify(bus.photos)) : [];
            } else {
                this.busForm.bus_id = null;
            }
        },
        activeTab(newTab) {
            if (newTab === 'create-booking' && !this.isEditingBooking) {
                if (this.selectedManualSeats.length === 0 && !this.prefilledCrmCustomer) {
                    this.showManualForm = false;
                }
            }
            this.fetchData();
        }
    }
}
</script>

<template>
     <div class="h-screen bg-slate-50 text-slate-800 flex overflow-hidden font-sans">

        <!-- Auth Overlay -->
        <div v-if="!isAuthenticated" class="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center p-4 sm:p-6">
            <div class="max-w-md w-full bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-2xl text-center">
                <AppLogo
                    :showText="false"
                    containerClass="mx-auto mb-6"
                    iconSizeClass="w-20 h-20"
                    iconClass="h-10 w-10"
                    iconBgClass="bg-amber-100 text-amber-500"
                />
                <h1 class="text-3xl font-bold mb-2 text-slate-900">Кабинет Перевозчика</h1>
                <p class="text-slate-500 mb-6">Введите телефон и пароль для входа</p>
                <div v-if="authErrorMessage" class="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium text-left flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <span>{{ authErrorMessage }}</span>
                </div>
                <input
                    v-model="phone"
                    type="tel"
                    placeholder="Номер телефона"
                    class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center text-lg focus:border-amber-500 text-slate-900 outline-none transition-all mb-4"
                />
                <input
                    v-model="password"
                    type="password"
                    placeholder="Пароль"
                    class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center text-lg focus:border-amber-500 text-slate-900 outline-none transition-all mb-6"
                    @keyup.enter="handleLogin"
                />
                <button
                    @click="handleLogin"
                    :disabled="loading"
                    class="w-full flex justify-center items-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                    <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                    Войти
                </button>
            </div>
        </div>

        <template v-else>
            <!-- Mobile Header -->
            <div class="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-slate-100 p-4 flex justify-between items-center shadow-sm">
                <div class="flex items-center space-x-3">
                <AppLogo
                    :showText="false"
                    iconSizeClass="w-8 h-8"
                    iconClass="h-5 w-5"
                    iconBgClass="bg-amber-500 text-white"
                />
                    <span class="text-lg font-bold tracking-tight text-slate-900">Перевозчик</span>
                </div>
                <button @click="mobileMenuOpen = !mobileMenuOpen" class="text-slate-400 p-2">
                    <svg v-if="!mobileMenuOpen" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Sidebar -->
            <aside
                class="lg:w-72 bg-white border-r border-slate-100 flex flex-col pt-8 fixed lg:relative inset-y-0 left-0 z-30 transition-transform transform lg:translate-x-0 w-64 shadow-sm"
                :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
            >
                <div class="px-8 mb-12">
                    <div class="flex items-center space-x-3">
                    <AppLogo
                        :showText="false"
                        iconSizeClass="w-10 h-10"
                        iconClass="h-6 w-6"
                        iconBgClass="bg-amber-500 text-white"
                    />
                        <div>
                            <span class="text-xl font-bold tracking-tight block text-slate-900">{{ user?.name }}</span>
                            <span class="text-xs text-slate-400">Перевозчик</span>
                        </div>
                    </div>
                </div>
<br>                <nav class="flex-1 px-4 space-y-2 overflow-y-auto">
                    <button
                        v-for="item in visibleNavItems"
                        :key="item.id"
                        @click="activeTab = item.id; mobileMenuOpen = false; if(item.id !== 'create') { isEditingTicket = false; editingTicketId = null; }"
                        class="w-full px-4 py-3 rounded-xl flex items-center space-x-3 transition-all group"
                        :class="activeTab === item.id ? 'bg-amber-50 text-amber-600 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
                    >
                        <span class="capitalize font-medium">{{ item.label }}</span>
                    </button>
                </nav>

                <div class="p-6 border-t border-slate-100">
                    <button @click="logout" class="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors w-full text-left flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>Выйти из аккаунта</span>
                    </button>
                </div>
            </aside>

            <!-- Main Content -->
            <main class="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-10 pt-20 lg:pt-10 w-full overflow-x-hidden">

                <!-- Boarding Section -->
                <section v-if="activeTab === 'boarding'" class="space-y-6">
                    <CarrierBoarding
                        :tickets="tickets"
                        :bookings="bookings"
                        :loading="loading"
                        @refresh="fetchBookings(); fetchTickets()"
                    />
                </section>

                <!-- Dashboard Section -->
                <section v-if="activeTab === 'dashboard'" class="space-y-6">
                    <CarrierDashboard
                        @navigate="activeTab = $event"
                    />
                </section>


                <!-- Tickets List -->
                <section v-if="activeTab === 'tickets'" class="space-y-6 lg:space-y-8">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">Мои рейсы</h2>
                        <button
                            v-if="ticketsState === 'network_error' || ticketsState === 'forbidden_error'"
                            @click="fetchTickets"
                            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Повторить</span>
                        </button>
                    </div>

                    <!-- 1. Loading State -->
                    <div v-if="loading && tickets.length === 0" class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
                        <div v-for="i in 4" :key="'ticket-skel-'+i" class="bg-white rounded-3xl border border-slate-100 p-6 lg:p-8 h-64 shadow-sm relative overflow-hidden">
                             <div class="h-4 w-24 bg-slate-50 rounded mb-6"></div>
                             <div class="flex items-center justify-between mb-8">
                                 <div class="h-8 w-32 bg-slate-50 rounded"></div>
                                 <div class="h-8 w-8 bg-slate-50 rounded-full"></div>
                                 <div class="h-8 w-32 bg-slate-50 rounded text-right"></div>
                             </div>
                             <div class="pt-6 border-t border-slate-50 flex justify-between items-center">
                                 <div class="h-4 w-20 bg-slate-50 rounded"></div>
                                 <div class="h-10 w-32 bg-slate-50 rounded-xl"></div>
                             </div>
                        </div>
                    </div>

                    <!-- 2. Forbidden Error State (403) -->
                    <div v-else-if="ticketsState === 'forbidden_error'" class="bg-red-50 p-8 rounded-[32px] border border-red-100 text-center shadow-sm">
                        <div class="inline-flex p-3 bg-red-100 text-red-600 rounded-2xl mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-11a4 4 0 00-8 0v4h8V4zM6 8h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2z" />
                            </svg>
                        </div>
                        <p class="text-sm font-bold text-red-800">{{ ticketsErrorMessage || 'У вас нет доступа к этому разделу.' }}</p>
                    </div>

                    <!-- 3. Network / Server Error State -->
                    <div v-else-if="ticketsState === 'network_error'" class="bg-amber-50 p-8 rounded-[32px] border border-amber-100 text-center shadow-sm space-y-4">
                        <div class="inline-flex p-3 bg-amber-100 text-amber-600 rounded-2xl mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <p class="text-sm font-bold text-amber-900">{{ ticketsErrorMessage || 'Не удалось загрузить рейсы. Попробуйте ещё раз.' }}</p>
                        <div>
                            <button @click="fetchTickets" class="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20">
                                Повторить
                            </button>
                        </div>
                    </div>

                    <!-- 4. True Empty State (HTTP 200 with 0 items) -->
                    <div v-else-if="!loading && tickets.length === 0" class="bg-white p-8 rounded-[32px] border border-slate-100 text-center text-slate-400 shadow-sm">
                        У вас пока нет созданных рейсов.
                    </div>

                    <!-- 5. Success State with items -->
                    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div v-for="ticket in tickets" :key="ticket.id" class="bg-white rounded-3xl border border-slate-100 p-6 lg:p-8 flex flex-col justify-between shadow-sm overflow-hidden relative group transition-all hover:shadow-md">
                            <div class="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-bl-[100px] -z-0 opacity-50"></div>


                            <div class="relative z-10">
                                <div class="flex justify-between items-start mb-6">
                                    <div class="flex space-x-3 items-center">
                                        <div class="bg-amber-100 p-3 rounded-2xl">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Отправление</p>
                                            <p class="font-bold text-lg leading-tight text-slate-800">{{ ticket.departure_date }} в {{ ticket.departure_time }}</p>
                                        </div>
                                    </div>
                                    <div class="bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 flex items-center space-x-2">
                                        <span class="text-emerald-600 font-bold text-sm">{{ ticket.price }} с.</span>
                                        <span v-if="ticket.status === 'completed'" class="bg-emerald-600 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded-md">Завершен</span>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between mb-8 relative">
                                    <div class="absolute top-[40%] left-10 right-10 h-0.5 bg-slate-100 -translate-y-1/2 rounded-full hidden sm:block"></div>
                                    <div class="z-10 bg-white pr-4">
                                        <h3 class="text-xl md:text-2xl font-black text-slate-900">{{ ticket.from_city }}</h3>
                                        <p class="text-xs text-slate-400 truncate max-w-[120px] md:max-w-xs mt-1">{{ ticket.from_address }}</p>
                                    </div>
                                    <div class="z-10 bg-white px-2 hidden sm:flex items-center justify-center text-amber-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                    </div>
                                    <div class="z-10 bg-white pl-4 text-right">
                                        <h3 class="text-xl md:text-2xl font-black text-slate-900">{{ ticket.to_city }}</h3>
                                        <p class="text-xs text-slate-400 truncate max-w-[120px] md:max-w-xs mt-1">{{ ticket.to_address }}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col sm:flex-row gap-4 justify-between sm:items-center pt-6 border-t border-slate-50 mt-auto">
                                <div class="flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <span class="text-sm font-bold text-slate-400">
                                        <span class="text-slate-900">{{ ticket.total_seats - ticket.reserved_seats.length }}</span>
                                        / {{ ticket.total_seats }} свободно
                                    </span>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                     <span class="hidden sm:inline-block text-[10px] font-bold px-3 py-1 bg-slate-50 rounded-lg text-slate-400 border border-slate-100 uppercase tracking-widest">{{ ticket.transport_company }}</span>
                                     <div class="flex flex-wrap items-center gap-2" v-if="ticket.status !== 'completed'">
                                         <button @click="openShareModal(ticket)" class="px-3 py-2.5 bg-slate-50 text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-slate-100 flex items-center gap-1.5 text-xs font-bold" title="Поделиться рейсом">
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                             </svg>
                                             <span>Поделиться</span>
                                         </button>
                                         <button @click="duplicateTicket(ticket)" class="px-3 py-2.5 bg-slate-50 text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-slate-100 flex items-center gap-1.5 text-xs font-bold" title="Повторить рейс">
                                             <span>📋</span>
                                             <span>Повторить</span>
                                         </button>
                                         <button @click="reverseTicket(ticket)" class="px-3 py-2.5 bg-slate-50 text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-slate-100 flex items-center gap-1.5 text-xs font-bold" title="Создать обратный рейс">
                                             <span>🔄</span>
                                             <span>Обратный</span>
                                         </button>
                                     </div>
                                     <div class="flex items-center space-x-2" v-else>
                                         <button @click="deleteTicket(ticket.id)" class="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-slate-100" title="Удалить">
                                             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                         </button>
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Bookings section with Trip Financial Summary -->
                <section v-if="activeTab === 'bookings'" class="space-y-6">
                    <CarrierTripBookings
                        :tickets="tickets"
                        :bookings="bookings"
                        :loading="loading"
                        :user="user"
                        @refresh="fetchBookings(); fetchTickets()"
                        @edit-booking="initEditBooking"
                        @delete-booking="deleteBooking"
                    />
                </section>

                <!-- Finance Section -->
                <section v-if="activeTab === 'finance'" class="space-y-6">
                    <CarrierFinance
                        :user="user"
                        @select-trip-bookings="(ticketId) => { activeTab = 'bookings'; }"
                    />
                </section>

                <!-- Fleet Management Section -->
                <section v-if="activeTab === 'fleet'" class="space-y-6">
                    <CarrierFleet :user="user" />
                </section>

                <!-- Team Management Section -->
                <section v-if="activeTab === 'team'" class="space-y-6">
                    <CarrierMembers
                        :user="user"
                        :tickets="tickets"
                    />
                </section>
                <!-- CRM section -->
                <section v-if="activeTab === 'crm'" class="space-y-6">
                    <CarrierCustomers
                        :user="user"
                        @quick-rebook="handleQuickRebook"
                    />
                </section>

                <!-- Activity History Section -->
                <section v-if="activeTab === 'activity'" class="space-y-6">
                    <CarrierActivity
                        :user="user"
                    />
                </section>
                <!-- Create Booking Section -->
                <section v-if="activeTab === 'create-booking'" class="space-y-6 lg:space-y-8">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">{{ isEditingBooking ? 'Редактировать бронирование' : 'Создать бронирование вручную' }}</h2>
                        <div class="flex items-center gap-2">
                            <button v-if="isEditingBooking" @click="isEditingBooking = false; activeTab = 'bookings'" class="text-xs font-bold text-slate-400 hover:text-slate-600">Отмена</button>
                            <button v-else-if="prefilledCrmCustomer || bookingForm.bus_ticket_id || selectedManualSeats.length > 0" @click="resetManualBookingForm" class="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors">Очистить форму</button>
                        </div>
                    </div>

                    <!-- CRM Prefill Banner -->
                    <div v-if="prefilledCrmCustomer" class="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-bold shadow-sm">
                        <div class="flex items-center gap-2">
                            <span class="text-base">👤</span>
                            <span>Быстрое бронирование для клиента: <strong class="text-slate-900">{{ prefilledCrmCustomer.passenger_name || prefilledCrmCustomer.phone }}</strong> (данные подставлены из CRM)</span>
                        </div>
                        <button @click="resetManualBookingForm" class="text-amber-700 hover:text-amber-900 text-xs underline font-bold">Сбросить</button>
                    </div>

                    <div class="bg-white rounded-[32px] border border-slate-100 p-6 lg:p-8 shadow-sm space-y-6">
                        <!-- Ride selector -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Выберите рейс</label>
                            <select v-model="bookingForm.bus_ticket_id" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500 appearance-none cursor-pointer">
                                <option value="" disabled>Рейс не выбран</option>
                                <option v-for="t in tickets" :key="'book-t-'+t.id" :value="t.id">
                                    {{ t.from_city }} -> {{ t.to_city }} ({{ t.departure_date }} {{ t.departure_time }})
                                </option>
                            </select>
                        </div>

                        <!-- Bus Seat Selector (shown after ride is selected) -->
                        <div v-if="currentBookingTicket && !showManualForm" class="border-t border-slate-50 pt-6 mt-6">
                            <h3 class="text-lg font-bold text-slate-800 text-center mb-2">Схема салона</h3>
                            <p class="text-[11px] font-bold text-slate-400 text-center mb-6 uppercase tracking-widest">Дважды кликните по свободному месту для бронирования</p>
                            <BusSeatSelector
                                v-model="selectedManualSeats"
                                @seat-dblclick="handleSeatDblClick"
                                :bookedSeats="bookedSeatsForCurrentTicket"
                                :totalSeats="currentBookingTicket.total_seats"
                                :floor1Seats="currentBookingTicket.floor1_seats"
                                :floor2Seats="currentBookingTicket.floor2_seats"
                                :busType="currentBookingTicket.bus_type"
                                :maxSelectable="50"
                            />
                        </div>

                        <!-- Manual booking form (shown only if seats are selected) -->
                        <div v-if="showManualForm" class="border-t border-slate-50 pt-6 mt-6">
                            <!-- Pickup/Dropoff selector for manual booking -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Город посадки</label>
                                    <input v-model="bookingForm.pickup_city" placeholder="Напр. Душанбе" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500" />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Город высадки</label>
                                    <input v-model="bookingForm.drop_off_city" placeholder="Напр. Худжанд" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500" />
                                </div>
                            </div>

                            <div class="space-y-4 pt-2 border-t border-slate-50">
                                <!-- Hidden File Input for OCR -->
                                <input type="file" ref="passportInput" class="hidden" accept="image/*" @change="handlePassportUpload" />
                                <div class="flex justify-between items-center">
                                    <h3 class="text-sm font-bold text-slate-700">Данные пассажиров ({{ bookingForm.passenger_count }})</h3>
                                    <!-- Add Passenger button removed as layout selection handles this -->
                                </div>
                                <div v-for="(p, idx) in bookingForm.passengers_data" :key="idx" class="bg-slate-50 p-6 rounded-[24px] border border-slate-100 relative shadow-inner">
                                    <div class="flex items-center justify-between mb-4">
                                        <div class="flex items-center gap-3">
                                            <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Пассажир {{ idx + 1 }}</span>
                                            <button @click="triggerScanner(idx)" type="button" :disabled="ocrLoadingIndex !== -1"
                                                class="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none">
                                                <span v-if="ocrLoadingIndex === idx" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                </svg>
                                                {{ ocrLoadingIndex === idx ? 'Распознавание...' : 'Заполнить по паспорту' }}
                                            </button>
                                        </div>
                                        <!-- Removed delete button from passenger data; user unselects seat on map -->
                                    </div>
                                    <!-- Seat number — prominent at top (disabled as it's from map) -->
                                    <div class="mb-4 space-y-1">
                                        <label class="text-[9px] text-amber-600 font-black uppercase ml-1">★ Номер места</label>
                                        <input :value="p.seatNumber" disabled type="number" class="w-full bg-slate-100/50 border-2 border-amber-200/50 rounded-xl p-3 text-sm text-slate-500 cursor-not-allowed font-bold" />
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Фамилия</label>
                                        <input v-model="p.lastName" placeholder="Иванов" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 shadow-sm" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Имя</label>
                                        <input v-model="p.firstName" placeholder="Иван" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 shadow-sm" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Отчество</label>
                                        <input v-model="p.middleName" placeholder="Иванович" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 shadow-sm" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Пол</label>
                                        <select v-model="p.gender" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none appearance-none cursor-pointer shadow-sm">
                                            <option value="" disabled>Выберите пол</option>
                                            <option value="male">Мужской</option>
                                            <option value="female">Женский</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Тип документа</label>
                                        <select v-model="p.docType" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none shadow-sm">
                                            <option>Загранпаспорт</option>
                                            <option>Паспорт</option>
                                            <option>Свид. о рождении</option>
                                        </select>
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Номер документа</label>
                                        <input v-model="p.docNumber" placeholder="A0000000" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 shadow-sm" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Дата рождения</label>
                                        <input v-model="p.birthDate" type="date" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none shadow-sm" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Гражданство</label>
                                        <input v-model="p.citizenship" placeholder="Таджикистан" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 shadow-sm" />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Телефон пассажира</label>
                                        <input v-model="p.phone" placeholder="+992..." class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-amber-500 shadow-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>

                            <div class="flex justify-end pt-4 gap-3">
                                <button v-if="!isEditingBooking" @click="showManualForm = false" class="px-8 py-3.5 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">Назад к схеме</button>
                                <button v-if="isEditingBooking" @click="isEditingBooking = false; activeTab = 'bookings'" class="px-8 py-3.5 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">Отмена</button>
                                <button @click="isEditingBooking ? saveBookingUpdate() : submitManualBooking()" :disabled="loading" class="px-8 py-3.5 bg-amber-500 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2">
                                    <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    {{ isEditingBooking ? 'Сохранить изменения' : 'Создать бронирование' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Create Bus Section -->
                <section v-if="activeTab === 'create'" class="space-y-6 lg:space-y-8 text-slate-900">
                    <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">{{ isEditingTicket ? 'Редактировать рейс' : 'Опубликовать новый рейс' }}</h2>

                    <div class="bg-white rounded-[32px] border border-slate-100 p-6 lg:p-8 shadow-sm space-y-8">
                        <!-- Fleet Bus Selector Section -->
                        <div class="space-y-4 pb-6 border-b border-slate-100">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <label class="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span v-if="!isEditingTicket">🚌 Автобус из автопарка</span>
                                        <span v-else-if="editingOriginalBusId">🚌 Замена автобуса рейса</span>
                                        <span v-else>🚌 Назначить автобус из автопарка</span>
                                    </label>
                                    <p class="text-xs text-slate-500 mt-0.5">
                                        Характеристики, схема мест и фотографии подставятся автоматически
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    @click="activeTab = 'fleet'"
                                    class="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                                >
                                    <span>Мой автопарк →</span>
                                </button>
                            </div>

                            <!-- If No Active Buses in Fleet -->
                            <div v-if="!fleetLoading && activeFleetBuses.length === 0" class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div class="flex items-center gap-2.5">
                                    <span class="text-lg">ℹ️</span>
                                    <span>В вашем автопарке пока нет активных автобусов. Вы можете создать рейс вручную или сначала добавить автобус в автопарк.</span>
                                </div>
                                <button
                                    type="button"
                                    @click="activeTab = 'fleet'"
                                    class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold whitespace-nowrap transition-all shadow-sm cursor-pointer"
                                >
                                    + Добавить автобус
                                </button>
                            </div>

                            <!-- If Fleet Has Active Buses -->
                            <div v-else class="space-y-4">
                                <div class="relative">
                                    <select
                                        v-model="selectedFleetBusId"
                                        class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold text-sm outline-none focus:border-amber-500 appearance-none cursor-pointer shadow-inner"
                                    >
                                        <option v-if="!isEditingTicket || !editingOriginalBusId" value="">-- Выберите автобус из автопарка (или заполните вручную) --</option>
                                        <option v-else value="" disabled>-- Выберите автобус для замены --</option>
                                        <option v-for="b in activeFleetBuses" :key="'fleet-bus-'+b.id" :value="b.id">
                                            {{ b.brand }} {{ b.model }} ({{ b.name }}) • {{ b.license_plate }} • {{ b.total_seats }} мест • {{ b.bus_type === 'double' ? '2 этажа' : '1 этаж' }}
                                        </option>
                                    </select>
                                    <div class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                                        ▼
                                    </div>
                                </div>

                                <!-- Selected Bus Summary Card -->
                                <div v-if="selectedFleetBus" class="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div class="flex items-center gap-4">
                                        <!-- Thumbnail -->
                                        <div class="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-amber-200 shrink-0 shadow-sm">
                                            <img
                                                v-if="selectedFleetBus.photos && selectedFleetBus.photos.length > 0"
                                                :src="selectedFleetBus.photos.find(p=>p.is_main)?.url || selectedFleetBus.photos[0].url"
                                                class="w-full h-full object-cover"
                                            />
                                            <div v-else class="w-full h-full flex items-center justify-center text-2xl">
                                                🚌
                                            </div>
                                        </div>

                                        <!-- Info -->
                                        <div class="space-y-1">
                                            <div class="flex items-center gap-2">
                                                <span class="font-black text-slate-900 text-sm sm:text-base">{{ selectedFleetBus.brand }} {{ selectedFleetBus.model }}</span>
                                                <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                                    {{ selectedFleetBus.name }}
                                                </span>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
                                                <span class="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">{{ selectedFleetBus.license_plate }}</span>
                                                <span>•</span>
                                                <span class="font-bold text-slate-800">
                                                    {{ selectedFleetBus.total_seats }} мест
                                                    <template v-if="selectedFleetBus.bus_type === 'double' && selectedFleetBus.floor1_seats">
                                                        ({{ selectedFleetBus.floor1_seats }} + {{ selectedFleetBus.floor2_seats }})
                                                    </template>
                                                </span>
                                                <span>•</span>
                                                <span>{{ selectedFleetBus.bus_type === 'double' ? '2 этажа' : '1 этаж' }}</span>
                                                <span v-if="selectedFleetBus.year_built">• {{ selectedFleetBus.year_built }} г.</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-2 self-end sm:self-auto">
                                        <button
                                            v-if="!isEditingTicket || !editingOriginalBusId"
                                            type="button"
                                            @click="selectedFleetBusId = ''"
                                            class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs transition-all shadow-sm cursor-pointer"
                                        >
                                            Сбросить выбор
                                        </button>
                                        <span
                                            v-else
                                            class="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs"
                                        >
                                            Выбрать другой автобус ⬆
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <!-- Company -->
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Компания</label>
                                <input v-model="busForm.transport_company" placeholder="Название перевозчика"
                                    class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500 transition-all shadow-inner"
                                    :class="{'border-red-500': busErrors.transport_company}" />
                                <p v-if="busErrors.transport_company" class="text-[9px] text-red-500 ml-1">{{ busErrors.transport_company }}</p>
                            </div>

                            <!-- From City -->
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Откуда</label>
                                <select v-model="busForm.from_city" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500 transition-all shadow-inner appearance-none cursor-pointer" :class="{'border-red-500': busErrors.from_city}">
                                    <option value="" disabled>Выберите город</option>
                                    <option v-for="c in cities" :key="'bus-from-'+c" :value="c">{{ c }}</option>
                                </select>
                                <p v-if="busErrors.from_city" class="text-[9px] text-red-500 ml-1">{{ busErrors.from_city }}</p>
                            </div>

                            <!-- From Address -->
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Адрес отправления</label>
                                <input v-model="busForm.from_address" placeholder="Точный адрес автовокзала"
                                    class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500 transition-all shadow-inner"
                                    :class="{'border-red-500': busErrors.from_address}" />
                                <p v-if="busErrors.from_address" class="text-[9px] text-red-500 ml-1">{{ busErrors.from_address }}</p>
                            </div>

                            <!-- To City -->
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Куда</label>
                                <select v-model="busForm.to_city" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500 transition-all shadow-inner appearance-none cursor-pointer" :class="{'border-red-500': busErrors.to_city}">
                                    <option value="" disabled>Выберите город</option>
                                    <option v-for="c in cities" :key="'bus-to-'+c" :value="c">{{ c }}</option>
                                </select>
                                <p v-if="busErrors.to_city" class="text-[9px] text-red-500 ml-1">{{ busErrors.to_city }}</p>
                            </div>

                            <!-- To Address -->
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Адрес прибытия</label>
                                <input v-model="busForm.to_address" placeholder="Точный адрес прибытия"
                                    class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-500 transition-all shadow-inner"
                                    :class="{'border-red-500': busErrors.to_address}" />
                                <p v-if="busErrors.to_address" class="text-[9px] text-red-500 ml-1">{{ busErrors.to_address }}</p>
                            </div>

                            <!-- Dates (Departure) -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Дата отпр.</label>
                                    <input v-model="busForm.departure_date" type="date" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs" :class="{'border-red-500': busErrors.departure_date}" />
                                    <p v-if="busErrors.departure_date" class="text-[9px] text-red-400 ml-1">{{ busErrors.departure_date }}</p>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Время отпр.</label>
                                    <input v-model="busForm.departure_time" type="time" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs" :class="{'border-red-500': busErrors.departure_time}" />
                                    <p v-if="busErrors.departure_time" class="text-[9px] text-red-400 ml-1">{{ busErrors.departure_time }}</p>
                                </div>
                            </div>

                            <!-- Dates (Arrival) -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Дата приб.</label>
                                    <input v-model="busForm.arrival_date" type="date" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs" :class="{'border-red-500': busErrors.arrival_date}" />
                                    <p v-if="busErrors.arrival_date" class="text-[9px] text-red-400 ml-1">{{ busErrors.arrival_date }}</p>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Время приб.</label>
                                    <input v-model="busForm.arrival_time" type="time" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs" :class="{'border-red-500': busErrors.arrival_time}" />
                                    <p v-if="busErrors.arrival_time" class="text-[9px] text-red-400 ml-1">{{ busErrors.arrival_time }}</p>
                                </div>
                            </div>

                            <!-- Price -->
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Цена (с.)</label>
                                <input v-model="busForm.price" type="number" placeholder="000.00"
                                    class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-amber-600 font-bold text-xl outline-none focus:border-amber-500 transition-all shadow-inner" :class="{'border-red-500': busErrors.price}" />
                                <p v-if="busErrors.price" class="text-[10px] text-red-500 mt-1 ml-1 font-bold">{{ busErrors.price }}</p>
                            </div>

                            <!-- Duration (when selectedFleetBus is active) -->
                            <div v-if="selectedFleetBus" class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Длительность (ч.)</label>
                                <input v-model="busForm.duration_hours" type="number" step="0.5" placeholder="Напр. 48" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400" :class="{'border-red-500': busErrors.duration_hours}" />
                                <p v-if="busErrors.duration_hours" class="text-[9px] text-red-500 ml-1">{{ busErrors.duration_hours }}</p>
                            </div>

                            <!-- Bus Type Selection (Manual mode only) -->
                            <div v-if="!selectedFleetBus" class="space-y-2 flex flex-col">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 text-slate-400">Конфигурация автобуса (вручную)</label>
                                <div class="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                                    <button @click="busForm.bus_type = 'single'; busForm.total_seats = 53"
                                        :class="busForm.bus_type === 'single' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'"
                                        class="flex-1 py-3 rounded-xl font-bold text-xs transition-all tracking-tighter uppercase whitespace-nowrap px-2 cursor-pointer"
                                    >
                                        Обычный (53)
                                    </button>
                                    <button @click="busForm.bus_type = 'double'; busForm.floor1_seats = 20; busForm.floor2_seats = 56; busForm.total_seats = 76"
                                        :class="busForm.bus_type === 'double' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'"
                                        class="flex-1 py-3 rounded-xl font-bold text-xs transition-all tracking-tighter uppercase whitespace-nowrap px-2 cursor-pointer"
                                    >
                                        Двухэтажный (76)
                                    </button>
                                </div>
                            </div>

                            <!-- Total Seats & Duration (manual single-floor) -->
                            <div v-if="!selectedFleetBus && busForm.bus_type === 'single'" class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Мест всего</label>
                                    <input v-model="busForm.total_seats" type="number" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none" />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Длительность (ч.)</label>
                                    <input v-model="busForm.duration_hours" type="number" step="0.5" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none" :class="{'border-red-500': busErrors.duration_hours}" />
                                    <p v-if="busErrors.duration_hours" class="text-[9px] text-red-500 ml-1">{{ busErrors.duration_hours }}</p>
                                </div>
                            </div>

                            <!-- Per-floor Seats & Duration (manual double-decker) -->
                            <div v-if="!selectedFleetBus && busForm.bus_type === 'double'" class="space-y-4">
                                <div class="grid grid-cols-3 gap-4">
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1 Этаж (мест)</label>
                                        <input v-model="busForm.floor1_seats" type="number" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none" :class="{'border-red-500': busErrors.floor1_seats}" />
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2 Этаж (мест)</label>
                                        <input v-model="busForm.floor2_seats" type="number" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none" :class="{'border-red-500': busErrors.floor2_seats}" />
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Длительность (ч.)</label>
                                        <input v-model="busForm.duration_hours" type="number" step="0.5" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400" :class="{'border-red-500': busErrors.duration_hours}" />
                                        <p v-if="busErrors.duration_hours" class="text-[9px] text-red-500 ml-1">{{ busErrors.duration_hours }}</p>
                                    </div>
                                </div>
                                <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Всего мест: </span>
                                    <span class="text-slate-900 font-bold ml-1">{{ Number(busForm.floor1_seats) + Number(busForm.floor2_seats) }}</span>
                                </div>
                            </div>

                            <!-- Premium Price (for double decker) -->
                            <div v-if="(selectedFleetBus && selectedFleetBus.bus_type === 'double') || (!selectedFleetBus && busForm.bus_type === 'double')" class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">★ Цена за Премиум-место (с.)</label>
                                <input v-model="busForm.premium_price" type="number" placeholder="0 = нет премиума"
                                    class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 font-bold text-xl outline-none focus:border-amber-500 transition-all shadow-inner" />
                            </div>
                        </div>

                        <!-- Live Seat Layout Scheme -->
                        <div class="space-y-3 pt-4 border-t border-slate-50">
                            <div class="flex items-center justify-between">
                                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <span>💺 Предпросмотр схемы мест</span>
                                </h3>
                                <span class="text-xs font-bold text-slate-500">
                                    {{ selectedFleetBus ? selectedFleetBus.total_seats : busForm.total_seats }} мест
                                </span>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-sm mx-auto shadow-inner">
                                <BusSeatSelector
                                    :bus-type="selectedFleetBus ? selectedFleetBus.bus_type : busForm.bus_type"
                                    :total-seats="Number(selectedFleetBus ? selectedFleetBus.total_seats : busForm.total_seats) || 53"
                                    :floor1-seats="Number(selectedFleetBus ? selectedFleetBus.floor1_seats : busForm.floor1_seats) || 20"
                                    :floor2-seats="Number(selectedFleetBus ? selectedFleetBus.floor2_seats : busForm.floor2_seats) || 56"
                                    :model-value="[]"
                                    :max-selectable="0"
                                />
                            </div>
                        </div>

                        <!-- Intermediate Stops -->
                        <div class="space-y-4 pt-4 border-t border-slate-50">
                            <div class="flex justify-between items-center">
                                <h3 class="text-sm font-bold text-slate-700">Промежуточные остановки</h3>
                                <button @click="addStop" class="text-xs font-bold text-amber-500 hover:text-amber-600 px-4 py-2 bg-amber-50 rounded-xl transition-all border border-amber-100">+ Добавить</button>
                            </div>
                            <div v-for="(stop, idx) in busForm.intermediate_stops" :key="idx" class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative shadow-inner">
                                <button @click="removeStop(idx)" class="absolute top-4 right-4 text-red-500 hover:text-red-600 p-2 bg-white rounded-xl shadow-sm border border-slate-100 transition-all">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                                <div class="space-y-2">
                                    <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Город</label>
                                    <select v-model="stop.city" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 shadow-sm">
                                        <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Время прибытия</label>
                                    <input v-model="stop.time" type="time" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 shadow-sm" />
                                </div>
                                <div class="md:col-span-2 space-y-2 pr-10">
                                    <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Адрес / Место</label>
                                    <input v-model="stop.address" placeholder="Напр. Центр города" class="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-900 shadow-sm outline-none focus:border-amber-500" />
                                </div>
                            </div>
                        </div>

                        <!-- Bus Photos -->
                        <div class="space-y-4 pt-4 border-t border-slate-50">
                            <h3 class="text-sm font-bold text-slate-700">Фотографии автобуса</h3>
                            <div class="flex flex-wrap gap-4">
                                <div v-for="(photo, idx) in busForm.photos" :key="idx" class="relative group w-24 h-24 rounded-2xl overflow-hidden border border-slate-200">
                                    <img :src="typeof photo === 'string' ? photo : photo.url" class="w-full h-full object-cover" />
                                    <button @click="removePhoto(idx)" class="absolute top-1 right-1 bg-white/80 backdrop-blur-sm text-red-500 p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                </div>
                                <label class="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-amber-500 hover:border-amber-500 hover:bg-amber-50 cursor-pointer transition-all" :class="{'opacity-50 pointer-events-none': photoLoading}">
                                    <svg v-if="!photoLoading" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                                    <span v-else class="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mb-1"></span>
                                    <span class="text-[9px] font-bold uppercase text-center">{{ photoLoading ? 'Загрузка...' : 'Добавить' }}</span>
                                    <input type="file" multiple accept="image/*" class="hidden" @change="handlePhotoUpload" :disabled="photoLoading" />
                                </label>
                            </div>
                        </div>

                        <!-- Section: Сопровождение рейса (Старший группы) -->
                        <div class="space-y-4 pt-4 border-t border-slate-50">
                            <div>
                                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <span>👤</span>
                                    <span>Сопровождение рейса (Старший группы)</span>
                                    <span class="text-[10px] text-slate-400 font-normal lowercase">(необязательно)</span>
                                </h3>
                                <p class="text-xs text-slate-400 mt-0.5">Данные ответственного лица будут автоматически отображаться в билетах пассажиров</p>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Старший группы / ответственный</label>
                                    <input
                                        v-model="busForm.group_leader_name"
                                        type="text"
                                        placeholder="Например: Хочи Абдурауф"
                                        class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs shadow-sm"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Телефон (Таджикистан)</label>
                                    <input
                                        v-model="busForm.group_leader_phone"
                                        type="text"
                                        placeholder="+992 XX XXX XX XX"
                                        class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs font-mono shadow-sm"
                                    />
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp (РФ / международный)</label>
                                    <input
                                        v-model="busForm.group_leader_whatsapp"
                                        type="text"
                                        placeholder="+7 XXX XXX XX XX"
                                        class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-amber-400 text-xs font-mono shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Terms Checkbox -->
                        <div class="pt-4 border-t border-slate-50 flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="accept_terms"
                                v-model="busForm.accept_terms"
                                class="mt-1 w-5 h-5 text-amber-500 rounded focus:ring-amber-500 border-gray-300"
                            />
                            <div class="flex-1">
                                <label for="accept_terms" class="text-sm text-slate-600">
                                    Создавая поездку вы соглашаетесь с
                                    <router-link to="/terms" class="text-blue-600 hover:text-blue-700 underline underline-offset-2">условиями использования и публичной офертой</router-link>.
                                </label>
                                <p v-if="busErrors.accept_terms" class="text-red-500 text-xs mt-1">{{ busErrors.accept_terms }}</p>
                            </div>
                        </div>

                        <!-- Submit Button -->
                         <div class="flex justify-end pt-4">
                             <button
                                @click="isEditingTicket ? updateBusTicket() : submitBusTicket()"
                                :disabled="loading"
                                class="px-12 py-4 rounded-2xl bg-amber-500 text-slate-900 font-bold text-lg shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                            >
                                <span v-if="loading" class="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span>
                                {{ loading ? (isEditingTicket ? 'Обновление...' : 'Создание...') : (isEditingTicket ? 'Обновить рейс' : 'Опубликовать рейс') }}
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </template>

        <!-- Share Trip Modal -->
        <div v-if="showShareModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div class="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative">
                <button @click="showShareModal = false" class="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div class="flex items-center space-x-3 mb-6">
                    <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-slate-900">Поделиться рейсом</h3>
                        <p class="text-xs text-slate-400">{{ selectedShareTicket ? `${selectedShareTicket.from_city} → ${selectedShareTicket.to_city}` : '' }}</p>
                    </div>
                </div>

                <div class="space-y-4 mb-6">
                    <!-- Web Link -->
                    <div class="space-y-1.5">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Web-ссылка (для браузера)</label>
                        <div class="flex gap-2">
                            <input
                                readonly
                                :value="getShareUrl(selectedShareTicket, 'web')"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 truncate font-mono focus:outline-none"
                            />
                            <button @click="copyShareLink('web')" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 shrink-0">
                                Скопировать
                            </button>
                        </div>
                    </div>

                    <!-- Telegram Link -->
                    <div class="space-y-1.5">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Telegram-ссылка (для бота)</label>
                        <div class="flex gap-2">
                            <input
                                readonly
                                :value="getShareUrl(selectedShareTicket, 'telegram')"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 truncate font-mono focus:outline-none"
                            />
                            <button @click="copyShareLink('telegram')" class="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-sky-500/20 shrink-0">
                                Скопировать
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Fast Social Sharing -->
                <div class="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                    <button @click="shareWhatsApp" class="w-full py-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                        <span>WhatsApp</span>
                    </button>
                    <button @click="shareTelegram" class="w-full py-3 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                        <span>Telegram</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Toast Feedback -->
        <div v-if="shareToast" class="fixed bottom-6 right-6 z-[110] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-slideUp">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span>{{ shareToastMessage }}</span>
        </div>
        <!-- Bus Schedule Conflict Modal -->
        <div v-if="showScheduleConflictModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
                <div class="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center text-3xl">
                    ⚠️
                </div>
                <div>
                    <h3 class="text-lg font-bold text-slate-900">Этот автобус уже назначен на другой рейс</h3>
                    <p class="text-xs text-slate-500 mt-1">
                        Обнаружено пересечение расписания в указанный интервал времени:
                    </p>
                    <div class="mt-3 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-left space-y-2 text-xs">
                        <div v-for="c in scheduleConflicts" :key="c.ticket_id" class="text-amber-900">
                            <div class="font-bold">{{ c.from_city }} → {{ c.to_city }}</div>
                            <div class="text-[11px] text-amber-800">
                                Отправление: {{ c.departure_date }} {{ c.departure_time ? c.departure_time.substring(0, 5) : '' }}
                                <span v-if="c.arrival_date"> | Прибытие: {{ c.arrival_date }} {{ c.arrival_time ? c.arrival_time.substring(0, 5) : '' }}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 pt-2">
                    <button @click="showScheduleConflictModal = false" class="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer">
                        Отмена
                    </button>
                    <button v-if="!isEditingTicket" @click="submitBusTicket(true)" class="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer">
                        Все равно создать
                    </button>
                    <button v-else @click="updateBusTicket(true)" class="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer">
                        Все равно сохранить
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
