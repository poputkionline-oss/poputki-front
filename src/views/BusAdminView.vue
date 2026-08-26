<script>
import api from '../api';
import AppLogo from '../components/AppLogo.vue';
import { exportPassengerManifestExcel, sortPassengersBySeat } from '../utils/excelExport';
import { compressImage } from '../utils/imageCompression';
import { uploadToCloudinaryDirect } from '../utils/cloudinary';
import { copyToClipboard } from '../telegram';
import BusSeatSelector from '../components/BusSeatSelector.vue';
import CarrierBoarding from '../components/carrier/CarrierBoarding.vue';
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
        CarrierBoarding
    },
    async mounted() {
        const savedUser = localStorage.getItem('busUser');
        const savedJwt = localStorage.getItem('carrierJwt');
        if (savedUser && savedJwt) {
            try {
                this.user = JSON.parse(savedUser);
                this.isAuthenticated = true;
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
                accept_terms: true
            },
            busErrors: {},
            mobileMenuOpen: false,
            navItems: [
                { id: 'dashboard', label: 'Дашборд' },
                { id: 'boarding', label: 'Посадка' },
                { id: 'tickets', label: 'Мои рейсы' },
                { id: 'create', label: 'Создать рейс' },
                { id: 'create-booking', label: 'Создать бронь' },
                { id: 'bookings', label: 'Бронирования' },
                { id: 'crm', label: 'CRM Пассажиров' }
            ],
            bookingSearch: '',
            crmSearch: '',
            isEditingTicket: false,
            editingTicketId: null,
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
            }
            await Promise.all(promises);
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
            if (!this.busForm.transport_company.trim()) e.transport_company = 'Укажите компанию';
            if (!this.busForm.from_city) e.from_city = 'Укажите город отправления';
            if (!this.busForm.from_address.trim()) e.from_address = 'Укажите место отправления';
            if (!this.busForm.to_city) e.to_city = 'Укажите город прибытия';
            if (!this.busForm.to_address.trim()) e.to_address = 'Укажите место прибытия';
            if (!this.busForm.departure_date) e.departure_date = 'Укажите дату отправления';
            if (!this.busForm.departure_time) e.departure_time = 'Укажите время отправления';
            if (!this.busForm.arrival_time) e.arrival_time = 'Укажите время прибытия';
            if (!this.busForm.duration_hours || this.busForm.duration_hours <= 0) e.duration_hours = 'Укажите длительность (в часах)';
            if (!this.busForm.price || this.busForm.price <= 0) e.price = 'Укажите цену';
            if (this.busForm.bus_type === 'double') {
                if (!this.busForm.floor1_seats || this.busForm.floor1_seats < 1) e.floor1_seats = 'Укажите кол-во мест 1 этажа';
                if (!this.busForm.floor2_seats || this.busForm.floor2_seats < 1) e.floor2_seats = 'Укажите кол-во мест 2 этажа';
            } else {
                if (!this.busForm.total_seats || this.busForm.total_seats < 1) e.total_seats = 'Укажите количество мест';
            }
            if (!this.busForm.accept_terms) e.accept_terms = 'Необходимо согласиться с условиями использования и публичной офертой';
            
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
                const submitData = {
                    ...this.busForm,
                    operator_id: this.user.id,
                    duration_minutes: Number(this.busForm.duration_hours) * 60,
                    price: Number(this.busForm.price),
                    premium_price: this.busForm.premium_price ? Number(this.busForm.premium_price) : null,
                    photos: this.busForm.photos
                };
                if (this.busForm.bus_type === 'double') {
                    submitData.floor1_seats = Number(this.busForm.floor1_seats);
                    submitData.floor2_seats = Number(this.busForm.floor2_seats);
                    submitData.total_seats = submitData.floor1_seats + submitData.floor2_seats;
                } else {
                    submitData.total_seats = Number(this.busForm.total_seats);
                    submitData.floor1_seats = null;
                    submitData.floor2_seats = null;
                    submitData.premium_price = null;
                }
                await api.post('/bus-tickets', submitData);
                alert('Рейс успешно создан!');
                
                // Reset form
                this.busForm = {
                    transport_company: '', from_city: '', from_address: '',
                    to_city: '', to_address: '', departure_date: '',
                    departure_time: '', arrival_date: '', arrival_time: '',
                    arrival_time: '',
                    duration_hours: '',
                    price: '',
                    floor1_seats: 20, floor2_seats: 56,
                    bus_type: 'single', passenger_comments: '',
                    intermediate_stops: [],
                    photos: [],
                    accept_terms: true
                };
                
                this.activeTab = 'tickets';
            } catch (e) {
                alert(e.response?.data?.error || 'Ошибка при создании');
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
            this.busForm = { 
                ...ticket,
                duration_hours: ticket.duration_minutes ? (ticket.duration_minutes / 60).toFixed(1) : '',
                intermediate_stops: ticket.intermediate_stops || [],
                photos: ticket.photos || []
            };
            this.activeTab = 'create';
        },
        async updateBusTicket() {
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
                if (f.bus_type === 'double') {
                    updateData.floor1_seats = Number(f.floor1_seats);
                    updateData.floor2_seats = Number(f.floor2_seats);
                    updateData.total_seats = updateData.floor1_seats + updateData.floor2_seats;
                } else {
                    updateData.total_seats = Number(f.total_seats);
                    updateData.floor1_seats = null;
                    updateData.floor2_seats = null;
                    updateData.premium_price = null;
                }
                await api.put(`/bus-admin/tickets/${this.editingTicketId}`, updateData);
                alert('Рейс успешно обновлен!');
                this.isEditingTicket = false;
                this.editingTicketId = null;
                this.activeTab = 'tickets';
                this.fetchTickets();
            } catch (e) { console.error('Update error:', e.response?.data || e); alert('Ошибка при обновлении: ' + (e.response?.data?.error || e.message)); } finally { this.loading = false; }
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
                this.bookingForm = {
                    bus_ticket_id: '',
                    passenger_count: 1,
                    passengers_data: [{ lastName: '', firstName: '', middleName: '', gender: 'male', docType: 'Загранпаспорт', docNumber: '', birthDate: '', citizenship: 'Таджикистан', phone: '', seatNumber: '' }],
                    pickup_city: '',
                    drop_off_city: ''
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
        }
    },
watch: {
        selectedManualSeats(newVal) {
            const currentPassengers = [...this.bookingForm.passengers_data];
            const newPassengers = [];
            
            newVal.forEach(seatNum => {
                const existing = currentPassengers.find(p => String(p.seatNumber) === String(seatNum));
                if (existing) {
                    newPassengers.push(existing);
                } else {
                    newPassengers.push({
                        lastName: '', firstName: '', middleName: '', gender: 'male', docType: 'Загранпаспорт', docNumber: '', birthDate: '', citizenship: 'Таджикистан', phone: '', seatNumber: seatNum
                    });
                }
            });
            
            this.bookingForm.passengers_data = newPassengers;
            this.bookingForm.passenger_count = newPassengers.length;
        },
        'bookingForm.bus_ticket_id'() {
            this.selectedManualSeats = [];
            this.showManualForm = false;
        },
        activeTab(newTab) {
            if (newTab === 'create-booking' && !this.isEditingBooking) {
                this.showManualForm = false;
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
                        v-for="item in navItems" 
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
                <section v-if="activeTab === 'dashboard'" class="space-y-6 lg:space-y-10">
                    <div class="flex justify-between items-end">
                        <div>
                            <h2 class="text-3xl font-bold text-slate-900">Дашборд</h2>
                            <p class="text-slate-500 mt-2 uppercase tracking-widest font-black text-xs">Обзор вашей деятельности</p>
                        </div>
                    </div>

                    <!-- Stats Grid -->
                    <div v-if="loading && !stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                        <div v-for="i in 4" :key="'stat-skel-'+i" class="bg-white p-8 rounded-[32px] border border-slate-100 h-32"></div>
                    </div>
                    <div v-else-if="stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Выручка</p>
                            <h3 class="text-3xl font-black text-slate-900">{{ stats.totalRevenue }} <span class="text-lg">с.</span></h3>
                        </div>
                        <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm border-l-4 border-amber-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Всего броней</p>
                            <h3 class="text-3xl font-black text-amber-500">{{ stats.totalBookings }}</h3>
                        </div>
                        <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Активные рейсы</p>
                            <h3 class="text-3xl font-black text-slate-900">{{ stats.activeRides }}</h3>
                        </div>
                        <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm border-l-4 border-emerald-500">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Сред. загрузка</p>
                            <h3 class="text-3xl font-black text-emerald-500">{{ stats.avgFillRate }} <span class="text-lg">%</span></h3>
                        </div>
                    </div>

                    <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <!-- Daily Bookings Chart -->
                        <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                            <h4 class="text-lg font-bold mb-6 text-slate-800">Динамика бронирований</h4>
                            <div class="h-[300px]">
                                <LineChart :data="dailyBookingsChartData" :options="chartOptions" />
                            </div>
                        </div>

                        <!-- Routes and Distribution -->
                        <div class="space-y-8">
                            <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                <h4 class="text-lg font-bold mb-6 text-slate-800">Популярные маршруты</h4>
                                <div class="space-y-4">
                                    <div v-for="r in stats.popularRoutes" :key="r.route" class="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                                        <span class="font-bold text-slate-700">{{ r.route }}</span>
                                        <span class="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-black">{{ r.count }} рейсов</span>
                                    </div>
                                    <div v-if="!stats.popularRoutes || stats.popularRoutes.length === 0" class="text-center text-slate-300 py-4">Нет данных</div>
                                </div>
                            </div>

                            <div class="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-8">
                                <div class="h-32 w-32 shrink-0">
                                    <PieChart :data="fillRateChartData" :options="pieOptions" />
                                </div>
                                <div>
                                    <h4 class="text-lg font-bold text-slate-800 mb-1">Загрузка мест</h4>
                                    <p class="text-sm text-slate-400">Средний показатель наполняемости ваших автобусов</p>
                                </div>
                            </div>
                        </div>
                    </div>
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
                                     <button @click="editTicket(ticket)" class="p-2.5 bg-slate-50 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all border border-slate-100" title="Изменить">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                     </button>
                                     <button @click="deleteTicket(ticket.id)" class="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-slate-100" title="Удалить">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                     </button>
                                     <button @click="completeTicket(ticket)" class="px-4 py-2.5 bg-slate-50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-slate-100 text-xs font-bold" title="Завершить рейс">
                                         Завершить рейс
                                     </button>
                                     <button @click="initBooking(ticket.id)" class="px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 text-sm">
                                        Бронировать
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

                <!-- Bookings section -->
                <section v-if="activeTab === 'bookings'" class="space-y-6 lg:space-y-8">
                     <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div>
                            <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">Бронирования</h2>
                            <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">Выберите рейс для просмотра пассажиров</p>
                         </div>
                         <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            <div class="relative w-full sm:w-80">
                                <select v-model="selectedBookingRideId" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-slate-900 shadow-sm appearance-none font-bold">
                                    <option value="">-- Выберите рейс --</option>
                                    <option v-for="t in tickets" :key="t.id" :value="t.id">
                                        {{ t.from_city }} → {{ t.to_city }} ({{ t.departure_date }} {{ t.departure_time }})
                                    </option>
                                </select>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            <div class="relative w-full sm:w-64" v-if="selectedBookingRideId">
                                <input v-model="bookingSearch" placeholder="Поиск по имени..." class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-slate-900 shadow-sm" />
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <button 
                                v-if="selectedBookingRideId && passengerManifest.length > 0"
                                @click="exportToExcel" 
                                class="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Экспорт .xlsx
                            </button>
                         </div>
                     </div>

                      <div v-if="loading" class="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm animate-pulse">
                         <div class="h-16 bg-slate-50 border-b border-slate-100 mb-2"></div>
                         <div class="p-6 space-y-4">
                             <div v-for="i in 5" :key="'booking-skel-'+i" class="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
                                 <div class="h-4 w-8 bg-slate-50 rounded"></div>
                                 <div class="h-4 w-48 bg-slate-50 rounded"></div>
                                 <div class="h-4 w-12 bg-slate-50 rounded"></div>
                                 <div class="h-4 w-24 bg-slate-50 rounded"></div>
                                 <div class="h-4 w-32 bg-slate-50 rounded"></div>
                             </div>
                         </div>
                      </div>
                     <div v-else-if="passengerManifest.length === 0" class="bg-white p-20 rounded-[40px] border border-slate-100 text-center shadow-sm">
                        <div class="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <p class="text-slate-400">На этот рейс пока нет бронирований.</p>
                    </div>
                     <div v-else class="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                                        <th class="px-6 py-5">#</th>
                                        <th class="px-6 py-5">ФИО ПАССАЖИРА</th>
                                        <th class="px-6 py-5">МЕСТО</th>
                                        <th class="px-6 py-5">ПОЛ</th>
                                        <th class="px-6 py-5">ДАТА РОЖДЕНИЯ</th>
                                        <th class="px-6 py-5">ДОКУМЕНТ</th>
                                        <th class="px-6 py-5">ГРАЖДАНСТВО</th>
                                        <th class="px-6 py-5">МАРШРУТ (П/В)</th>
                                        <th class="px-6 py-5">КОНТАКТ</th>
                                        <th class="px-6 py-5">ОПЛАТА</th>
                                        <th class="px-6 py-5">ДАТА ВЫСТАВЛЕНИЯ СЧЕТА</th>
                                        <th class="px-6 py-5">ДЕЙСТВИЯ</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    <tr v-for="(p, idx) in passengerManifest" :key="idx" class="hover:bg-slate-50/20 transition-colors">
                                        <td class="px-6 py-4">
                                            <span class="text-slate-400 font-bold text-[11px]">{{ idx + 1 }}</span>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="font-bold text-slate-900 text-sm whitespace-nowrap">{{ p.lastName }} {{ p.firstName }} {{ p.middleName }}</div>
                                        </td>
                                        <td class="px-6 py-4">
                                            <span class="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-black border border-amber-100/50">{{ p.seat }}</span>
                                        </td>
                                        <td class="px-6 py-4 text-xs text-slate-600 uppercase font-bold tracking-tighter">
                                            {{ p.gender === 'male' ? 'Муж' : (p.gender === 'female' ? 'Жен' : '—') }}
                                        </td>
                                        <td class="px-6 py-4 text-xs text-slate-600 font-medium font-mono tracking-tighter">{{ p.birthDate || '—' }}</td>
                                        <td class="px-6 py-4 text-[11px] text-slate-600 font-medium tracking-tight">
                                            {{ p.docType }} {{ p.docNumber }}
                                         </td>
                                         <td class="px-6 py-4 text-xs text-slate-600 font-medium tracking-tighter">
                                             {{ p.citizenship || '—' }}
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                                                {{ p.pickup_city || '—' }}
                                            </div>
                                            <div class="text-[10px] text-amber-600 uppercase font-black tracking-widest mt-0.5">
                                                {{ p.drop_off_city || '—' }}
                                            </div>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-1.5 whitespace-nowrap">
                                                <span class="text-[11px] font-bold text-slate-900 tracking-tighter">{{ p.contactPhone }}</span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-2">
                                                <span class="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border leading-none inline-block border-slate-100"
                                                    :class="{
                                                        'bg-blue-50 text-blue-600 border-blue-100 mb-1': p.paymentStatus === 'Ручная',
                                                        'bg-emerald-50 text-emerald-600 border-emerald-100': p.paymentStatus === 'Оплачено',
                                                        'bg-amber-50 text-amber-600 border-amber-100': p.paymentStatus === 'Ожидает оплаты'
                                                    }">
                                                    {{ p.paymentStatus }}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4">
                                            <span class="text-[10px] text-slate-500 font-mono whitespace-nowrap">{{ p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : '—' }}</span>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-3">
                                                <button @click="initEditBooking(p.originalBookingId)" class="p-1 text-slate-400 hover:text-amber-500 transition-colors" title="Редактировать">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button @click="deleteBooking(p.originalBookingId)" class="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Удалить бронь">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                <!-- CRM section -->
                <section v-if="activeTab === 'crm'" class="space-y-6 lg:space-y-8">
                     <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div>
                            <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">CRM Пассажиров</h2>
                            <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">База всех ваших пассажиров</p>
                         </div>
                         <div class="relative w-full sm:w-80">
                            <input v-model="crmSearch" placeholder="Поиск по имени или телефону..." class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-slate-900 shadow-sm" />
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                     </div>
                     <div class="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                                        <th class="px-6 py-5">#</th>
                                        <th class="px-6 py-5">ФИО ПАССАЖИРА</th>
                                        <th class="px-6 py-5">ТЕЛЕФОН</th>
                                        <th class="px-6 py-5">ПОЛ</th>
                                        <th class="px-6 py-5">ДАТА РОЖДЕНИЯ</th>
                                        <th class="px-6 py-5">ДОКУМЕНТ</th>
                                        <th class="px-6 py-5">ГРАЖДАНСТВО</th>
                                        <th class="px-6 py-5">ПОСЛЕДНИЙ МАРШРУТ</th>
                                        <th class="px-6 py-5">ДАТА БРОНИ</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    <tr v-for="(p, idx) in crmPassengers" :key="idx" class="hover:bg-slate-50/20 transition-colors">
                                        <td class="px-6 py-4 text-slate-400 font-bold text-[11px]">{{ idx + 1 }}</td>
                                        <td class="px-6 py-4 font-bold text-slate-900 text-sm whitespace-nowrap">{{ p.lastName }} {{ p.firstName }} {{ p.middleName }}</td>
                                        <td class="px-6 py-4 text-[11px] font-bold text-slate-900">{{ p.contactPhone || '—' }}</td>
                                        <td class="px-6 py-4 text-xs text-slate-600 uppercase font-bold">{{ p.gender === 'male' ? 'Муж' : (p.gender === 'female' ? 'Жен' : '—') }}</td>
                                        <td class="px-6 py-4 text-xs text-slate-600 font-medium font-mono">{{ p.birthDate || '—' }}</td>
                                        <td class="px-6 py-4 text-[11px] text-slate-600">{{ p.docType }} {{ p.docNumber }}</td>
                                        <td class="px-6 py-4 text-xs text-slate-600">{{ p.citizenship || '—' }}</td>
                                        <td class="px-6 py-4 text-[10px] text-slate-500 font-bold uppercase">{{ p.route }}</td>
                                        <td class="px-6 py-4 text-[10px] text-slate-500 font-mono">{{ p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : '—' }}</td>
                                    </tr>
                                    <tr v-if="crmPassengers.length === 0">
                                        <td colspan="9" class="px-6 py-8 text-center text-slate-400">Пассажиры не найдены</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                     </div>
                </section>

                <!-- Create Booking Section -->
                <section v-if="activeTab === 'create-booking'" class="space-y-6 lg:space-y-8">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">{{ isEditingBooking ? 'Редактировать бронирование' : 'Создать бронирование вручную' }}</h2>
                        <button v-if="isEditingBooking" @click="isEditingBooking = false; activeTab = 'bookings'" class="text-xs font-bold text-slate-400 hover:text-slate-600">Отмена</button>
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

                <!-- Create Bus Section (Copied from Admin View) -->
                <section v-if="activeTab === 'create'" class="space-y-6 lg:space-y-8 text-slate-900">
                    <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">{{ isEditingTicket ? 'Редактировать рейс' : 'Опубликовать новый рейс' }}</h2>
                    
                    <div class="bg-white rounded-[32px] border border-slate-100 p-6 lg:p-8 shadow-sm space-y-8">
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

                             <!-- Bus Type Selection -->
                             <div class="space-y-2 flex flex-col">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 text-slate-400">Конфигурация автобуса</label>
                                <div class="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                                    <button @click="busForm.bus_type = 'single'; busForm.total_seats = 53"
                                        :class="busForm.bus_type === 'single' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'"
                                        class="flex-1 py-3 rounded-xl font-bold text-xs transition-all tracking-tighter uppercase whitespace-nowrap px-2"
                                    >
                                        Обычный (53)
                                    </button>
                                    <button @click="busForm.bus_type = 'double'; busForm.floor1_seats = 20; busForm.floor2_seats = 56; busForm.total_seats = 76"
                                        :class="busForm.bus_type === 'double' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'"
                                        class="flex-1 py-3 rounded-xl font-bold text-xs transition-all tracking-tighter uppercase whitespace-nowrap px-2"
                                    >
                                        Двухэтажный (76)
                                    </button>
                                </div>
                            </div>

                            <!-- Total Seats & Duration (single-floor) -->
                             <div v-if="busForm.bus_type === 'single'" class="grid grid-cols-2 gap-4">
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

                             <!-- Per-floor Seats & Duration (double-decker) -->
                             <div v-if="busForm.bus_type === 'double'" class="space-y-4">
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

                             <!-- Premium Price -->
                             <div v-if="busForm.bus_type === 'double'" class="space-y-2">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">★ Цена за Премиум-место (с.)</label>
                                <input v-model="busForm.premium_price" type="number" placeholder="0 = нет премиума" 
                                    class="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 font-bold text-xl outline-none focus:border-amber-500 transition-all shadow-inner" />
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
    </div>
</template>
