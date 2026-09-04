<script>
import api from '../api';
import AppLogo from '../components/AppLogo.vue';
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
import * as XLSX from 'xlsx';
import { exportPassengerManifestExcel, sortPassengersBySeat } from '../utils/excelExport';

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
        LineChart: Line,
        PieChart: Pie,
        BarChart: Bar,
        AppLogo
    },
    data() {
        return {
            isAuthenticated: !!localStorage.getItem('adminToken'),
            passcode: '',
            activeTab: 'dashboard',
            stats: null,
            users: [],
            rides: [],
            busTickets: [],
            reviews: [],
            ridesCities: [],
            busCities: [],
            newRideCity: '',
            newBusCity: '',
            loading: false,
            isCreatingBus: false,
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
                total_seats: 44,
                bus_type: 'single',
                passenger_comments: '',
                intermediate_stops: []
            },
            busErrors: {},
            busDrivers: [],
            newBusDriver: {
                name: '',
                surname: '',
                phone: '',
                password: ''
            },
            editingFee: null, // { driverId, value }
            user: JSON.parse(localStorage.getItem('user') || 'null'),
            error: '',
            mobileMenuOpen: false,
            editingUser: null,
            // Drill-down: bus ticket bookings
            selectedBusTicket: null,
            selectedBusTicketBookings: [],
            ticketBookingsLoading: false,
            // Drill-down: bus driver rides
            selectedBusDriver: null,
            selectedBusDriverTickets: [],
            driverDetailLoading: false,
            editingRide: null,
            showUserEditModal: false,
            showRideEditModal: false,
            passengersLoading: false,
            passengersData: [],
            navItems: [
                { id: 'dashboard', label: 'Дашборд' },
                { id: 'passenger-funnel', label: 'Воронка пассажиров' },
                { id: 'users', label: 'Пользователи' },
                { id: 'bus-drivers', label: 'Водители автобусов' },
                { id: 'rides', label: 'Попутки' },
                { id: 'bus-tickets', label: 'Автобусы' },
                { id: 'reviews', label: 'Отзывы' },
                { id: 'passengers', label: 'Данные пассажиров' },
                { id: 'cities', label: 'Города' },
                { id: 'polls', label: 'Опросы' }
            ],
            // Phase P.1F: Passenger Activation Funnel State
            funnelLoading: false,
            funnelError: null,
            funnelSummary: null,
            funnelStages: [],
            funnelPassengers: [],
            funnelPagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
            funnelAttention: [],
            funnelChannels: [],
            funnelCarriers: [],
            funnelFilters: {
                period: '30days',
                startDate: '',
                endDate: '',
                carrier_id: '',
                bus_ticket_id: '',
                channel: '',
                status: 'ALL',
                attentionOnly: false,
                search: ''
            },
            funnelActiveSubTab: 'table', // 'table' | 'channels' | 'carriers'
            selectedTimelineBooking: null,
            timelineData: null,
            timelineHandoffs: [],
            timelineLoading: false,
            showTimelineModal: false,
            selectedClaimReview: null,
            reviewDecision: 'approved',
            reviewReason: '',
            reviewSubmitting: false,
            showReviewModal: false,
            reviewSuccessMessage: '',
            pollSettings: { question: '', option1: '', option2: '', option3: '' },
            pollAnswers: [],
            pollSettingsLoading: false,
            pollAnswersLoading: false,
            savingPollSettings: false,
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
    computed: {
        growthChartData() {
            if (!this.stats) return null;
            
            // Collect last 7 dates
            const labels = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                labels.push(date.toISOString().split('T')[0]);
            }

            const ridesMap = Object.fromEntries(this.stats.ridesLast7Days.map(r => [r.date, r.count]));
            const usersMap = Object.fromEntries(this.stats.usersLast7Days.map(u => [u.register_date, u.count]));

            return {
                labels,
                datasets: [
                    {
                        label: 'Поездки',
                        data: labels.map(l => ridesMap[l] || 0),
                        borderColor: '#f59e0b',
                        backgroundColor: '#f59e0b',
                        tension: 0.4
                    },
                    {
                        label: 'Регистрации',
                        data: labels.map(l => usersMap[l] || 0),
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f6',
                        tension: 0.4
                    }
                ]
            };
        },
        ageChartData() {
            if (!this.stats || !this.stats.ageDistribution) return null;
            return {
                labels: this.stats.ageDistribution.map(a => a.label),
                datasets: [{
                    label: 'Пользователи',
                    data: this.stats.ageDistribution.map(a => a.count),
                    backgroundColor: '#3b82f6',
                    borderRadius: 8
                }]
            };
        },
        carModelChartData() {
            if (!this.stats || !this.stats.carModelDistribution) return null;
            return {
                labels: this.stats.carModelDistribution.map(c => c.model),
                datasets: [{
                    data: this.stats.carModelDistribution.map(c => c.count),
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899', '#f43f5e', '#8b5cf6', '#06b6d4', '#475569', '#1e293b'],
                    borderWidth: 0
                }]
            };
        },
        bookingStatusChartData() {
            if (!this.stats || !this.stats.bookingStatusDistribution) return null;
            const dist = this.stats.bookingStatusDistribution;
            return {
                labels: ['Оплачено', 'Ручная', 'Ожидает оплаты'],
                datasets: [{
                    data: [dist.paid, dist.manual, dist.other],
                    backgroundColor: ['#10b981', '#3b82f6', '#f43f5e'],
                    borderWidth: 0
                }]
            };
        },
        busRidesChartData() {
            if (!this.stats || !this.stats.busTicketsLast7Days) return null;
            const labels = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                labels.push(date.toISOString().split('T')[0]);
            }
            const busMap = Object.fromEntries(this.stats.busTicketsLast7Days.map(b => [b.date, b.count]));
            return {
                labels,
                datasets: [{
                    label: 'Автобусные рейсы',
                    data: labels.map(l => busMap[l] || 0),
                    borderColor: '#6366f1',
                    backgroundColor: '#6366f1',
                    tension: 0.4
                }]
            };
        },
        ridesComparisonChartData() {
            if (!this.stats) return null;
            return {
                labels: ['Авто (Попутки)', 'Автобусы'],
                datasets: [{
                    data: [this.stats.totalRides || 0, this.stats.totalBusTickets || 0],
                    backgroundColor: ['#f59e0b', '#6366f1'],
                    borderWidth: 0
                }]
            };
        },
        bookingDynamicsChartData() {
            if (!this.stats || !this.stats.bookingDynamics) return null;
            return {
                labels: this.stats.bookingDynamics.map(d => d.date),
                datasets: [{
                    label: 'Бронирования автобусов',
                    data: this.stats.bookingDynamics.map(d => d.count),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            };
        },
        isFunnelEmpty() {
            if (this.funnelLoading || this.funnelError) return false;
            const count = this.funnelSummary ? (this.funnelSummary.manualBookingsCount || 0) : 0;
            const passCount = this.funnelPassengers ? this.funnelPassengers.length : 0;
            return count === 0 && passCount === 0;
        }
    },
    methods: {
        async checkPasscode() {
            if (!this.passcode) return;
            this.loading = true;
            try {
                const res = await api.post('/admin/login', { passcode: this.passcode });
                if (res.data.token) {
                    localStorage.setItem('adminToken', res.data.token);
                    this.isAuthenticated = true;
                    this.fetchDashboardData();
                }
            } catch (e) {
                if (e.response?.status === 401) {
                    alert('Неверный код доступа');
                } else if (!e.response) {
                    // This is likely a CORS or Network error
                    alert('Ошибка сети или доступа (CORS). Пожалуйста, свяжитесь с администратором.');
                    console.error('Network/CORS Error:', e);
                } else {
                    alert(e.response?.data?.error || 'Произошла ошибка при входе');
                }
            } finally {
                this.loading = false;
            }
        },
        logout() {
            localStorage.removeItem('adminToken');
            this.isAuthenticated = false;
        },
        async fetchDashboardData() {
            this.loading = true;
            try {
                const res = await api.get('/admin/stats');
                this.stats = res.data;
            } catch (e) {
                console.error(e);
            } finally {
                this.loading = false;
            }
        },
        async fetchUsers() {
            this.loading = true;
            try {
                const res = await api.get('/admin/users');
                this.users = res.data;
            } catch (e) { console.error(e); } finally { this.loading = false; }
        },
        async deleteUser(id) {
            if (confirm('Удалить пользователя?')) {
                await api.delete(`/admin/users/${id}`);
                this.fetchUsers();
            }
        },
        openEditUserModal(user) {
            this.editingUser = { ...user };
            this.showUserEditModal = true;
        },
        async updateUser() {
            try {
                await api.put(`/admin/users/${this.editingUser.id}`, this.editingUser);
                alert('Пользователь обновлен');
                this.showUserEditModal = false;
                this.fetchUsers();
                this.fetchBusDrivers();
            } catch (e) {
                alert('Ошибка при обновлении');
            }
        },
        async fetchBusDrivers() {
             this.loading = true;
             try {
                 const res = await api.get('/admin/bus-drivers');
                 this.busDrivers = res.data;
             } catch (e) { console.error(e); } finally { this.loading = false; }
        },
        startEditFee(driver) {
            this.editingFee = { driverId: driver.id, value: driver.service_fee_percent ?? 10 };
        },
        cancelEditFee() {
            this.editingFee = null;
        },
        async saveDriverFee(driver) {
            if (!this.editingFee) return;
            const fee = parseFloat(this.editingFee.value);
            if (isNaN(fee) || fee < 0 || fee > 100) {
                alert('Введите корректный процент (0–100)');
                return;
            }
            try {
                await api.put(`/admin/bus-drivers/${driver.id}/fee`, { service_fee_percent: fee });
                driver.service_fee_percent = fee;
                this.editingFee = null;
            } catch (e) {
                alert(e.response?.data?.error || 'Ошибка при сохранении');
            }
        },
        async createBusDriver() {
            if (!this.newBusDriver.phone || !this.newBusDriver.password) {
                alert('Номер телефона и пароль обязательны');
                return;
            }
            this.loading = true;
            try {
                await api.post('/admin/bus-drivers', this.newBusDriver);
                alert('Водитель автобуса успешно создан');
                this.newBusDriver = { name: '', surname: '', phone: '', password: '' };
                this.fetchBusDrivers();
            } catch (e) {
                alert(e.response?.data?.error || 'Ошибка при создании водителя');
            } finally {
                this.loading = false;
            }
        },
        async blockDriver(id) {
            if (confirm('Заблокировать водителя? Он не сможет создавать новые рейсы.')) {
                try {
                    await api.put(`/admin/bus-drivers/${id}/block`);
                    this.fetchBusDrivers();
                } catch (e) { alert('Ошибка при блокировке'); }
            }
        },
        async unblockDriver(id) {
            if (confirm('Разблокировать водителя?')) {
                try {
                    await api.put(`/admin/bus-drivers/${id}/unblock`);
                    this.fetchBusDrivers();
                } catch (e) { alert('Ошибка при разблокировке'); }
            }
        },
        async fetchRides() {
            this.loading = true;
            try {
                const res = await api.get('/admin/rides');
                this.rides = res.data;
            } catch (e) { console.error(e); } finally { this.loading = false; }
        },
        async deleteRide(id) {
            if (confirm('Удалить поездку?')) {
                await api.delete(`/admin/rides/${id}`);
                this.fetchRides();
            }
        },
        openEditRideModal(ride) {
            this.editingRide = { ...ride };
            this.showRideEditModal = true;
        },
        async updateRide() {
            try {
                const data = { ...this.editingRide };
                delete data.driver_name; // Computed field
                await api.put(`/admin/rides/${this.editingRide.id}`, data);
                alert('Поездка обновлена');
                this.showRideEditModal = false;
                this.fetchRides();
            } catch (e) {
                alert('Ошибка при обновлении');
            }
        },
        async fetchBusTickets() {
            this.loading = true;
            try {
                const res = await api.get('/admin/bus-tickets');
                this.busTickets = res.data;
            } catch (e) { console.error(e); } finally { this.loading = false; }
        },
        async deleteBusTicket(id) {
            if (confirm('Удалить этот рейс?')) {
                await api.delete(`/admin/bus-tickets/${id}`);
                this.fetchBusTickets();
            }
        },
        async fetchReviews() {
            this.loading = true;
            try {
                const res = await api.get('/admin/reviews');
                this.reviews = res.data;
            } catch (e) {
                console.error(e);
            } finally {
                this.loading = false;
            }
        },
        async deleteReview(id) {
            if (confirm('Удалить этот отзыв?')) {
                await api.delete(`/admin/reviews/${id}`);
                this.fetchReviews();
            }
        },
        async fetchCities() {
            this.loading = true;
            try {
                const [ridesRes, busesRes] = await Promise.all([
                    api.get('/admin/cities', { params: { type: 'ride' } }),
                    api.get('/admin/cities', { params: { type: 'bus' } })
                ]);
                this.ridesCities = ridesRes.data;
                this.busCities = busesRes.data;
            } catch (e) { console.error(e); } finally { this.loading = false; }
        },
        async addCity(type) {
            const name = type === 'ride' ? this.newRideCity : this.newBusCity;
            if (!name) return;
            try {
                await api.post('/admin/cities', { name, type });
                if (type === 'ride') this.newRideCity = ''; else this.newBusCity = '';
                this.fetchCities();
            } catch (e) { 
                alert(e.response?.data?.error || 'Ошибка при добавлении города'); 
            }
        },
        async deleteCity(id) {
            if (confirm('Удалить город?')) {
                await api.delete(`/admin/cities/${id}`);
                this.fetchCities();
            }
        },

        // Bus Ticket Creation Methods
        addStop() {
            this.busForm.intermediate_stops.push({ city: '', time: '', address: '' });
        },
        removeStop(index) {
            this.busForm.intermediate_stops.splice(index, 1);
        },
        validateBusForm() {
            const e = {};
            if (!this.busForm.transport_company.trim()) e.transport_company = 'Укажите компанию';
            if (!this.busForm.from_city) e.from_city = 'Укажите город отправления';
            if (!this.busForm.from_address.trim()) e.from_address = 'Укажите место отправления';
            if (!this.busForm.to_city) e.to_city = 'Укажите город прибытия';
            if (!this.busForm.to_address.trim()) e.to_address = 'Укажите место прибытия';
            if (!this.busForm.departure_date) e.departure_date = 'Укажите дату отправления';
            if (!this.busForm.departure_time) e.departure_time = 'Укажите время отправления';
            if (!this.busForm.arrival_date) e.arrival_date = 'Укажите дату прибытия';
            if (!this.busForm.arrival_time) e.arrival_time = 'Укажите время прибытия';
            if (!this.busForm.duration_minutes || this.busForm.duration_minutes <= 0) e.duration_minutes = 'Укажите длительность';
            if (!this.busForm.price || this.busForm.price <= 0) e.price = 'Укажите цену';
            if (!this.busForm.total_seats || this.busForm.total_seats < 1) e.total_seats = 'Укажите количество мест';
            this.busErrors = e;
            return Object.keys(e).length === 0;
        },
        async submitBusTicket() {
            if (!this.validateBusForm()) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }
            this.loading = true;
            try {
                await api.post('/bus-tickets', {
                    ...this.busForm,
                    operator_id: this.user?.id || 1,
                    duration_minutes: Number(this.busForm.duration_hours) * 60,
                    price: Number(this.busForm.price),
                    total_seats: Number(this.busForm.total_seats)
                });
                alert('Рейс успешно создан!');
                this.isCreatingBus = false;
                this.fetchBusTickets();
                this.busForm = {
                    transport_company: '', from_city: '', from_address: '',
                    to_city: '', to_address: '', departure_date: '',
                    departure_time: '', arrival_date: '', arrival_time: '',
                    duration_hours: '', price: '', total_seats: 44,
                    bus_type: 'single', passenger_comments: '',
                    intermediate_stops: []
                };
            } catch (e) {
                alert(e.response?.data?.error || 'Ошибка при создании');
            } finally {
                this.loading = false;
            }
        },

        // ─── Passengers Data Tab ──────────────────────────────────────
        async fetchPassengersData() {
            this.passengersLoading = true;
            try {
                const res = await api.get('/admin/passengers-data');
                this.passengersData = res.data;
            } catch (e) {
                alert('Ошибка загрузки данных пассажиров: ' + (e.response?.data?.error || e.message));
            } finally {
                this.passengersLoading = false;
            }
        },
        exportPassengersExcel() {
            const data = this.passengersData.map(p => ({
                'ID брони': p.booking_id,
                'ID рейса': p.bus_ticket_id,
                'Фамилия': p.lastName,
                'Имя': p.firstName,
                'Отчество': p.middleName,
                'Пол': p.gender === 'male' ? 'Муж' : (p.gender === 'female' ? 'Жен' : p.gender),
                'Дата рождения': p.birthDate,
                'Тип документа': p.docType,
                'Номер документа': p.docNumber,
                'Гражданство': p.citizenship,
                'Телефон': p.phone,
                'Место': p.seatNumbers,
                'Посадка': p.pickup_city,
                'Высадка': p.drop_off_city,
                'Откуда': p.from_city,
                'Куда': p.to_city,
                'Дата рейса': p.departure_date,
                'Время рейса': p.departure_time,
                'Перевозчик': p.transport_company,
                'Сумма': p.total_price,
                'Статус оплаты': p.paymentStatus,
                'Статус брони': p.bookingStatus,
                'Дата брони': p.created_at
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Пассажиры');
            XLSX.writeFile(wb, 'Все_пассажиры.xlsx');
        },

        async fetchPollData() {
            this.fetchPollSettings();
            this.fetchPollAnswers();
        },
        async fetchPollSettings() {
            this.pollSettingsLoading = true;
            try {
                const res = await api.get('/admin/polls/settings');
                this.pollSettings = res.data;
            } catch (e) {
                alert('Ошибка загрузки настроек опроса: ' + (e.response?.data?.error || e.message));
            } finally {
                this.pollSettingsLoading = false;
            }
        },
        async fetchPollAnswers() {
            this.pollAnswersLoading = true;
            try {
                const res = await api.get('/admin/polls/answers');
                this.pollAnswers = res.data;
            } catch (e) {
                alert('Ошибка загрузки ответов: ' + (e.response?.data?.error || e.message));
            } finally {
                this.pollAnswersLoading = false;
            }
        },
        async savePollSettings() {
            this.savingPollSettings = true;
            try {
                const res = await api.put('/admin/polls/settings', this.pollSettings);
                this.pollSettings = res.data;
                alert('Настройки опроса успешно сохранены!');
            } catch (e) {
                alert('Ошибка сохранения настроек опроса: ' + (e.response?.data?.error || e.message));
            } finally {
                this.savingPollSettings = false;
            }
        },

        // ─── Drill-down: Bus Ticket Bookings ───────────────────────────
        async openBusTicketBookings(ticket) {
            this.selectedBusTicket = ticket;
            this.selectedBusTicketBookings = [];
            this.ticketBookingsLoading = true;
            try {
                const res = await api.get(`/admin/bus-tickets/${ticket.id}/bookings`);
                this.selectedBusTicketBookings = res.data;
            } catch (e) {
                alert('Ошибка загрузки бронирований: ' + (e.response?.data?.error || e.message));
            } finally {
                this.ticketBookingsLoading = false;
            }
        },
        closeBusTicketBookings() {
            this.selectedBusTicket = null;
            this.selectedBusTicketBookings = [];
        },
        async deleteAdminBooking(bookingId) {
            if (!confirm('Полностью удалить это бронирование? Места будут освобождены.')) return;
            try {
                await api.delete(`/bus-admin/bookings/${bookingId}`);
                this.selectedBusTicketBookings = this.selectedBusTicketBookings.filter(b => b.id !== bookingId);
            } catch (e) {
                alert('Ошибка при удалении: ' + (e.response?.data?.error || e.message));
            }
        },
        passengerManifestForBookings(bookings) {
            const manifest = [];
            (bookings || []).forEach(b => {
                const pData = b.passengers_data || [];
                if (pData.length === 0) {
                    manifest.push({
                        lastName: b.passenger_name || '—', firstName: '', middleName: '',
                        seat: (b.seat_numbers || []).join(', '),
                        gender: '—', birthDate: '—', docType: '—', docNumber: '—', citizenship: '—',
                        contactPhone: b.passenger_phone || b.phone,
                        pickup_city: b.pickup_city, drop_off_city: b.drop_off_city,
                        paymentStatus: b.status === 'pending_payment' ? 'Ожидает оплаты' : (b.total_price === 0 ? 'Ручная' : 'Оплачено'),
                        originalBookingId: b.id,
                        createdAt: b.created_at
                    });
                } else {
                    pData.forEach((p, idx) => {
                        const assignedSeat = (b.seat_numbers && b.seat_numbers[idx] !== undefined && b.seat_numbers[idx] !== null)
                            ? b.seat_numbers[idx]
                            : (p.seatNumber || p.seat || '—');
                        manifest.push({
                            ...p,
                            seat: assignedSeat,
                            contactPhone: p.phone || b.passenger_phone || b.phone,
                            pickup_city: b.pickup_city, drop_off_city: b.drop_off_city,
                            paymentStatus: b.status === 'pending_payment' ? 'Ожидает оплаты' : (b.total_price === 0 ? 'Ручная' : 'Оплачено'),
                            originalBookingId: b.id,
                            createdAt: b.created_at
                        });
                    });
                }
            });
            return sortPassengersBySeat(manifest);
        },
        async exportSelectedTicketManifestExcel() {
            if (!this.selectedBusTicket || !this.selectedBusTicketBookings.length) return;
            const manifest = this.passengerManifestForBookings(this.selectedBusTicketBookings);
            await exportPassengerManifestExcel(this.selectedBusTicket, manifest, this.user);
        },

        // ─── Drill-down: Bus Driver Rides ──────────────────────────────
        async openBusDriverDetail(driver) {
            this.selectedBusDriver = driver;
            this.selectedBusDriverTickets = [];
            this.driverDetailLoading = true;
            try {
                const res = await api.get(`/admin/bus-drivers/${driver.id}/tickets`);
                this.selectedBusDriverTickets = res.data;
            } catch (e) {
                alert('Ошибка загрузки рейсов: ' + (e.response?.data?.error || e.message));
            } finally {
                this.driverDetailLoading = false;
            }
        },
        closeBusDriverDetail() {
            this.selectedBusDriver = null;
            this.selectedBusDriverTickets = [];
        },

        // ─── Passenger Activation Funnel Methods (Phase P.1F) ────────
        async fetchFunnelData() {
            this.funnelLoading = true;
            this.funnelError = null;
            try {
                const results = await Promise.allSettled([
                    this.fetchFunnelSummary(),
                    this.fetchFunnelStages(),
                    this.fetchFunnelPassengers(1),
                    this.fetchFunnelAttention(),
                    this.fetchFunnelChannels(),
                    this.fetchFunnelCarriers()
                ]);
                const rejected = results.filter(r => r.status === 'rejected');
                if (rejected.length === results.length) {
                    this.funnelError = 'Не удалось загрузить данные воронки. Пожалуйста, проверьте подключение и повторите попытку.';
                }
            } catch (err) {
                console.error('[Funnel] Error loading funnel data:', err);
                this.funnelError = 'Произошла ошибка при загрузке данных воронки. Попробуйте обновить данные.';
            } finally {
                this.funnelLoading = false;
            }
        },
        buildFunnelQueryParams(extra = {}) {
            const f = this.funnelFilters;
            const params = new URLSearchParams();
            if (f.period) params.append('period', f.period);
            if (f.startDate) params.append('startDate', f.startDate);
            if (f.endDate) params.append('endDate', f.endDate);
            if (f.carrier_id) params.append('carrier_id', f.carrier_id);
            if (f.bus_ticket_id) params.append('bus_ticket_id', f.bus_ticket_id);
            if (f.channel) params.append('channel', f.channel);
            if (f.status && f.status !== 'ALL') params.append('status', f.status);
            if (f.attentionOnly) params.append('attentionOnly', 'true');
            if (f.search) params.append('search', f.search);

            Object.entries(extra).forEach(([k, v]) => {
                if (v !== undefined && v !== null) params.append(k, v);
            });
            return params.toString();
        },
        async fetchFunnelSummary() {
            try {
                const qs = this.buildFunnelQueryParams();
                const res = await api.get(`/admin/passenger-funnel/summary?${qs}`);
                if (res.data?.success && res.data.summary) {
                    this.funnelSummary = res.data.summary;
                } else {
                    this.funnelSummary = null;
                }
            } catch (err) {
                console.error('Failed to fetch funnel summary:', err?.message || err);
                this.funnelSummary = null;
                throw err;
            }
        },
        async fetchFunnelStages() {
            try {
                const qs = this.buildFunnelQueryParams();
                const res = await api.get(`/admin/passenger-funnel/stages?${qs}`);
                if (res.data?.success) {
                    this.funnelStages = Array.isArray(res.data.stages) ? res.data.stages : [];
                } else {
                    this.funnelStages = [];
                }
            } catch (err) {
                console.error('Failed to fetch funnel stages:', err?.message || err);
                this.funnelStages = [];
                throw err;
            }
        },
        async fetchFunnelPassengers(page = 1) {
            try {
                const qs = this.buildFunnelQueryParams({ page, limit: this.funnelPagination.limit });
                const res = await api.get(`/admin/passenger-funnel/passengers?${qs}`);
                if (res.data?.success) {
                    const raw = Array.isArray(res.data.passengers) ? res.data.passengers : [];
                    this.funnelPassengers = raw.map(p => this.normalizePassenger(p));
                    this.funnelPagination = res.data.pagination || { page: 1, limit: 20, total: this.funnelPassengers.length, totalPages: 1 };
                } else {
                    this.funnelPassengers = [];
                }
            } catch (err) {
                console.error('Failed to fetch funnel passengers:', err?.message || err);
                this.funnelPassengers = [];
                throw err;
            }
        },
        async fetchFunnelAttention() {
            try {
                const res = await api.get('/admin/passenger-funnel/attention');
                if (res.data?.success) {
                    const raw = Array.isArray(res.data.items) ? res.data.items : [];
                    this.funnelAttention = raw.map(item => this.normalizeAttentionItem(item));
                } else {
                    this.funnelAttention = [];
                }
            } catch (err) {
                console.error('Failed to fetch funnel attention queue:', err?.message || err);
                this.funnelAttention = [];
                throw err;
            }
        },
        async fetchFunnelChannels() {
            try {
                const qs = this.buildFunnelQueryParams();
                const res = await api.get(`/admin/passenger-funnel/channels?${qs}`);
                if (res.data?.success) {
                    const raw = Array.isArray(res.data.channels) ? res.data.channels : [];
                    this.funnelChannels = raw.map(ch => this.normalizeChannel(ch));
                } else {
                    this.funnelChannels = [];
                }
            } catch (err) {
                console.error('Failed to fetch funnel channels:', err?.message || err);
                this.funnelChannels = [];
                throw err;
            }
        },
        async fetchFunnelCarriers() {
            try {
                const qs = this.buildFunnelQueryParams();
                const res = await api.get(`/admin/passenger-funnel/carriers?${qs}`);
                if (res.data?.success) {
                    const raw = Array.isArray(res.data.carriers) ? res.data.carriers : [];
                    this.funnelCarriers = raw.map(c => this.normalizeCarrier(c));
                } else {
                    this.funnelCarriers = [];
                }
            } catch (err) {
                console.error('Failed to fetch funnel carriers:', err?.message || err);
                this.funnelCarriers = [];
                throw err;
            }
        },
        normalizePassenger(p) {
            if (!p) return {};
            const id = p.bookingId !== undefined ? p.bookingId : (p.booking_id !== undefined ? p.booking_id : '');
            const channel = p.channel || p.last_channel || '—';
            return {
                ...p,
                booking_id: id,
                bookingId: id,
                passenger_name: p.passengerName || p.passenger_name || 'Пассажир',
                passengerName: p.passengerName || p.passenger_name || 'Пассажир',
                masked_phone: p.maskedPhone || p.masked_phone || '—',
                maskedPhone: p.maskedPhone || p.masked_phone || '—',
                carrier_name: p.carrierName || p.carrier_name || '—',
                carrierName: p.carrierName || p.carrier_name || '—',
                route: p.route || '—',
                departure_date: p.departureDate || p.departure_date || '—',
                departureDate: p.departureDate || p.departure_date || '—',
                seat_number: p.seats || p.seat_number || '—',
                seats: p.seats || p.seat_number || '—',
                created_at: p.createdAt || p.created_at || '',
                createdAt: p.createdAt || p.created_at || '',
                status: p.status || 'UNKNOWN',
                last_channel: channel,
                channel: channel,
                time_in_stage: p.timeInStage || p.time_in_stage || '—',
                timeInStage: p.timeInStage || p.time_in_stage || '—',
                next_recommended_action: p.nextAction || p.next_recommended_action || '—',
                nextAction: p.nextAction || p.next_recommended_action || '—',
                claim_request_id: p.claimRequestId || p.claim_request_id || null,
                claimRequestId: p.claimRequestId || p.claim_request_id || null
            };
        },
        normalizeAttentionItem(item) {
            if (!item) return {};
            const id = item.bookingId !== undefined ? item.bookingId : (item.booking_id !== undefined ? item.booking_id : '');
            return {
                ...item,
                booking_id: id,
                bookingId: id,
                passenger_name: item.passengerName || item.passenger_name || 'Пассажир',
                passengerName: item.passengerName || item.passenger_name || 'Пассажир',
                masked_phone: item.maskedPhone || item.masked_phone || '—',
                maskedPhone: item.maskedPhone || item.masked_phone || '—',
                carrier_name: item.carrierName || item.carrier_name || '—',
                carrierName: item.carrierName || item.carrier_name || '—',
                route: item.route || '—',
                status: item.status || item.issueType || 'UNDER_REVIEW',
                issue_description: item.issueDescription || item.issue_description || item.issueTitle || item.recommendedAction || 'Требуется внимание',
                claim_request_id: item.claimRequestId || item.claim_request_id || null,
                claimRequestId: item.claimRequestId || item.claim_request_id || null
            };
        },
        normalizeChannel(ch) {
            if (!ch) return {};
            return {
                ...ch,
                channel_name: ch.channelName || ch.channel_name || this.formatChannelName(ch.channel),
                total_handoffs: ch.handoffsCount !== undefined ? ch.handoffsCount : (ch.total_handoffs || 0),
                unique_bookings: ch.uniqueBookings !== undefined ? ch.uniqueBookings : (ch.unique_bookings || 0),
                link_opened_count: ch.opensCount !== undefined ? ch.opensCount : (ch.link_opened_count || 0),
                telegram_cta_count: ch.ctaCount !== undefined ? ch.ctaCount : (ch.telegram_cta_count || 0),
                bot_started_count: ch.botStartsCount !== undefined ? ch.botStartsCount : (ch.bot_started_count || 0),
                phone_shared_count: ch.phoneSharedCount !== undefined ? ch.phoneSharedCount : (ch.phone_shared_count || 0),
                activated_count: ch.activatedCount !== undefined ? ch.activatedCount : (ch.activated_count || 0),
                conversion_rate: ch.conversionRate !== undefined ? ch.conversionRate : (ch.conversion_rate || 0),
                median_activation_time: ch.medianActivationDisplay || ch.median_activation_time || '—'
            };
        },
        normalizeCarrier(c) {
            if (!c) return {};
            return {
                ...c,
                carrier_name: c.carrierName || c.carrier_name || 'Перевозчик',
                manual_bookings_count: c.manualBookings !== undefined ? c.manualBookings : (c.manual_bookings_count || 0),
                handoffs_count: c.handoffsCount !== undefined ? c.handoffsCount : (c.handoffs_count || 0),
                links_opened_count: c.opensCount !== undefined ? c.opensCount : (c.links_opened_count || 0),
                activated_count: c.activatedCount !== undefined ? c.activatedCount : (c.activated_count || 0),
                activation_rate: c.activationRate !== undefined ? c.activationRate : (c.activation_rate || 0),
                avg_time_to_handoff: c.avgTimeToHandoffDisplay || c.avg_time_to_handoff || '—',
                avg_time_to_activation: c.avgTimeToActivateDisplay || c.avg_time_to_activation || '—'
            };
        },
        formatShortBookingId(id) {
            if (id === null || id === undefined || id === '') return '—';
            return String(id).slice(0, 8);
        },
        formatFunnelConversion(val) {
            if (val === null || val === undefined || isNaN(val)) return '—';
            return val + '%';
        },
        formatFunnelDate(dateStr) {
            if (!dateStr) return '—';
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return '—';
                return d.toLocaleDateString('ru-RU');
            } catch (e) {
                return '—';
            }
        },
        formatChannelName(channel) {
            const map = {
                'whatsapp': 'WhatsApp',
                'sms': 'SMS',
                'telegram': 'Telegram Share',
                'copy_link': 'Копирование ссылки'
            };
            return map[channel] || (channel ? 'Другое (' + channel + ')' : 'Другое');
        },
        setPeriod(p) {
            this.setFunnelPeriod(p);
        },
        resetFilters() {
            this.resetFunnelFilters();
        },
        toggleAttentionFilter() {
            this.setFunnelQuickFilter('attention');
        },
        setQuickStatus(status) {
            if (status === 'PHONE_MISMATCH') this.setFunnelQuickFilter('mismatch');
            else if (status === 'BOT_ABANDONED') this.setFunnelQuickFilter('bot_abandoned');
            else if (status === 'LINK_OPENED') this.setFunnelQuickFilter('opened_no_bot');
            else if (status === 'ACTIVATED') this.setFunnelQuickFilter('activated');
            else {
                this.funnelFilters.status = this.funnelFilters.status === status ? 'ALL' : status;
                this.applyFunnelFilter();
            }
        },
        changeFunnelPage(page) {
            if (page < 1 || (this.funnelPagination && page > this.funnelPagination.totalPages)) return;
            this.fetchFunnelPassengers(page);
        },
        applyFunnelFilter() {
            this.fetchFunnelData();
        },
        setFunnelPeriod(p) {
            this.funnelFilters.period = p;
            this.applyFunnelFilter();
        },
        setFunnelQuickFilter(key) {
            if (key === 'attention') {
                this.funnelFilters.attentionOnly = !this.funnelFilters.attentionOnly;
                this.funnelFilters.status = 'ALL';
            } else if (key === 'mismatch') {
                this.funnelFilters.status = this.funnelFilters.status === 'PHONE_MISMATCH' ? 'ALL' : 'PHONE_MISMATCH';
                this.funnelFilters.attentionOnly = false;
            } else if (key === 'bot_abandoned') {
                this.funnelFilters.status = this.funnelFilters.status === 'BOT_STARTED' ? 'ALL' : 'BOT_STARTED';
                this.funnelFilters.attentionOnly = false;
            } else if (key === 'opened_no_bot') {
                this.funnelFilters.status = this.funnelFilters.status === 'LINK_OPENED' ? 'ALL' : 'LINK_OPENED';
                this.funnelFilters.attentionOnly = false;
            } else if (key === 'activated') {
                this.funnelFilters.status = this.funnelFilters.status === 'ACTIVATED' ? 'ALL' : 'ACTIVATED';
                this.funnelFilters.attentionOnly = false;
            }
            this.applyFunnelFilter();
        },
        resetFunnelFilters() {
            this.funnelFilters = {
                period: '30days',
                startDate: '',
                endDate: '',
                carrier_id: '',
                bus_ticket_id: '',
                channel: '',
                status: 'ALL',
                attentionOnly: false,
                search: ''
            };
            this.applyFunnelFilter();
        },
        async openPassengerTimeline(bookingId) {
            this.selectedTimelineBooking = bookingId;
            this.timelineData = null;
            this.timelineHandoffs = [];
            this.timelineLoading = true;
            this.showTimelineModal = true;
            try {
                const res = await api.get(`/admin/passenger-funnel/bookings/${bookingId}/timeline`);
                if (res.data?.success) {
                    this.timelineData = res.data;
                    this.timelineHandoffs = res.data.handoffs || [];
                }
            } catch (err) {
                alert('Ошибка загрузки таймлайна: ' + (err.response?.data?.message || err.message));
            } finally {
                this.timelineLoading = false;
            }
        },
        closePassengerTimeline() {
            this.showTimelineModal = false;
            this.selectedTimelineBooking = null;
            this.timelineData = null;
        },
        openReviewModal(item) {
            this.selectedClaimReview = item;
            this.reviewDecision = 'approved';
            this.reviewReason = '';
            this.reviewSuccessMessage = '';
            this.showReviewModal = true;
        },
        closeReviewModal() {
            this.showReviewModal = false;
            this.selectedClaimReview = null;
        },
        async submitClaimReview() {
            if (!this.selectedClaimReview?.claimRequestId) return;
            this.reviewSubmitting = true;
            this.reviewSuccessMessage = '';
            try {
                const reqId = this.selectedClaimReview.claimRequestId;
                const res = await api.post(`/admin/passenger-funnel/claim-requests/${reqId}/review`, {
                    decision: this.reviewDecision,
                    reason: this.reviewReason || null
                });
                if (res.data?.success) {
                    this.reviewSuccessMessage = this.reviewDecision === 'approved' 
                        ? 'Бронь успешно подтверждена и привязана к пассажиру!' 
                        : 'Заявка отклонена.';
                    setTimeout(() => {
                        this.closeReviewModal();
                        this.fetchFunnelData();
                    }, 1200);
                }
            } catch (err) {
                alert('Ошибка проверки заявки: ' + (err.response?.data?.message || err.message));
            } finally {
                this.reviewSubmitting = false;
            }
        },
        getFunnelStatusBadgeClass(status) {
            const map = {
                'ACTIVATED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
                'LINK_OPENED': 'bg-sky-100 text-sky-800 border-sky-200',
                'TELEGRAM_CTA_CLICKED': 'bg-indigo-100 text-indigo-800 border-indigo-200',
                'BOT_STARTED': 'bg-purple-100 text-purple-800 border-purple-200',
                'PHONE_PENDING': 'bg-violet-100 text-violet-800 border-violet-200',
                'SHARE_INITIATED': 'bg-blue-100 text-blue-800 border-blue-200',
                'NOT_SHARED': 'bg-slate-100 text-slate-700 border-slate-200',
                'PHONE_MISMATCH': 'bg-rose-100 text-rose-800 border-rose-200',
                'UNDER_REVIEW': 'bg-amber-100 text-amber-800 border-amber-200',
                'BOT_ABANDONED': 'bg-orange-100 text-orange-800 border-orange-200',
                'EXPIRED': 'bg-stone-100 text-stone-700 border-stone-200',
                'LEGACY': 'bg-gray-100 text-gray-500 border-gray-200'
            };
            return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
        },
        getFunnelStatusLabel(status) {
            const map = {
                'ACTIVATED': 'Активирован ✓',
                'LINK_OPENED': 'Ссылка открыта',
                'TELEGRAM_CTA_CLICKED': 'Telegram CTA',
                'BOT_STARTED': 'Бот запущен',
                'PHONE_PENDING': 'Ожидает номер',
                'SHARE_INITIATED': 'Передача инициирована',
                'NOT_SHARED': 'Не передан',
                'PHONE_MISMATCH': 'Номер не совпал ⚠️',
                'UNDER_REVIEW': 'На проверке ⚠️',
                'BOT_ABANDONED': 'Бот оставлен (>2ч)',
                'EXPIRED': 'Истек срок ссылки',
                'LEGACY': 'Legacy (до P.1)'
            };
            return map[status] || status;
        },
        getEventTitle(type) {
            const map = {
                'BOOKING_CREATED': 'Ручная бронь создана',
                'SHARE_INITIATED': 'Передача билета инициирована',
                'LINK_OPENED': 'Ссылка на билет открыта',
                'TELEGRAM_CTA_CLICKED': 'Нажата кнопка Telegram CTA',
                'TELEGRAM_BOT_STARTED': 'Бот @Poputkionline_bot запущен',
                'PHONE_SHARE_REQUESTED': 'Запрос номера телефона в боте',
                'PHONE_SHARED': 'Номер телефона передан кнопкой',
                'PHONE_VERIFIED': 'Номер подтверждён',
                'PHONE_MISMATCH': 'Номер не совпал с бронью',
                'CLAIM_REQUEST_CREATED': 'Создан запрос подтверждения',
                'CLAIM_COMPLETED': 'Бронь подтверждена',
                'BOOKING_LINKED_TO_USER': 'Бронь привязана к аккаунту',
                'ACTIVATION_COMPLETED': 'Активация пассажира завершена'
            };
            return map[type] || type;
        },
        getEventIcon(type) {
            const map = {
                'BOOKING_CREATED': '🎫',
                'SHARE_INITIATED': '📤',
                'LINK_OPENED': '👀',
                'TELEGRAM_CTA_CLICKED': '✈️',
                'TELEGRAM_BOT_STARTED': '🤖',
                'PHONE_SHARE_REQUESTED': '📱',
                'PHONE_SHARED': '📲',
                'PHONE_VERIFIED': '✅',
                'PHONE_MISMATCH': '⚠️',
                'CLAIM_REQUEST_CREATED': '📝',
                'CLAIM_COMPLETED': '🎉',
                'BOOKING_LINKED_TO_USER': '🔗',
                'ACTIVATION_COMPLETED': '🌟'
            };
            return map[type] || '📌';
        },
        formatTimelineDate(dateStr) {
            if (!dateStr) return '—';
            try {
                const d = new Date(dateStr);
                return d.toLocaleString('ru-RU', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
            } catch (e) {
                return dateStr;
            }
        }
    },
    watch: {
        activeTab(newTab) {
            this.isCreatingBus = false;
            if (newTab === 'dashboard') this.fetchDashboardData();
            if (newTab === 'passenger-funnel') this.fetchFunnelData();
            if (newTab === 'users') this.fetchUsers();
            if (newTab === 'bus-drivers') this.fetchBusDrivers();
            if (newTab === 'rides') this.fetchRides();
            if (newTab === 'bus-tickets') {
                this.fetchBusTickets();
                this.fetchCities();
            }
            if (newTab === 'reviews') this.fetchReviews();
            if (newTab === 'passengers') this.fetchPassengersData();
            if (newTab === 'cities') this.fetchCities();
            if (newTab === 'polls') this.fetchPollData();
        }
    },
    mounted() {
        if (this.$route.name === 'admin-passenger-funnel' || this.$route.path === '/admin/passenger-funnel' || this.$route.query.tab === 'passenger-funnel') {
            this.activeTab = 'passenger-funnel';
        }
        if (this.isAuthenticated) {
            if (this.activeTab === 'passenger-funnel') {
                this.fetchFunnelData();
            } else if (this.activeTab === 'dashboard') {
                this.fetchDashboardData();
            }
        }
    }
}
</script>

<template>
    <div class="admin-panel h-screen bg-white text-slate-900 flex overflow-hidden font-sans">
        <!-- Mobile Header -->
        <div class="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-slate-100 p-4 flex justify-between items-center shadow-sm">
            <div class="flex items-center space-x-3">
                <AppLogo 
                    :showText="false" 
                    iconSizeClass="w-8 h-8"
                    iconClass="h-5 w-5"
                    iconBgClass="bg-amber-500 text-white"
                />
                <span class="text-lg font-bold tracking-tight text-slate-900">Admin</span>
            </div>
            <button @click="mobileMenuOpen = !mobileMenuOpen" class="text-slate-500 p-2">
                <svg v-if="!mobileMenuOpen" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <!-- Auth Overlay -->
        <div v-if="!isAuthenticated" class="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center p-4 sm:p-6">
            <div class="max-w-md w-full bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl text-center">
                <div class="w-20 h-20 bg-amber-50 rounded-[28px] flex items-center justify-center mx-auto mb-8 border border-amber-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h1 class="text-3xl font-black mb-2 text-slate-900">Admin Panel</h1>
                <p class="text-slate-400 mb-8 font-medium">Введите код доступа для работы с системой</p>
                <input 
                    v-model="passcode" 
                    type="password" 
                    placeholder="••••••"
                    class="w-full bg-slate-50 border border-slate-100 rounded-3xl p-5 text-center text-3xl tracking-[0.5em] focus:border-amber-500 outline-none transition-all mb-8 shadow-inner text-slate-900"
                    @keyup.enter="checkPasscode"
                />
                <button 
                    @click="checkPasscode"
                    class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-5 rounded-[24px] transition-all shadow-lg shadow-amber-500/20 text-lg"
                >
                    Войти в систему
                </button>
            </div>
        </div>

        <!-- Sidebar -->
        <aside 
            class="lg:w-72 bg-slate-50 border-r border-slate-100 flex flex-col pt-10 fixed lg:relative inset-y-0 left-0 z-30 transition-transform transform lg:translate-x-0 w-64"
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
                    <span class="text-xl font-black tracking-tight text-slate-900">Poputki Admin</span>
                </div>
            </div>

            <nav class="flex-1 px-4 space-y-1.5 overflow-y-auto">
                <button 
                    v-for="item in navItems" 
                    :key="item.id"
                    @click="activeTab = item.id; mobileMenuOpen = false"
                    class="w-full px-5 py-4 rounded-2xl flex items-center space-x-3 transition-all group font-bold"
                    :class="activeTab === item.id ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-white hover:text-slate-900'"
                >
                    <span class="capitalize">{{ item.label }}</span>
                </button>
            </nav>

            <div class="p-8 border-t border-slate-100">
                <button @click="logout" class="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors uppercase tracking-widest">Выйти из сессии</button>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto bg-white p-4 sm:p-6 lg:p-10 pt-20 lg:pt-10 w-full overflow-x-hidden">
            
            <!-- Dashboard Section -->
            <section v-if="activeTab === 'dashboard'" class="space-y-6 lg:space-y-10">
                <div class="flex justify-between items-end">
                    <div>
                        <h2 class="text-4xl font-bold">Дашборд</h2>
                        <p class="text-slate-500 mt-2">Обзор ключевых показателей платформы</p>
                    </div>
                </div>

                <!-- Dashboard Stats Skeletons -->
                <div v-if="!stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6 animate-pulse">
                    <div v-for="i in 2" :key="'stat-skel-'+i" class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <div class="h-3 w-20 bg-slate-100 rounded mb-4"></div>
                        <div class="h-10 w-32 bg-slate-50 rounded"></div>
                    </div>
                </div>

                <div v-if="stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <p class="text-slate-400 text-xs lg:text-sm font-black uppercase tracking-widest mb-2">Пользователи</p>
                        <h3 class="text-3xl lg:text-4xl font-black text-slate-900 font-mono">{{ stats.totalUsers }}</h3>
                    </div>
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm border-l-[6px] border-l-amber-500">
                        <p class="text-slate-400 text-xs lg:text-sm font-black uppercase tracking-widest mb-2">Активные поездки</p>
                        <h3 class="text-3xl lg:text-4xl font-black text-amber-500 font-mono">{{ stats.activeRides }}</h3>
                    </div>
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm border-l-[6px] border-l-indigo-500">
                        <p class="text-slate-400 text-xs lg:text-sm font-black uppercase tracking-widest mb-2">Автобусы (рейсы)</p>
                        <h3 class="text-3xl lg:text-4xl font-black text-indigo-500 font-mono">{{ stats.totalBusTickets }}</h3>
                    </div>
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm border-l-[6px] border-l-emerald-500">
                        <p class="text-slate-400 text-xs lg:text-sm font-black uppercase tracking-widest mb-2">Выручка (Брони)</p>
                        <h3 class="text-3xl lg:text-4xl font-black text-emerald-500 font-mono">{{ stats.revenue }} с.</h3>
                    </div>
                </div>

                <!-- Dashboard Charts Skeletons Row 1 -->
                <div v-if="!stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 animate-pulse">
                    <div v-for="i in 2" :key="'chart-skel-1-'+i" class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <div class="flex justify-between items-center mb-6">
                            <div class="h-6 w-40 bg-slate-100 rounded"></div>
                            <div class="h-3 w-24 bg-slate-50 rounded"></div>
                        </div>
                        <div class="h-[300px] bg-slate-50 rounded-xl flex items-center justify-center">
                            <svg class="w-12 h-12 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                    <!-- Growth Chart -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 flex justify-between items-center text-slate-800">
                            <span>Динамика роста</span>
                            <span class="text-xs text-slate-400 font-normal">Последние 7 дней</span>
                        </h4>
                        <div class="h-[300px]">
                            <LineChart :data="growthChartData" :options="chartOptions" />
                        </div>
                    </div>

                    <!-- Car Models -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 text-slate-800">Модели автомобилей</h4>
                        <div class="h-[300px]">
                            <PieChart :data="carModelChartData" :options="pieOptions" />
                        </div>
                    </div>
                </div>

                <!-- Dashboard Charts Skeletons Row 2 -->
                <div v-if="!stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 animate-pulse">
                    <div v-for="i in 2" :key="'chart-skel-2-'+i" class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <div class="h-6 w-48 bg-slate-100 rounded mb-6"></div>
                        <div class="h-[300px] bg-slate-50 rounded-xl flex items-center justify-center">
                             <svg class="w-12 h-12 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                    <!-- Global Booking Dynamics -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm lg:col-span-2">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 flex justify-between items-center text-slate-800">
                            <span>Динамика бронирований (Автобусы)</span>
                            <span class="text-xs text-slate-400 font-normal">Последние 30 дней</span>
                        </h4>
                        <div class="h-[350px]">
                            <LineChart :data="bookingDynamicsChartData" :options="chartOptions" />
                        </div>
                    </div>

                    <!-- Age Distribution -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 text-slate-800">Возраст пользователей</h4>
                        <div class="h-[300px]">
                            <BarChart :data="ageChartData" :options="chartOptions" />
                        </div>
                    </div>

                    <!-- Bus Growth Chart -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 flex justify-between items-center text-slate-800">
                            <span>Автобусные рейсы</span>
                            <span class="text-xs text-slate-400 font-normal">Последние 7 дней</span>
                        </h4>
                        <div class="h-[300px]">
                            <LineChart :data="busRidesChartData" :options="chartOptions" />
                        </div>
                    </div>
                </div>

                <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                    <!-- Rides Comparison -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 text-slate-800">Соотношение поездок</h4>
                        <div class="h-[300px]">
                            <PieChart :data="ridesComparisonChartData" :options="pieOptions" />
                        </div>
                    </div>

                    <!-- Booking Status Distribution -->
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-6 text-slate-800">Статистика бронирований</h4>
                        <div class="h-[300px]">
                            <PieChart :data="bookingStatusChartData" :options="pieOptions" />
                        </div>
                        <div v-if="stats.bookingStatusDistribution" class="mt-4 flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-2">
                            <span>Всего: {{ stats.bookingStatusDistribution.total }}</span>
                            <span class="text-emerald-500">Оплачено: {{ ((stats.bookingStatusDistribution.paid / stats.bookingStatusDistribution.total) * 100 || 0).toFixed(1) }}%</span>
                        </div>
                    </div>
                </div>

                <!-- Dashboard Lists Skeletons -->
                <div v-if="!stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 animate-pulse">
                    <div v-for="i in 2" :key="'list-skel-'+i" class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <div class="h-6 w-40 bg-slate-100 rounded mb-8"></div>
                        <div class="space-y-6">
                            <div v-for="j in 4" :key="'list-item-skel-'+j" class="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                                <div class="h-4 w-32 bg-slate-50 rounded"></div>
                                <div class="h-4 w-16 bg-slate-50 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-4 lg:mb-6 text-slate-800">Новые пользователи</h4>
                        <div class="space-y-4">
                            <div v-for="u in stats.recentUsers" :key="u.id" class="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0">
                                <span class="font-medium text-sm lg:text-base text-slate-700">{{ u.name }}</span>
                                <span class="text-xs text-slate-400">{{ new Date(u.created_at).toLocaleDateString() }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-4 lg:mb-6 text-slate-800">Популярные города</h4>
                        <div class="space-y-4">
                            <div v-for="d in stats.popularDestinations" :key="d.to_city" class="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0">
                                <span class="font-medium text-sm lg:text-base text-slate-700">{{ d.to_city }}</span>
                                <span class="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold">{{ d.count }} поездок</span>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                        <h4 class="text-lg lg:text-xl font-bold mb-4 lg:mb-6 text-slate-800">Топ маршрутов (Автобус)</h4>
                        <div class="space-y-4">
                            <div v-for="r in stats.popularBusRoutes" :key="r.route" class="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0">
                                <span class="font-medium text-xs lg:text-sm text-slate-700">{{ r.route }}</span>
                                <span class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold">{{ r.count }} рейсов</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Passenger Funnel Section (Phase P.1F: Admin-Only Activation Funnel) -->
            <section v-if="activeTab === 'passenger-funnel'" class="space-y-6 lg:space-y-8">
                <!-- Header -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <h2 class="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Воронка пассажиров</h2>
                            <span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-black rounded-full border border-amber-200">ADMIN-ONLY</span>
                            <span class="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">Учёт с 04.09.2026</span>
                        </div>
                        <p class="text-sm text-slate-500">Сквозной контроль пути пассажира: ручная бронь → передача → открытие билета → бот → номер → активация</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button 
                            @click="fetchFunnelData" 
                            :disabled="funnelLoading"
                            class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-sm"
                        >
                            <svg :class="{'animate-spin': funnelLoading}" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{{ funnelLoading ? 'Обновление...' : 'Обновить данные' }}</span>
                        </button>
                    </div>
                </div>

                <!-- Filters Toolbar -->
                <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <!-- Period Buttons -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Период:</span>
                            <button 
                                v-for="p in [
                                    { id: 'today', label: 'Сегодня' },
                                    { id: 'yesterday', label: 'Вчера' },
                                    { id: '7days', label: '7 дней' },
                                    { id: '30days', label: '30 дней' },
                                    { id: 'all', label: 'Все (с P.1)' }
                                ]" 
                                :key="p.id"
                                @click="setPeriod(p.id)"
                                class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                :class="funnelFilters.period === p.id ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'"
                            >
                                {{ p.label }}
                            </button>
                        </div>
                        <button 
                            @click="resetFilters" 
                            class="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                        >
                            Сбросить фильтры
                        </button>
                    </div>

                    <!-- Dropdown Filters & Search -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">Канал передачи</label>
                            <select 
                                v-model="funnelFilters.channel" 
                                @change="fetchFunnelData"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
                            >
                                <option value="">Все каналы передачи</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="sms">SMS</option>
                                <option value="telegram">Telegram Share</option>
                                <option value="copy_link">Копирование ссылки</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">Статус воронки</label>
                            <select 
                                v-model="funnelFilters.status" 
                                @change="fetchFunnelData"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
                            >
                                <option value="ALL">Все статусы</option>
                                <option value="NOT_SHARED">NOT_SHARED (не передан)</option>
                                <option value="SHARE_INITIATED">SHARE_INITIATED (передача начата)</option>
                                <option value="LINK_OPENED">LINK_OPENED (ссылка открыта)</option>
                                <option value="TELEGRAM_CTA_CLICKED">TELEGRAM_CTA_CLICKED</option>
                                <option value="BOT_STARTED">BOT_STARTED (бот запущен)</option>
                                <option value="PHONE_PENDING">PHONE_PENDING (ожидает номер)</option>
                                <option value="BOT_ABANDONED">BOT_ABANDONED (>2ч без номера)</option>
                                <option value="PHONE_MISMATCH">PHONE_MISMATCH (не совпал)</option>
                                <option value="UNDER_REVIEW">UNDER_REVIEW (на проверке)</option>
                                <option value="ACTIVATED">ACTIVATED (пассажир активирован)</option>
                                <option value="EXPIRED">EXPIRED (сессия истекла)</option>
                                <option value="LEGACY">LEGACY (до Phase P.1)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">Перевозчик</label>
                            <select 
                                v-model="funnelFilters.carrier_id" 
                                @change="fetchFunnelData"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
                            >
                                <option value="">Все перевозчики</option>
                                <option v-for="d in busDrivers" :key="d.id" :value="d.id">{{ d.name }} {{ d.surname }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">Поиск</label>
                            <input 
                                v-model="funnelFilters.search" 
                                @keyup.enter="fetchFunnelData"
                                type="text" 
                                placeholder="Имя, маска тел., рейс..." 
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    <!-- Quick Filter Pills -->
                    <div class="flex flex-wrap items-center gap-2 pt-2">
                        <button 
                            @click="toggleAttentionFilter"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5"
                            :class="funnelFilters.attentionOnly ? 'bg-rose-500 text-white border-rose-500 shadow-sm' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'"
                        >
                            <span>⚠️</span>
                            <span>Только требующие внимания ({{ funnelAttention.length }})</span>
                        </button>
                        <button 
                            @click="setQuickStatus('PHONE_MISMATCH')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            :class="funnelFilters.status === 'PHONE_MISMATCH' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'"
                        >
                            Несовпадение номера
                        </button>
                        <button 
                            @click="setQuickStatus('BOT_ABANDONED')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            :class="funnelFilters.status === 'BOT_ABANDONED' ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'"
                        >
                            Запустили бот, но не передали номер
                        </button>
                        <button 
                            @click="setQuickStatus('LINK_OPENED')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            :class="funnelFilters.status === 'LINK_OPENED' ? 'bg-sky-500 text-white border-sky-500' : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'"
                        >
                            Открыли билет, но не запустили бот
                        </button>
                        <button 
                            @click="setQuickStatus('ACTIVATED')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                            :class="funnelFilters.status === 'ACTIVATED' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'"
                        >
                            Только активированные
                        </button>
                    </div>
                </div>

                <!-- State 1: Error State -->
                <div v-if="funnelError" class="bg-rose-50 border border-rose-200 p-8 rounded-2xl lg:rounded-[32px] text-center space-y-4 shadow-sm">
                    <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
                    <div>
                        <h3 class="text-lg font-black text-rose-900">Ошибка загрузки данных воронки</h3>
                        <p class="text-xs text-rose-600 max-w-md mx-auto mt-1">{{ funnelError }}</p>
                    </div>
                    <div>
                        <button 
                            @click="fetchFunnelData" 
                            class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20"
                        >
                            Повторить
                        </button>
                    </div>
                </div>

                <!-- State 2: Loading Skeleton State -->
                <div v-else-if="funnelLoading" class="space-y-6 animate-pulse">
                    <!-- Skeletons for 10 KPI Cards -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
                        <div v-for="i in 10" :key="'kpi-skel-' + i" class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <div class="h-3 w-16 bg-slate-100 rounded mb-2"></div>
                            <div class="h-8 w-24 bg-slate-200 rounded mb-2"></div>
                            <div class="h-3 w-20 bg-slate-50 rounded"></div>
                        </div>
                    </div>
                    <!-- Skeleton for Visual Stages -->
                    <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                        <div class="h-4 w-52 bg-slate-200 rounded"></div>
                        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-3">
                            <div v-for="i in 9" :key="'st-skel-' + i" class="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-28"></div>
                        </div>
                    </div>
                    <!-- Skeleton for Table -->
                    <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm h-64 flex items-center justify-center">
                        <span class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></span>
                    </div>
                </div>

                <!-- State 3: Empty State -->
                <div v-else-if="isFunnelEmpty" class="bg-white p-12 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm text-center space-y-4">
                    <div class="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto text-3xl">📊</div>
                    <div>
                        <h3 class="text-xl font-black text-slate-800">За выбранный период данных пока нет</h3>
                        <p class="text-xs text-slate-400 max-w-md mx-auto mt-1">
                            Ручные бронирования за выбранный период не найдены или ещё не зафиксированы. Попробуйте выбрать другой период или сбросить фильтры.
                        </p>
                    </div>
                    <div>
                        <button 
                            @click="resetFilters" 
                            class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-sm"
                        >
                            Сбросить фильтры
                        </button>
                    </div>
                </div>

                <!-- State 4: Success State (KPI Cards, Visual Stages, Queue, Sub-tabs) -->
                <div v-else class="space-y-6 lg:space-y-8">
                    <!-- 10 Upper KPI Cards -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">1. Ручные брони</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-slate-900 font-mono">{{ funnelSummary?.manualBookingsCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-400 font-medium">100% от общего числа</div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">2. Передача иниц.</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-indigo-600 font-mono">{{ funnelSummary?.shareInitiatedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-500 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.shareInitiatedConversion) }} от броней
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-sky-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">3. Ссылка открыта</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-sky-600 font-mono">{{ funnelSummary?.linkOpenedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-500 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.linkOpenedConversion) }} от передач
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-cyan-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">4. Telegram CTA</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-cyan-600 font-mono">{{ funnelSummary?.telegramCtaClickedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-500 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.telegramCtaConversion) }} от открытий
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-purple-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">5. Бот запущен</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-purple-600 font-mono">{{ funnelSummary?.botStartedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-500 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.botStartedConversion) }} от CTA
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-violet-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">6. Номер передан</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-violet-600 font-mono">{{ funnelSummary?.phoneSharedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-500 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.phoneSharedConversion) }} от ботов
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-teal-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">7. Номер подтверждён</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-teal-600 font-mono">{{ funnelSummary?.phoneVerifiedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-slate-500 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.phoneVerifiedConversion) }} от переданных
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">8. Пассажир активирован</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-emerald-600 font-mono">{{ funnelSummary?.activatedCount || 0 }}</h4>
                            <div class="mt-2 text-[11px] text-emerald-600 font-bold">
                                {{ formatFunnelConversion(funnelSummary?.activatedConversion) }} от подтверждённых
                            </div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">9. Общая конверсия</p>
                            <h4 class="text-2xl lg:text-3xl font-black text-amber-500 font-mono">
                                {{ formatFunnelConversion(funnelSummary?.conversionRate) }}
                            </h4>
                            <div class="mt-2 text-[11px] text-slate-400 font-medium">бронь → активация</div>
                        </div>
                        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-l-rose-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">10. Время активации</p>
                            <div class="text-lg font-black text-slate-800 font-mono">
                                <span>Ср: {{ funnelSummary?.avgActivationTimeMinutes !== null && funnelSummary?.avgActivationTimeMinutes !== undefined ? funnelSummary.avgActivationTimeMinutes + 'м' : '—' }}</span>
                                <span class="text-xs text-slate-400 font-normal ml-1">/ Мед: {{ funnelSummary?.medianActivationTimeMinutes !== null && funnelSummary?.medianActivationTimeMinutes !== undefined ? funnelSummary.medianActivationTimeMinutes + 'м' : '—' }}</span>
                            </div>
                            <div class="mt-2 text-[11px] text-slate-400 font-medium">от создания брони</div>
                        </div>
                    </div>

                    <!-- Visual Funnel Stages -->
                    <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-bold text-slate-900">Визуальная воронка активации (Phase P.1)</h3>
                            <span class="text-xs text-slate-400">Уникальные booking_id · Атрибуция по handoff_id</span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-3">
                            <div 
                                v-for="(st, idx) in (funnelStages || [])" 
                                :key="st.id" 
                                class="relative bg-slate-50 hover:bg-amber-50/50 p-4 rounded-2xl border border-slate-200 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div class="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                                        <span>#{{ idx + 1 }}</span>
                                        <span v-if="st.conversionFromPrev !== null" class="text-emerald-600 font-mono">{{ st.conversionFromPrev }}%</span>
                                    </div>
                                    <h5 class="text-xs font-black text-slate-800 leading-tight mb-2">{{ st.name }}</h5>
                                    <div class="text-2xl font-black text-slate-900 font-mono">{{ st.count }}</div>
                                </div>
                                <div class="mt-3 pt-2 border-t border-slate-200/60 text-[10px]">
                                    <div v-if="st.dropOff !== null" class="text-rose-500 font-medium flex justify-between">
                                        <span>Потери:</span>
                                        <span class="font-bold font-mono">-{{ st.dropOff }} ({{ st.dropOffPercent }}%)</span>
                                    </div>
                                    <div v-else class="text-slate-400">
                                        Базовый этап
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Attention Work Queue («Требуют внимания») -->
                    <div v-if="funnelAttention && funnelAttention.length > 0" class="bg-rose-50/70 border border-rose-200 p-6 rounded-2xl lg:rounded-[32px] shadow-sm space-y-4">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <span class="text-rose-600 text-lg">⚠️</span>
                                <h3 class="text-base font-black text-rose-900">Рабочая очередь: требуют внимания ({{ funnelAttention.length }})</h3>
                            </div>
                            <span class="text-xs text-rose-700 font-medium">Приоритетные действия для администратора платформы</span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div 
                                v-for="item in (funnelAttention || [])" 
                                :key="item.booking_id || item.bookingId"
                                class="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between space-y-3"
                            >
                                <div>
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-xs font-bold text-slate-800">{{ item.passenger_name || item.passengerName }}</span>
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase border" :class="getFunnelStatusBadgeClass(item.status)">
                                            {{ getFunnelStatusLabel(item.status) }}
                                        </span>
                                    </div>
                                    <div class="text-xs font-mono text-slate-500">{{ item.masked_phone || item.maskedPhone || 'Номер не указан' }}</div>
                                    <div class="text-xs text-slate-500 mt-1">
                                        <span class="font-bold">{{ item.carrier_name || item.carrierName || 'Перевозчик' }}</span> · <span>{{ item.route || 'Маршрут не указан' }}</span>
                                    </div>
                                    <div class="text-[11px] text-rose-600 font-semibold mt-2 bg-rose-50 p-2 rounded-xl">
                                        {{ item.issue_description || item.issueDescription }}
                                    </div>
                                </div>
                                <div class="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                                    <button 
                                        @click="openPassengerTimeline(item.booking_id || item.bookingId)"
                                        class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex-1 text-center"
                                    >
                                        История пути
                                    </button>
                                    <button 
                                        v-if="item.claim_request_id || item.claimRequestId"
                                        @click="openReviewModal(item)"
                                        class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors flex-1 text-center shadow-sm shadow-amber-500/20"
                                    >
                                        Решить несовпадение
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Drill-down Sub-tabs: Table | Channels | Carriers -->
                    <div class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <!-- Sub-tabs Header -->
                        <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div class="flex items-center gap-2">
                                <button 
                                    @click="funnelActiveSubTab = 'table'"
                                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                    :class="funnelActiveSubTab === 'table' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'"
                                >
                                    Путь пассажиров ({{ funnelPagination?.total || 0 }})
                                </button>
                                <button 
                                    @click="funnelActiveSubTab = 'channels'"
                                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                    :class="funnelActiveSubTab === 'channels' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'"
                                >
                                    Аналитика каналов ({{ (funnelChannels || []).length }})
                                </button>
                                <button 
                                    @click="funnelActiveSubTab = 'carriers'"
                                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                                    :class="funnelActiveSubTab === 'carriers' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'"
                                >
                                    Рейтинг перевозчиков ({{ (funnelCarriers || []).length }})
                                </button>
                            </div>
                        </div>

                        <!-- Sub-tab 1: Passenger Table -->
                        <div v-if="funnelActiveSubTab === 'table'" class="p-6">
                            <div v-if="funnelLoading" class="flex items-center justify-center py-20">
                                <span class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></span>
                            </div>
                            <div v-else-if="!funnelPassengers || funnelPassengers.length === 0" class="text-center py-20 text-slate-400">
                                <p class="text-lg font-medium">Пассажиры не найдены по выбранным фильтрам</p>
                                <button @click="resetFilters" class="mt-3 text-xs font-bold text-amber-600 underline">Сбросить фильтры</button>
                            </div>
                            <div v-else class="overflow-x-auto">
                                <table class="w-full text-left min-w-[1200px]">
                                    <thead class="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                                        <tr>
                                            <th class="px-4 py-3">Пассажир</th>
                                            <th class="px-4 py-3">Телефон</th>
                                            <th class="px-4 py-3">Перевозчик</th>
                                            <th class="px-4 py-3">Рейс / Маршрут</th>
                                            <th class="px-4 py-3">Дата отправления</th>
                                            <th class="px-4 py-3">Место</th>
                                            <th class="px-4 py-3">Дата брони</th>
                                            <th class="px-4 py-3">Канал передачи</th>
                                            <th class="px-4 py-3">Статус воронки</th>
                                            <th class="px-4 py-3">Время на этапе</th>
                                            <th class="px-4 py-3">Рекомендуемое действие</th>
                                            <th class="px-4 py-3 text-right">История</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-50">
                                        <tr 
                                            v-for="p in (funnelPassengers || [])" 
                                            :key="p.booking_id || p.bookingId"
                                            class="hover:bg-slate-50/70 transition-colors text-slate-700 text-xs"
                                        >
                                            <td class="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{{ p.passenger_name || p.passengerName }}</td>
                                            <td class="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">{{ p.masked_phone || p.maskedPhone }}</td>
                                            <td class="px-4 py-3 text-slate-600 whitespace-nowrap">{{ p.carrier_name || p.carrierName || '—' }}</td>
                                            <td class="px-4 py-3">
                                                <div class="font-bold text-slate-800 whitespace-nowrap">{{ p.route || '—' }}</div>
                                                <div class="text-[10px] text-slate-400 font-mono">ID: {{ formatShortBookingId(p.booking_id || p.bookingId) }}</div>
                                            </td>
                                            <td class="px-4 py-3 text-slate-600 whitespace-nowrap font-mono">{{ p.departure_date || p.departureDate || '—' }}</td>
                                            <td class="px-4 py-3">
                                                <span class="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded-md border border-amber-100 text-[10px]">{{ p.seat_number || p.seats || '—' }}</span>
                                            </td>
                                            <td class="px-4 py-3 text-slate-500 whitespace-nowrap font-mono">{{ formatFunnelDate(p.created_at || p.createdAt) }}</td>
                                            <td class="px-4 py-3 whitespace-nowrap">
                                                <span v-if="p.last_channel || p.channel" class="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px] border border-slate-200">
                                                    {{ p.last_channel || p.channel }}
                                                </span>
                                                <span v-else class="text-slate-300">—</span>
                                            </td>
                                            <td class="px-4 py-3 whitespace-nowrap">
                                                <span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border" :class="getFunnelStatusBadgeClass(p.status)">
                                                    {{ getFunnelStatusLabel(p.status) }}
                                                </span>
                                            </td>
                                            <td class="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">{{ p.time_in_stage || p.timeInStage || '—' }}</td>
                                            <td class="px-4 py-3 text-slate-600 max-w-[220px] text-[11px] leading-tight">
                                                {{ p.next_recommended_action || p.nextAction || '—' }}
                                            </td>
                                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                                <button 
                                                    @click="openPassengerTimeline(p.booking_id || p.bookingId)"
                                                    class="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 font-bold rounded-lg text-xs transition-colors"
                                                >
                                                    История
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <!-- Pagination -->
                                <div class="mt-6 flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                                    <div class="text-slate-400">
                                        Показано {{ (funnelPassengers || []).length }} из {{ funnelPagination?.total || 0 }} пассажиров
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button 
                                            :disabled="!funnelPagination || funnelPagination.page <= 1"
                                            @click="changeFunnelPage((funnelPagination?.page || 1) - 1)"
                                            class="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                        >
                                            Назад
                                        </button>
                                        <span class="px-3 py-1.5 font-bold text-slate-700">Стр. {{ funnelPagination?.page || 1 }} из {{ funnelPagination?.totalPages || 1 }}</span>
                                        <button 
                                            :disabled="!funnelPagination || funnelPagination.page >= funnelPagination.totalPages"
                                            @click="changeFunnelPage((funnelPagination?.page || 1) + 1)"
                                            class="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                        >
                                            Вперёд
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Sub-tab 2: Channels Table -->
                        <div v-if="funnelActiveSubTab === 'channels'" class="p-6 overflow-x-auto">
                            <div class="mb-4 text-xs text-slate-400">
                                * Система фиксирует факт инициирования передачи билета в канал перевозчиком (слово «доставлено» не используется).
                            </div>
                            <table class="w-full text-left min-w-[900px]">
                                <thead class="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                                    <tr>
                                        <th class="px-4 py-3">Канал передачи</th>
                                        <th class="px-4 py-3">Попытки передачи</th>
                                        <th class="px-4 py-3">Уникальные брони</th>
                                        <th class="px-4 py-3">Открытия ссылки</th>
                                        <th class="px-4 py-3">Telegram CTA</th>
                                        <th class="px-4 py-3">Запуски бота</th>
                                        <th class="px-4 py-3">Передача номера</th>
                                        <th class="px-4 py-3">Активации</th>
                                        <th class="px-4 py-3">Конверсия передачи → активация</th>
                                        <th class="px-4 py-3">Медианное время</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    <tr v-for="ch in (funnelChannels || [])" :key="ch.channel" class="hover:bg-slate-50 transition-colors text-xs text-slate-700">
                                        <td class="px-4 py-3 font-bold text-slate-900">{{ ch.channel_name || ch.channelName || ch.channel }}</td>
                                        <td class="px-4 py-3 font-mono">{{ ch.total_handoffs !== undefined ? ch.total_handoffs : ch.handoffsCount }}</td>
                                        <td class="px-4 py-3 font-mono font-bold">{{ ch.unique_bookings !== undefined ? ch.unique_bookings : ch.uniqueBookings }}</td>
                                        <td class="px-4 py-3 font-mono">{{ ch.link_opened_count !== undefined ? ch.link_opened_count : ch.opensCount }}</td>
                                        <td class="px-4 py-3 font-mono">{{ ch.telegram_cta_count !== undefined ? ch.telegram_cta_count : ch.ctaCount }}</td>
                                        <td class="px-4 py-3 font-mono">{{ ch.bot_started_count !== undefined ? ch.bot_started_count : ch.botStartsCount }}</td>
                                        <td class="px-4 py-3 font-mono">{{ ch.phone_shared_count !== undefined ? ch.phone_shared_count : ch.phoneSharedCount }}</td>
                                        <td class="px-4 py-3 font-mono font-bold text-emerald-600">{{ ch.activated_count !== undefined ? ch.activated_count : ch.activatedCount }}</td>
                                        <td class="px-4 py-3">
                                            <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono font-bold rounded border border-emerald-100 text-[11px]">
                                                {{ formatFunnelConversion(ch.conversion_rate !== undefined ? ch.conversion_rate : ch.conversionRate) }}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 font-mono text-slate-500">{{ ch.median_activation_time || ch.medianActivationDisplay || '—' }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Sub-tab 3: Carriers Table -->
                        <div v-if="funnelActiveSubTab === 'carriers'" class="p-6 overflow-x-auto">
                            <div class="mb-4 text-xs text-slate-400">
                                * Административный рейтинг эффективности передачи билетов и активации пассажиров по перевозчикам.
                            </div>
                            <table class="w-full text-left min-w-[900px]">
                                <thead class="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                                    <tr>
                                        <th class="px-4 py-3">Перевозчик</th>
                                        <th class="px-4 py-3">Ручные брони</th>
                                        <th class="px-4 py-3">Билетов передано</th>
                                        <th class="px-4 py-3">Ссылок открыто</th>
                                        <th class="px-4 py-3">Пассажиров активировано</th>
                                        <th class="px-4 py-3">Процент активации</th>
                                        <th class="px-4 py-3">Ср. время до передачи</th>
                                        <th class="px-4 py-3">Ср. время до активации</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    <tr v-for="c in (funnelCarriers || [])" :key="c.carrier_id || c.carrierId" class="hover:bg-slate-50 transition-colors text-xs text-slate-700">
                                        <td class="px-4 py-3 font-bold text-slate-900">{{ c.carrier_name || c.carrierName }}</td>
                                        <td class="px-4 py-3 font-mono">{{ c.manual_bookings_count !== undefined ? c.manual_bookings_count : c.manualBookings }}</td>
                                        <td class="px-4 py-3 font-mono">{{ c.handoffs_count !== undefined ? c.handoffs_count : c.handoffsCount }}</td>
                                        <td class="px-4 py-3 font-mono">{{ c.links_opened_count !== undefined ? c.links_opened_count : c.opensCount }}</td>
                                        <td class="px-4 py-3 font-mono font-bold text-emerald-600">{{ c.activated_count !== undefined ? c.activated_count : c.activatedCount }}</td>
                                        <td class="px-4 py-3">
                                            <span class="px-2 py-0.5 bg-amber-50 text-amber-700 font-mono font-bold rounded border border-amber-100 text-[11px]">
                                                {{ formatFunnelConversion(c.activation_rate !== undefined ? c.activation_rate : c.activationRate) }}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 font-mono text-slate-500">{{ c.avg_time_to_handoff || c.avgTimeToHandoffDisplay || '—' }}</td>
                                        <td class="px-4 py-3 font-mono text-slate-500">{{ c.avg_time_to_activation || c.avgTimeToActivateDisplay || '—' }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Users Section -->
            <section v-if="activeTab === 'users'" class="space-y-6 lg:space-y-8">
                <h2 class="text-2xl lg:text-3xl text-slate-900 font-bold">Пользователи</h2>
                <div class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 overflow-x-auto shadow-sm">
                    <table class="w-full text-left min-w-[700px]">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4 text-slate-500 font-semibold">ID</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Имя</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Телефон</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Рейтинг</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Действия</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="(user, index) in users" :key="user.id" class="hover:bg-slate-50 transition-colors text-slate-700">
                                <td class="px-6 py-4 font-mono text-slate-400">#{{ users.length - index }}</td>
                                <td class="px-6 py-4 font-bold">{{ user.name }} {{ user.surname }}</td>
                                <td class="px-6 py-4 font-mono">{{ user.phone }}</td>
                                <td class="px-6 py-4">
                                    <span class="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-bold">★ {{ user.rating }}</span>
                                </td>
                                 <td class="px-6 py-4 text-right space-x-3">
                                     <button @click="openEditUserModal(user)" class="text-amber-600 hover:text-amber-700 font-bold text-sm">Изменить</button>
                                     <button @click="deleteUser(user.id)" class="text-red-500 hover:text-red-600 font-bold text-sm">Удалить</button>
                                 </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Bus Drivers Section -->
            <section v-if="activeTab === 'bus-drivers'" class="space-y-6 lg:space-y-8">
                <h2 class="text-2xl lg:text-3xl text-slate-900 font-bold">Водители автобусов</h2>
                
                <div class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 p-6 lg:p-8 shadow-sm space-y-6">
                    <h3 class="text-xl font-bold text-amber-600">Добавить водителя</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input v-model="newBusDriver.name" placeholder="Имя" class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500" />
                        <input v-model="newBusDriver.surname" placeholder="Фамилия" class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500" />
                        <input v-model="newBusDriver.phone" placeholder="Телефон" type="tel" class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500" />
                        <input v-model="newBusDriver.password" placeholder="Пароль" type="text" class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500" />
                    </div>
                    <div class="flex justify-end">
                        <button @click="createBusDriver" :disabled="loading" class="bg-amber-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50">Создать водителя</button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 overflow-x-auto shadow-sm mt-8">
                    <table class="w-full text-left min-w-[700px]">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4 text-slate-500 font-semibold">ID</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Имя</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Телефон</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Дата создания</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Сбор (%)</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Действия</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="driver in busDrivers" :key="driver.id" @click="openBusDriverDetail(driver)" class="hover:bg-amber-50 cursor-pointer transition-colors text-slate-700">
                                <td class="px-6 py-4 font-mono text-slate-400">#{{ driver.id }}</td>
                                <td class="px-6 py-4 font-bold">
                                    <div class="flex items-center gap-2">
                                        {{ driver.name }} {{ driver.surname }}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                                    </div>
                                </td>
                                <td class="px-6 py-4 font-mono">{{ driver.phone }}</td>
                                <td class="px-6 py-4">
                                    <span v-if="driver.is_blocked" class="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100 italic">Заблокирован</span>
                                    <span v-else class="text-slate-500 text-sm">{{ new Date(driver.created_at).toLocaleDateString() }}</span>
                                </td>
                                <!-- Inline fee editor -->
                                <td class="px-6 py-4" @click.stop>
                                    <div v-if="editingFee && editingFee.driverId === driver.id" class="flex items-center gap-2">
                                        <input
                                            v-model.number="editingFee.value"
                                            type="number" min="0" max="100" step="0.5"
                                            class="w-20 bg-slate-50 border border-amber-300 rounded-lg px-2 py-1 text-sm text-slate-900 outline-none focus:border-amber-500 font-mono"
                                            @keyup.enter="saveDriverFee(driver)"
                                            @keyup.esc="cancelEditFee"
                                        />
                                        <button @click.stop="saveDriverFee(driver)" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer">Сохр</button>
                                        <button @click.stop="cancelEditFee" class="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Итм</button>
                                    </div>
                                    <button v-else @click.stop="startEditFee(driver)" class="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold text-sm px-3 py-1 rounded-full transition-colors cursor-pointer">
                                        {{ driver.service_fee_percent ?? 10 }}%
                                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
                                    </button>
                                </td>
                                <td class="px-6 py-4 space-x-3" @click.stop>
                                     <button @click.stop="openEditUserModal(driver)" class="text-amber-600 hover:text-amber-700 font-bold text-sm cursor-pointer">Изменить</button>
                                     <button v-if="!driver.is_blocked" @click.stop="blockDriver(driver.id)" class="text-slate-400 hover:text-red-500 font-bold text-sm cursor-pointer">Блокировать</button>
                                     <button v-else @click.stop="unblockDriver(driver.id)" class="text-emerald-600 hover:text-emerald-700 font-bold text-sm cursor-pointer">Разблокировать</button>
                                     <button @click.stop="deleteUser(driver.id)" class="text-red-500 hover:text-red-600 font-bold text-sm cursor-pointer opacity-30 hover:opacity-100 transition-opacity">Удалить</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>


            </section>

             <!-- Rides Section -->
             <section v-if="activeTab === 'rides'" class="space-y-6 lg:space-y-8">
                <h2 class="text-2xl lg:text-3xl text-slate-900 font-bold">Все поездки</h2>
                <div class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 overflow-x-auto shadow-sm">
                    <table class="w-full text-left min-w-[800px]">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4 text-slate-500 font-semibold">ID</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Маршрут</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Водитель</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Дата/Время</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Статус</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold text-right">Управление</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="ride in rides" :key="ride.id" class="hover:bg-slate-50 transition-colors text-slate-700">
                                <td class="px-6 py-4 font-mono text-slate-400">#{{ ride.id }}</td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center space-x-2">
                                        <span class="font-bold text-slate-800">{{ ride.from_city }}</span>
                                        <span class="text-slate-400">→</span>
                                        <span class="font-bold text-slate-800">{{ ride.to_city }}</span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 font-medium">{{ ride.driver_name }}</td>
                                <td class="px-6 py-4 font-mono text-sm text-slate-500">{{ ride.date }} {{ ride.time }}</td>
                                <td class="px-6 py-4">
                                    <span :class="ride.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'" class="px-3 py-1 rounded-full text-xs font-bold uppercase">{{ ride.status || 'active' }}</span>
                                </td>
                                <td class="px-6 py-4 text-right space-x-3">
                                    <button @click="openEditRideModal(ride)" class="text-amber-600 hover:text-amber-700 font-bold text-sm">Изменить</button>
                                    <button @click="deleteRide(ride.id)" class="text-red-500 hover:text-red-600 font-bold text-sm">Удалить</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Cities Section -->
            <section v-if="activeTab === 'cities'" class="space-y-6 lg:space-y-10">
                <div class="mb-8">
                    <h2 class="text-3xl font-bold text-slate-900">Управление городами</h2>
                    <p class="text-slate-500 mt-2">Раздельное управление списками для попуток и автобусов</p>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
                    
                    <!-- Rides Cities -->
                    <div class="space-y-6">
                        <div class="flex items-center justify-between bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                            <div class="flex items-center space-x-4">
                                <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-xl text-slate-800 uppercase tracking-tight">Попутки</h3>
                                    <p class="text-xs text-slate-400">Для частных поездок</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <input v-model="newRideCity" type="text" placeholder="Новый город" class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-500 w-32 md:w-auto text-slate-700">
                                <button @click="addCity('ride')" class="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-amber-600 transition-colors">+</button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div v-for="city in ridesCities" :key="'ride-city-'+city.id" class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-amber-500/30 transition-all shadow-sm">
                                <span class="font-medium text-slate-700">{{ city.name }}</span>
                                <button @click="deleteCity(city.id)" class="text-slate-300 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Bus Cities -->
                    <div class="space-y-6">
                        <div class="flex items-center justify-between bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                            <div class="flex items-center space-x-4">
                                <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 11h18M7 19v2M17 19v2M3 8h18"/><circle cx="7.5" cy="16" r="1" fill="currentColor"/><circle cx="16.5" cy="16" r="1" fill="currentColor"/></svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-xl text-slate-800 uppercase tracking-tight">Автобусы</h3>
                                    <p class="text-xs text-slate-400">Для официальных рейсов</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <input v-model="newBusCity" type="text" placeholder="Новый город" class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 w-32 md:w-auto text-slate-700">
                                <button @click="addCity('bus')" class="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-blue-600 transition-colors">+</button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div v-for="city in busCities" :key="'bus-city-'+city.id" class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-blue-400/30 transition-all shadow-sm">
                                <span class="font-medium text-slate-700">{{ city.name }}</span>
                                <button @click="deleteCity(city.id)" class="text-slate-300 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            <!-- Bus Tickets Section -->
            <section v-if="activeTab === 'bus-tickets'" class="space-y-6 lg:space-y-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    <h2 class="text-2xl lg:text-3xl font-bold">Управление автобусами</h2>
                    <button 
                        class="bg-amber-500 text-slate-900 px-6 py-2 rounded-xl font-bold shadow-lg shadow-amber-500/20 w-full sm:w-auto" 
                        @click="isCreatingBus = !isCreatingBus"
                    >
                        {{ isCreatingBus ? 'Отмена' : 'Добавить рейс' }}
                    </button>
                </div>

                <!-- ADD BUS TICKET INTERFACE (Embedded) -->
                <div v-if="isCreatingBus" class="bg-white rounded-[32px] border border-slate-100 p-8 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div class="flex justify-between items-center">
                        <h3 class="text-2xl font-bold text-slate-800">Новый автобусный рейс</h3>
                        <div class="flex items-center space-x-2">
                             <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                             <span class="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Создание записи</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- Company -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Компания</label>
                            <input v-model="busForm.transport_company" placeholder="Название перевозчика" 
                                class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner"
                                :class="{'border-red-500': busErrors.transport_company}" />
                        </div>

                        <!-- From City -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Откуда</label>
                            <select v-model="busForm.from_city" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner appearance-none cursor-pointer" :class="{'border-red-500': busErrors.from_city}">
                                <option value="" disabled>Выберите город</option>
                                <option v-for="c in busCities" :key="'bus-from-'+c.id" :value="c.name">{{ c.name }}</option>
                            </select>
                        </div>

                        <!-- From Address -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Адрес отправления</label>
                            <input v-model="busForm.from_address" placeholder="Точный адрес автовокзала" 
                                class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" />
                        </div>

                        <!-- To City -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Куда</label>
                            <select v-model="busForm.to_city" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner appearance-none cursor-pointer" :class="{'border-red-500': busErrors.to_city}">
                                <option value="" disabled>Выберите город</option>
                                <option v-for="c in busCities" :key="'bus-to-'+c.id" :value="c.name">{{ c.name }}</option>
                            </select>
                        </div>

                        <!-- To Address -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Адрес прибытия</label>
                            <input v-model="busForm.to_address" placeholder="Точный адрес прибытия" 
                                class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-500 transition-all shadow-inner" />
                        </div>

                        <!-- Dates (Departure) -->
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Дата отпр.</label>
                                <input v-model="busForm.departure_date" type="date" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-400 text-xs" :class="{'border-red-500': busErrors.departure_date}" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Время отпр.</label>
                                <input v-model="busForm.departure_time" type="time" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-400 text-xs" :class="{'border-red-500': busErrors.departure_time}" />
                            </div>
                        </div>

                        <!-- Dates (Arrival) -->
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Дата приб.</label>
                                <input v-model="busForm.arrival_date" type="date" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-400 text-xs" :class="{'border-red-500': busErrors.arrival_date}" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Время приб.</label>
                                <input v-model="busForm.arrival_time" type="time" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none focus:border-blue-400 text-xs" :class="{'border-red-500': busErrors.arrival_time}" />
                            </div>
                        </div>

                        <!-- Price -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Цена (TJS)</label>
                            <input v-model="busForm.price" type="number" placeholder="000.00" 
                                class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-blue-600 font-bold text-xl outline-none focus:border-blue-500 transition-all shadow-inner" />
                        </div>

                         <!-- Bus Type Selection (Premium Toggles) -->
                         <div class="space-y-2 flex flex-col">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Конфигурация автобуса</label>
                            <div class="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                <button @click="busForm.bus_type = 'single'; busForm.total_seats = 44"
                                    :class="busForm.bus_type === 'single' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'"
                                    class="flex-1 py-3 rounded-xl font-bold text-xs transition-all tracking-tighter uppercase whitespace-pretty px-2"
                                >
                                    Обычный (44)
                                </button>
                                <button @click="busForm.bus_type = 'double'; busForm.total_seats = 72"
                                    :class="busForm.bus_type === 'double' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'"
                                    class="flex-1 py-3 rounded-xl font-bold text-xs transition-all tracking-tighter uppercase whitespace-pretty px-2"
                                >
                                    Двухэтажный (72)
                                </button>
                            </div>
                        </div>

                        <!-- Total Seats & Duration -->
                         <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Мест всего</label>
                                <input v-model="busForm.total_seats" type="number" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none" />
                            </div>
                            <div class="space-y-2">
                                <label class="text-[9px] text-slate-400 font-bold uppercase ml-1">Длительность (ч.)</label>
                                <input v-model="busForm.duration_hours" type="number" step="0.5" class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 outline-none" />
                            </div>
                         </div>
                    </div>

                    <!-- Intermediate Stops (Premium Rows) -->
                    <div class="space-y-4 pt-4 border-t border-slate-700/50">
                        <div class="flex items-center justify-between">
                            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest">Промежуточные остановки</h4>
                            <button @click="addStop" class="text-xs font-bold text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 hover:bg-amber-500 hover:text-slate-900 transition-all">
                                + Добавить остановку
                            </button>
                        </div>
                        
                        <div v-if="busForm.intermediate_stops.length === 0" class="text-center py-8 rounded-[32px] border-2 border-dashed border-slate-700 text-slate-500 italic text-sm">
                            Рейс без остановок
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div v-for="(stop, index) in busForm.intermediate_stops" :key="'admin-stop-'+index" class="bg-slate-700/20 p-5 rounded-3xl border border-slate-700 flex flex-col space-y-3 relative group overflow-hidden">
                                <div class="absolute inset-y-0 left-0 w-1 bg-amber-500"></div>
                                <button @click="removeStop(index)" class="absolute top-4 right-4 text-red-400 hover:scale-110 transition-transform">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                                <div class="grid grid-cols-2 gap-3">
                                    <select v-model="stop.city" class="bg-slate-800 border border-slate-600 rounded-xl p-2 text-sm text-slate-100 outline-none">
                                        <option value="" disabled>Город</option>
                                        <option v-for="c in cities" :key="'stop-city-'+c.id" :value="c.name">{{ c.name }}</option>
                                    </select>
                                    <input v-model="stop.time" type="time" class="bg-slate-800 border border-slate-600 rounded-xl p-2 text-sm text-slate-100 outline-none" />
                                </div>
                                <input v-model="stop.address" placeholder="Адрес / Терминал" class="bg-slate-800 border border-slate-600 rounded-xl p-2 text-xs text-slate-400 outline-none w-full" />
                            </div>
                        </div>
                    </div>

                    <!-- Passenger Comments -->
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Комментарии для пассажиров</label>
                        <textarea v-model="busForm.passenger_comments" rows="2" placeholder="Удобства, правила багажа и т.д."
                            class="w-full bg-slate-700/50 border border-slate-600 rounded-3xl p-6 text-slate-300 outline-none focus:border-amber-500 transition-all resize-none shadow-inner"></textarea>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex justify-end pt-4">
                         <button 
                            @click="submitBusTicket" 
                            :disabled="loading"
                            class="px-12 py-4 rounded-2xl bg-amber-500 text-slate-900 font-bold text-lg shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                        >
                            <span v-if="loading" class="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span>
                            {{ loading ? 'Создание...' : 'Опубликовать рейс' }}
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 overflow-x-auto shadow-sm">
                    <table class="w-full text-left min-w-[900px]">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Маршрут</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Компания</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Дата/Время</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Свободно</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold">Цена</th>
                                <th class="px-6 py-4 text-slate-500 font-semibold text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="ticket in busTickets" :key="ticket.id" @click="openBusTicketBookings(ticket)" class="hover:bg-amber-50 cursor-pointer transition-colors text-slate-700">
                                <td class="px-6 py-4">
                                    <div class="flex flex-col">
                                        <span class="font-bold text-slate-800 flex items-center gap-1.5">
                                            {{ ticket.from_city }}
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                                            {{ ticket.to_city }}
                                        </span>
                                        <span class="text-xs text-slate-400">{{ ticket.from_address }}</span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm">{{ ticket.transport_company }}</td>
                                <td class="px-6 py-4 font-mono text-sm text-slate-500">{{ ticket.departure_date }} {{ ticket.departure_time }}</td>
                                <td class="px-6 py-4">
                                     <span class="text-amber-600 font-bold">{{ ticket.total_seats }}</span>
                                </td>
                                <td class="px-6 py-4 font-bold text-emerald-600">{{ ticket.price }} с.</td>
                                <td class="px-6 py-4 text-right" @click.stop>
                                    <button @click.stop="deleteBusTicket(ticket.id)" class="text-red-500 hover:text-red-600 transition-colors text-sm font-bold">Удалить</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>


            </section>

            <!-- Passengers Data Section -->
            <section v-if="activeTab === 'passengers'" class="space-y-6 lg:space-y-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    <div>
                        <h2 class="text-2xl lg:text-3xl font-bold">Данные пассажиров</h2>
                        <p class="text-slate-500 mt-1">Все пассажиры из всех бронирований</p>
                    </div>
                    <button @click="exportPassengersExcel" :disabled="passengersData.length === 0"
                        class="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Экспорт .xlsx
                    </button>
                </div>

                <div v-if="passengersLoading" class="flex items-center justify-center py-20">
                    <span class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></span>
                </div>

                <div v-else-if="passengersData.length === 0" class="text-center py-20 text-slate-400">
                    <p class="text-lg font-medium">Нет данных о пассажирах</p>
                </div>

                <div v-else class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 overflow-x-auto shadow-sm">
                    <table class="w-full text-left min-w-[1400px]">
                        <thead class="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                            <tr>
                                <th class="px-4 py-4">#</th>
                                <th class="px-4 py-4">ФИО</th>
                                <th class="px-4 py-4">Пол</th>
                                <th class="px-4 py-4">Дата рождения</th>
                                <th class="px-4 py-4">Документ</th>
                                <th class="px-4 py-4">Гражданство</th>
                                <th class="px-4 py-4">Телефон</th>
                                <th class="px-4 py-4">Место</th>
                                <th class="px-4 py-4">Посадка</th>
                                <th class="px-4 py-4">Высадка</th>
                                <th class="px-4 py-4">Маршрут</th>
                                <th class="px-4 py-4">Дата рейса</th>
                                <th class="px-4 py-4">Перевозчик</th>
                                <th class="px-4 py-4">Сумма</th>
                                <th class="px-4 py-4">Оплата</th>
                                <th class="px-4 py-4">Дата брони</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="(p, idx) in passengersData" :key="idx" class="hover:bg-slate-50/50 transition-colors text-slate-700 text-sm">
                                <td class="px-4 py-3 text-slate-400 font-mono text-xs">{{ idx + 1 }}</td>
                                <td class="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{{ p.lastName }} {{ p.firstName }} {{ p.middleName }}</td>
                                <td class="px-4 py-3 text-xs font-bold uppercase text-slate-500">{{ p.gender === 'male' ? 'Муж' : p.gender === 'female' ? 'Жен' : '—' }}</td>
                                <td class="px-4 py-3 text-xs font-mono text-slate-500">{{ p.birthDate || '—' }}</td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.docType }} {{ p.docNumber }}</td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.citizenship || '—' }}</td>
                                <td class="px-4 py-3 text-xs font-mono text-slate-500">{{ p.phone }}</td>
                                <td class="px-4 py-3"><span class="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-black border border-amber-100">{{ p.seatNumbers }}</span></td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.pickup_city }}</td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.drop_off_city }}</td>
                                <td class="px-4 py-3 text-xs font-bold text-slate-600 whitespace-nowrap">{{ p.from_city }} → {{ p.to_city }}</td>
                                <td class="px-4 py-3 text-xs font-mono text-slate-500">{{ p.departure_date }} {{ p.departure_time }}</td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.transport_company }}</td>
                                <td class="px-4 py-3 text-xs font-bold font-mono">{{ p.total_price }} с.</td>
                                <td class="px-4 py-3">
                                    <span class="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border"
                                        :class="{
                                            'bg-blue-50 text-blue-600 border-blue-100': p.paymentStatus === 'Ручная',
                                            'bg-emerald-50 text-emerald-600 border-emerald-100': p.paymentStatus === 'Оплачено',
                                            'bg-amber-50 text-amber-600 border-amber-100': p.paymentStatus === 'Ожидает оплаты'
                                        }">{{ p.paymentStatus }}</span>
                                </td>
                                <td class="px-4 py-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">{{ p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

             <!-- Reviews Section -->
             <section v-if="activeTab === 'reviews'" class="space-y-6 lg:space-y-8">
                <h2 class="text-2xl lg:text-3xl text-slate-900 font-bold">Управление отзывами</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                    <div v-for="review in reviews" :key="review.id" class="bg-white p-5 lg:p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 relative group shadow-sm">
                        <button @click="deleteReview(review.id)" class="absolute top-4 right-4 lg:top-6 lg:right-6 p-2 rounded-xl bg-red-50 text-red-500 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div class="flex items-center space-x-4 mb-4">
                            <div class="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-xl text-amber-500 border border-slate-200">
                                {{ review.reviewer_name?.[0] }}
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-800">{{ review.reviewer_name }}</h4>
                                <p class="text-sm text-slate-500">Для водителя <span class="text-slate-700 font-medium">{{ review.driver_name }}</span></p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-1 text-amber-500 mb-3">
                            <span v-for="i in 5" :key="i" :class="i <= review.rating ? 'opacity-100' : 'opacity-20'">★</span>
                        </div>
                        <p class="text-slate-600 italic">"{{ review.comment }}"</p>
                    </div>
                </div>
            </section>

            <!-- Polls & Feedback Section -->
            <section v-if="activeTab === 'polls'" class="space-y-8 text-slate-900">
                <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div>
                        <h2 class="text-2xl lg:text-3xl text-slate-900 font-bold">Опросы и обратная связь</h2>
                        <p class="text-sm text-slate-500">Настройка вопросов для пользователей, прервавших покупку, и просмотр их ответов</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    <!-- Left: Poll Settings Card -->
                    <div class="lg:col-span-1 bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-6 self-start">
                        <div class="border-b border-slate-100 pb-4">
                            <h3 class="font-bold text-lg text-slate-800">Настройки опроса</h3>
                            <p class="text-xs text-slate-400">Этот опрос будет автоматически отправлен пользователям в бот</p>
                        </div>
                        <div v-if="pollSettingsLoading" class="flex justify-center py-10">
                            <span class="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                        </div>
                        <div v-else class="space-y-4">
                            <!-- Question -->
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Текст вопроса</label>
                                <textarea v-model="pollSettings.question" rows="3" placeholder="Напр. Что помешало вам завершить покупку?" class="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all"></textarea>
                            </div>
                            <!-- Option 1 -->
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Вариант 1 (Кнопка)</label>
                                <input v-model="pollSettings.option1" placeholder="Вариант ответа 1" class="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all" />
                            </div>
                            <!-- Option 2 -->
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Вариант 2 (Кнопка)</label>
                                <input v-model="pollSettings.option2" placeholder="Вариант ответа 2" class="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all" />
                            </div>
                            <!-- Option 3 -->
                            <div class="space-y-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Вариант 3 (Кнопка)</label>
                                <input v-model="pollSettings.option3" placeholder="Вариант ответа 3" class="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all" />
                            </div>
                            <!-- Option 4 (Fixed) -->
                            <div class="space-y-1 opacity-75">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Вариант 4 (Фиксированный)</label>
                                <div class="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl p-3.5 text-sm font-medium">
                                    Ваш вариант (напишите, что именно помешало)
                                </div>
                            </div>
                            <!-- Save Button -->
                            <button @click="savePollSettings" :disabled="savingPollSettings" class="w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-sm hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2">
                                <span v-if="savingPollSettings" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Сохранить изменения
                            </button>
                        </div>
                    </div>

                    <!-- Right: Answers List -->
                    <div class="lg:col-span-2 space-y-4">
                        <div class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                            <h3 class="font-bold text-lg text-slate-800 mb-2">Ответы пользователей ({{ pollAnswers.length }})</h3>
                            <p class="text-xs text-slate-400">Ответы, полученные от клиентов в Telegram боте</p>
                        </div>

                        <div v-if="pollAnswersLoading" class="flex justify-center py-20">
                            <span class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                        </div>

                        <div v-else-if="pollAnswers.length === 0" class="bg-white p-12 rounded-[28px] border border-slate-100 text-center space-y-3">
                            <div class="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-400 text-2xl">💬</div>
                            <h4 class="font-bold text-slate-700">Нет ответов</h4>
                            <p class="text-sm text-slate-400">Пользователи еще не ответили на опросы.</p>
                        </div>

                        <div v-else class="space-y-4">
                            <div v-for="ans in pollAnswers" :key="ans.id" class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 justify-between items-start">
                                <div class="space-y-3 flex-1">
                                    <!-- User and Date info -->
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center font-bold text-amber-600 text-sm">
                                            {{ ans.users?.name?.[0] || 'П' }}
                                        </div>
                                        <div>
                                            <div class="font-bold text-slate-800 text-sm">
                                                {{ ans.users?.name || 'Пользователь #' + ans.user_id }}
                                            </div>
                                            <div class="text-[10px] text-slate-400 font-medium">
                                                Телефон: {{ ans.users?.phone || 'Не указан' }} • TG ID: {{ ans.telegram_id }}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Selected Answer -->
                                    <div class="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                        <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ответ клиента</div>
                                        <p class="text-sm font-bold text-slate-800 leading-relaxed">
                                            {{ ans.answer }}
                                        </p>
                                    </div>

                                    <!-- Booking details context -->
                                    <div v-if="ans.bus_ticket_bookings" class="text-xs text-slate-500 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 flex flex-wrap gap-x-4 gap-y-1">
                                        <span><b>Бронь:</b> #{{ ans.booking_id }}</span>
                                        <span><b>Пассажиров:</b> {{ ans.bus_ticket_bookings.passenger_count }}</span>
                                        <span><b>Сумма:</b> {{ ans.bus_ticket_bookings.total_price }} сом</span>
                                        <span v-if="ans.bus_ticket_bookings.bus_tickets">
                                            <b>Рейс:</b> {{ ans.bus_ticket_bookings.bus_tickets.from_city }} ➡ {{ ans.bus_ticket_bookings.bus_tickets.to_city }} ({{ ans.bus_ticket_bookings.bus_tickets.departure_date }} {{ ans.bus_ticket_bookings.bus_tickets.departure_time?.substring(0, 5) }})
                                        </span>
                                    </div>
                                </div>

                                <div class="text-right flex flex-col items-end gap-2 self-stretch justify-between md:self-auto">
                                    <span class="text-[10px] text-slate-400 font-semibold bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                                        {{ new Date(ans.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- User Edit Modal -->
            <div v-if="showUserEditModal" class="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="max-w-md w-full bg-white p-8 rounded-[32px] border border-slate-100 shadow-2xl">
                    <h3 class="text-2xl font-bold mb-6 text-slate-900">Редактировать пользователя</h3>
                    <div class="space-y-4">
                        <input v-model="editingUser.name" placeholder="Имя" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                        <input v-model="editingUser.surname" placeholder="Фамилия" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                        <input v-model="editingUser.phone" placeholder="Телефон" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                    </div>
                    <div class="flex space-x-4 mt-8">
                        <button @click="showUserEditModal = false" class="flex-1 py-4 text-slate-400 font-bold">Отмена</button>
                        <button @click="updateUser" class="flex-1 bg-amber-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-amber-500/20">Сохранить</button>
                    </div>
                </div>
            </div>

            <!-- Ride Edit Modal -->
            <div v-if="showRideEditModal" class="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="max-w-md w-full bg-white p-8 rounded-[32px] border border-slate-100 shadow-2xl">
                    <h3 class="text-2xl font-bold mb-6 text-slate-900">Редактировать поездку</h3>
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <input v-model="editingRide.from_city" placeholder="Откуда" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                            <input v-model="editingRide.to_city" placeholder="Куда" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                        </div>
                        <input v-model="editingRide.date" type="date" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                        <input v-model="editingRide.time" type="time" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                        <input v-model="editingRide.price" type="number" placeholder="Цена" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-amber-500 text-slate-900" />
                    </div>
                    <div class="flex space-x-4 mt-8">
                        <button @click="showRideEditModal = false" class="flex-1 py-4 text-slate-400 font-bold">Отмена</button>
                        <button @click="updateRide" class="flex-1 bg-amber-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-amber-500/20">Сохранить</button>
                    </div>
                </div>
            </div>

        </main>

        <!-- ── GLOBAL DRILL-DOWN OVERLAYS ── -->
        
        <!-- Driver Detail Overlay -->
        <div v-if="selectedBusDriver" class="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-center" @click.self="closeBusDriverDetail">
            <div class="w-full bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
                <div class="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center gap-4 z-10">
                    <button @click="closeBusDriverDetail" class="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div>
                        <h3 class="text-xl font-black text-slate-900">{{ selectedBusDriver.name }} {{ selectedBusDriver.surname }}</h3>
                        <p class="text-sm text-slate-400 font-mono">{{ selectedBusDriver.phone }} · Сбор: {{ selectedBusDriver.service_fee_percent ?? 10 }}%</p>
                    </div>
                    <span v-if="selectedBusDriver.is_blocked" class="ml-auto bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100">Заблокирован</span>
                </div>
                <div class="p-8 flex-1">
                    <div v-if="driverDetailLoading" class="flex items-center justify-center py-20">
                        <span class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></span>
                    </div>
                    <div v-else-if="selectedBusDriverTickets.length === 0" class="text-center py-20 text-slate-400">
                        <p class="text-lg font-medium">У этого водителя нет рейсов</p>
                    </div>
                    <div v-else class="overflow-x-auto rounded-2xl border border-slate-100">
                        <table class="w-full text-left min-w-[800px]">
                            <thead class="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 font-bold tracking-widest">
                                <tr>
                                    <th class="px-5 py-4">Маршрут</th>
                                    <th class="px-5 py-4">Компания</th>
                                    <th class="px-5 py-4">Дата / Время</th>
                                    <th class="px-5 py-4">Мест (своб./всего)</th>
                                    <th class="px-5 py-4">Бронь (всего)</th>
                                    <th class="px-5 py-4">Ручная</th>
                                    <th class="px-5 py-4">Оплачено</th>
                                    <th class="px-5 py-4">Ожидает</th>
                                    <th class="px-5 py-4">Цена</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-50">
                                <tr v-for="ticket in selectedBusDriverTickets" :key="ticket.id"
                                    @click="openBusTicketBookings(ticket)"
                                    class="hover:bg-amber-50 cursor-pointer transition-colors text-slate-700">
                                    <td class="px-5 py-4">
                                        <div class="font-bold text-slate-800 flex items-center gap-1.5">
                                            {{ ticket.from_city }}
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                                            {{ ticket.to_city }}
                                        </div>
                                        <div class="text-xs text-slate-400">{{ ticket.from_address }}</div>
                                    </td>
                                    <td class="px-5 py-4 text-sm text-slate-600">{{ ticket.transport_company }}</td>
                                    <td class="px-5 py-4 font-mono text-sm text-slate-500">{{ ticket.departure_date }} {{ ticket.departure_time }}</td>
                                    <td class="px-5 py-4">
                                        <span class="font-bold" :class="ticket.free_seats === 0 ? 'text-red-500' : 'text-emerald-600'">{{ ticket.free_seats }}</span>
                                        <span class="text-slate-400"> / {{ ticket.total_seats }}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class="font-bold text-slate-900">{{ ticket.total_booked || 0 }}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-100">{{ ticket.manual_booked || 0 }}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-100">{{ ticket.paid_booked || 0 }}</span>
                                    </td>
                                    <td class="px-5 py-4">
                                        <span class="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-100">{{ ticket.pending_booked || 0 }}</span>
                                    </td>
                                    <td class="px-5 py-4 font-bold text-emerald-600">{{ ticket.price }} с.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Booking Manifest Overlay -->
        <div v-if="selectedBusTicket" class="fixed inset-0 z-[210] bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-center" @click.self="closeBusTicketBookings">
            <div class="w-full bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
                <div class="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center gap-4 z-10">
                    <button @click="closeBusTicketBookings" class="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div>
                        <h3 class="text-xl font-black text-slate-900">{{ selectedBusTicket.from_city }} → {{ selectedBusTicket.to_city }}</h3>
                        <p class="text-sm text-slate-400">{{ selectedBusTicket.transport_company }} · {{ selectedBusTicket.departure_date }} {{ selectedBusTicket.departure_time }}</p>
                    </div>
                    <div class="ml-auto flex items-center gap-3">
                        <span class="text-sm font-bold text-slate-500">{{ selectedBusTicketBookings.length }} бронирований</span>
                        <button 
                            v-if="selectedBusTicketBookings.length > 0"
                            @click="exportSelectedTicketManifestExcel"
                            class="px-3.5 py-2 bg-emerald-500 text-white font-bold rounded-xl shadow-md hover:bg-emerald-600 transition-all flex items-center gap-1.5 text-xs"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            Экспорт .xlsx
                        </button>
                    </div>
                </div>
                <div class="p-8 flex-1 overflow-x-auto">
                    <div v-if="ticketBookingsLoading" class="flex items-center justify-center py-20">
                        <span class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></span>
                    </div>
                    <div v-else-if="selectedBusTicketBookings.length === 0" class="text-center py-20 text-slate-400">
                        <p class="text-lg font-medium">Нет бронирований для этого рейса</p>
                    </div>
                    <table v-else class="w-full text-left min-w-[1100px]">
                        <thead class="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                            <tr>
                                <th class="px-4 py-4">#</th>
                                <th class="px-4 py-4">ФИО</th>
                                <th class="px-4 py-4">Место</th>
                                <th class="px-4 py-4">Пол</th>
                                <th class="px-4 py-4">Дата рождения</th>
                                <th class="px-4 py-4">Документ</th>
                                <th class="px-4 py-4">Гражданство</th>
                                <th class="px-4 py-4">Маршрут (П/В)</th>
                                <th class="px-4 py-4">Контакт</th>
                                <th class="px-4 py-4">Оплата</th>
                                <th class="px-4 py-4">Дата выставления счета</th>
                                <th class="px-4 py-4">Действия</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            <tr v-for="(p, idx) in passengerManifestForBookings(selectedBusTicketBookings)" :key="idx" class="hover:bg-slate-50/50 transition-colors text-slate-700 text-sm">
                                <td class="px-4 py-3 text-slate-400 font-mono text-xs">{{ idx + 1 }}</td>
                                <td class="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{{ p.lastName }} {{ p.firstName }} {{ p.middleName }}</td>
                                <td class="px-4 py-3"><span class="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-black border border-amber-100">{{ p.seat }}</span></td>
                                <td class="px-4 py-3 text-xs font-bold uppercase text-slate-500">{{ p.gender === 'male' ? 'Муж' : p.gender === 'female' ? 'Жен' : '—' }}</td>
                                <td class="px-4 py-3 text-xs font-mono text-slate-500">{{ p.birthDate || '—' }}</td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.docType }} {{ p.docNumber }}</td>
                                <td class="px-4 py-3 text-xs text-slate-500">{{ p.citizenship || '—' }}</td>
                                <td class="px-4 py-3">
                                    <div class="text-[10px] text-slate-500 font-bold uppercase">{{ p.pickup_city || '—' }}</div>
                                    <div class="text-[10px] text-amber-600 font-black uppercase">{{ p.drop_off_city || '—' }}</div>
                                </td>
                                <td class="px-4 py-3 text-xs font-mono text-slate-700">{{ p.contactPhone || '—' }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border"
                                        :class="{
                                            'bg-blue-50 text-blue-600 border-blue-100': p.paymentStatus === 'Ручная',
                                            'bg-emerald-50 text-emerald-600 border-emerald-100': p.paymentStatus === 'Оплачено',
                                            'bg-amber-50 text-amber-600 border-amber-100': p.paymentStatus === 'Ожидает оплаты'
                                        }">{{ p.paymentStatus }}</span>
                                </td>
                                <td class="px-4 py-3">
                                    <span class="text-[10px] text-slate-500 font-mono whitespace-nowrap">{{ p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : '—' }}</span>
                                </td>
                                <td class="px-4 py-3">
                                    <button @click="deleteAdminBooking(p.originalBookingId)" class="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Удалить бронь">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Passenger Journey Timeline Modal (Phase P.1F) -->
        <div v-if="showTimelineModal" class="fixed inset-0 z-[220] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" @click.self="closePassengerTimeline">
            <div class="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-lg font-black text-slate-900">Путь пассажира</h3>
                            <span v-if="timelineData?.booking?.status" class="px-2 py-0.5 rounded text-[10px] font-black uppercase border" :class="getFunnelStatusBadgeClass(timelineData.booking.status)">
                                {{ getFunnelStatusLabel(timelineData.booking.status) }}
                            </span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                            {{ timelineData?.booking?.passenger_name || timelineData?.booking?.passengerName }} · {{ timelineData?.booking?.masked_phone || timelineData?.booking?.maskedPhone }} · Бронь #{{ formatShortBookingId(selectedTimelineBooking) }}
                        </p>
                    </div>
                    <button @click="closePassengerTimeline" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Timeline Body -->
                <div class="p-6 overflow-y-auto flex-1 space-y-6">
                    <div v-if="timelineLoading" class="flex items-center justify-center py-16">
                        <span class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></span>
                    </div>
                    <div v-else-if="!timelineData || !timelineData.events || timelineData.events.length === 0" class="text-center py-12 text-slate-400">
                        События для этой брони не зафиксированы
                    </div>
                    <div v-else class="relative pl-6 border-l-2 border-slate-200 space-y-6 ml-3">
                        <div 
                            v-for="ev in timelineData.events" 
                            :key="ev.id"
                            class="relative group"
                        >
                            <!-- Dot / Icon -->
                            <div class="absolute -left-[35px] top-0 w-8 h-8 rounded-full bg-white border-2 border-slate-200 group-hover:border-amber-500 flex items-center justify-center text-sm shadow-sm transition-colors">
                                {{ getEventIcon(ev.event_type) }}
                            </div>
                            <!-- Content -->
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-amber-200 transition-colors">
                                <div class="flex items-center justify-between mb-1">
                                    <h5 class="text-xs font-bold text-slate-900">{{ getEventTitle(ev.event_type) }}</h5>
                                    <span class="text-[10px] font-mono text-slate-400">{{ formatTimelineDate(ev.created_at) }}</span>
                                </div>
                                <div class="text-[11px] text-slate-500 space-y-1">
                                    <div v-if="ev.channel" class="flex items-center gap-1.5">
                                        <span class="font-semibold text-slate-600">Канал:</span>
                                        <span class="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-mono">{{ ev.channel }}</span>
                                    </div>
                                    <div v-if="ev.actor_role" class="flex items-center gap-1.5">
                                        <span class="font-semibold text-slate-600">Действующее лицо:</span>
                                        <span class="text-slate-600">{{ ev.actor_role }}</span>
                                    </div>
                                    <div v-if="ev.metadata && Object.keys(ev.metadata).length > 0" class="mt-1 text-[10px] text-slate-400 font-mono bg-white p-2 rounded-lg border border-slate-100">
                                        <div v-for="(v, k) in ev.metadata" :key="k">
                                            <span class="text-slate-500">{{ k }}:</span> {{ v }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <button @click="closePassengerTimeline" class="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>

        <!-- Phone Mismatch Claim Review Modal (Phase P.1F) -->
        <div v-if="showReviewModal" class="fixed inset-0 z-[230] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" @click.self="closeReviewModal">
            <div class="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                <div class="px-6 py-5 border-b border-slate-100 bg-rose-50/50 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-rose-500 text-lg">⚠️</span>
                        <h3 class="text-base font-black text-rose-900">Проверка несовпадения номера</h3>
                    </div>
                    <button @click="closeReviewModal" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <div class="p-6 space-y-4">
                    <div v-if="reviewSuccessMessage" class="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold text-center">
                        {{ reviewSuccessMessage }}
                    </div>

                    <div v-else class="space-y-4">
                        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <div class="flex justify-between">
                                <span class="text-slate-400">Пассажир:</span>
                                <span class="font-bold text-slate-800">{{ selectedClaimReview?.passenger_name || selectedClaimReview?.passengerName }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-400">Телефон в брони:</span>
                                <span class="font-mono font-bold text-slate-800">{{ selectedClaimReview?.masked_phone || selectedClaimReview?.maskedPhone || '—' }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-400">Рейс:</span>
                                <span class="text-slate-700">{{ selectedClaimReview?.route }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-400">Перевозчик:</span>
                                <span class="text-slate-700">{{ selectedClaimReview?.carrier_name || selectedClaimReview?.carrierName }}</span>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-2">Решение администратора платформы:</label>
                            <div class="grid grid-cols-2 gap-3">
                                <label 
                                    class="p-3 rounded-2xl border cursor-pointer flex items-center gap-2 text-xs font-bold transition-all"
                                    :class="reviewDecision === 'approved' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'border-slate-200 text-slate-600'"
                                >
                                    <input type="radio" v-model="reviewDecision" value="approved" class="text-emerald-500" />
                                    <span>Одобрить (привязать)</span>
                                </label>
                                <label 
                                    class="p-3 rounded-2xl border cursor-pointer flex items-center gap-2 text-xs font-bold transition-all"
                                    :class="reviewDecision === 'rejected' ? 'bg-rose-50 border-rose-500 text-rose-800' : 'border-slate-200 text-slate-600'"
                                >
                                    <input type="radio" v-model="reviewDecision" value="rejected" class="text-rose-500" />
                                    <span>Отклонить</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Причина / Комментарий:</label>
                            <textarea 
                                v-model="reviewReason" 
                                rows="3" 
                                placeholder="Например: подтверждено администратором по обращению пассажира" 
                                class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 outline-none focus:border-amber-500"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div v-if="!reviewSuccessMessage" class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                    <button 
                        @click="closeReviewModal" 
                        class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                    >
                        Отмена
                    </button>
                    <button 
                        @click="submitClaimReview" 
                        :disabled="reviewSubmitting"
                        class="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <span v-if="reviewSubmitting" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Применить решение</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.admin-panel {
    background-color: #f8fafc;
}
/* Hide scrollbar for Chrome, Safari and Opera */
main::-webkit-scrollbar {
    display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
main {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
