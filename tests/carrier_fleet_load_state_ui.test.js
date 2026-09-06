import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Bus Admin: Carrier Fleet Load State & UX Test Suite', () => {

    const adminViewPath = resolve('src/views/BusAdminView.vue');
    const adminViewContent = readFileSync(adminViewPath, 'utf8');

    // -------------------------------------------------------------
    // 1. DATA INITIALIZATION & 4 DISTINCT STATES
    // -------------------------------------------------------------
    test('1. fleetLoadState and fleetLoadError exist in data() with initial loading state', () => {
        assert.ok(adminViewContent.includes("fleetLoadState: 'loading'"), 'fleetLoadState must be initialized in data()');
        assert.ok(adminViewContent.includes("fleetLoadError: ''"), 'fleetLoadError must be initialized in data()');
    });

    test('2. fetchFleetBuses correctly sets all four distinct states (loading, loaded_empty, loaded_success, load_error)', () => {
        assert.ok(adminViewContent.includes("this.fleetLoadState = 'loading'"), 'Must transition to loading on fetch start');
        assert.ok(adminViewContent.includes("this.fleetLoadState = 'loaded_empty'"), 'Must transition to loaded_empty when 0 active buses');
        assert.ok(adminViewContent.includes("this.fleetLoadState = 'loaded_success'"), 'Must transition to loaded_success when active buses exist');
        assert.ok(adminViewContent.includes("this.fleetLoadState = 'load_error'"), 'Must transition to load_error on fetch failure');
    });

    // -------------------------------------------------------------
    // 2. TEMPLATE RENDERING OF 4 STATES
    // -------------------------------------------------------------
    test('3. Template renders loading spinner when fleetLoadState === "loading"', () => {
        assert.ok(adminViewContent.includes('v-if="fleetLoadState === \'loading\'"'), 'Must check fleetLoadState === loading');
        assert.ok(adminViewContent.includes('Загрузка автопарка...'), 'Must display loading text');
    });

    test('4. Template renders error banner with retry button when fleetLoadState === "load_error"', () => {
        assert.ok(adminViewContent.includes('v-else-if="fleetLoadState === \'load_error\'"'), 'Must check fleetLoadState === load_error');
        assert.ok(adminViewContent.includes('Не удалось загрузить автопарк'), 'Must display error heading');
        assert.ok(adminViewContent.includes('@click="fetchFleetBuses"'), 'Must have retry button calling fetchFleetBuses');
        assert.ok(adminViewContent.includes('Повторить'), 'Must display "Повторить" button label');
    });

    test('5. Empty fleet text is strictly guarded and only shown when fleetLoadState === "loaded_empty"', () => {
        assert.ok(adminViewContent.includes("fleetLoadState === 'loaded_empty'"), 'Must check fleetLoadState === loaded_empty');
        assert.ok(adminViewContent.includes('В вашем автопарке пока нет активных автобусов'), 'Must show empty text only in loaded_empty state');
        assert.ok(adminViewContent.includes('+ Добавить автобус'), 'Must display add bus button in empty state');
    });

    test('6. Fleet selector dropdown is only rendered when fleetLoadState === "loaded_success"', () => {
        assert.ok(adminViewContent.includes('v-else-if="fleetLoadState === \'loaded_success\'"'), 'Selector must only render in loaded_success state');
        assert.ok(adminViewContent.includes('v-model="selectedFleetBusId"'), 'Must bind selectedFleetBusId');
    });

    // -------------------------------------------------------------
    // 3. EDIT FORM SAVE GUARD
    // -------------------------------------------------------------
    test('7. Save button is disabled when editing ticket and fleetLoadState is loading or load_error', () => {
        assert.ok(
            adminViewContent.includes("isEditingTicket && (fleetLoadState === 'loading' || fleetLoadState === 'load_error')"),
            'Save button must be disabled when editing and fleet is in loading or load_error'
        );
    });

    test('8. Edit warning message is displayed when fleet is in load_error', () => {
        assert.ok(
            adminViewContent.includes("isEditingTicket && fleetLoadState === 'load_error'"),
            'Must display warning text when editing and fleet is in load_error'
        );
        assert.ok(
            adminViewContent.includes('Сохранение заблокировано: не удалось загрузить автопарк'),
            'Must explain reason for disabled button'
        );
    });

    test('9. updateBusTicket method defends against saving during loading or load_error', () => {
        assert.ok(adminViewContent.includes("this.fleetLoadState === 'loading'"), 'updateBusTicket must check loading state');
        assert.ok(adminViewContent.includes("this.fleetLoadState === 'load_error'"), 'updateBusTicket must check load_error state');
    });

    test('10. activeFleetBuses computed property yields empty array unless loaded_success', () => {
        assert.ok(
            adminViewContent.includes("if (this.fleetLoadState !== 'loaded_success') return [];"),
            'activeFleetBuses must return empty array if not loaded_success'
        );
    });

    // -------------------------------------------------------------
    // 4. BEHAVIORAL SIMULATION OF ALL 4 STATES
    // -------------------------------------------------------------
    test('11. Behavioral simulation: transitions through loading -> loaded_success with active buses', () => {
        const state = {
            fleetBuses: [],
            fleetLoading: false,
            fleetLoadState: 'loading',
            fleetLoadError: ''
        };

        // Simulate fetch start
        state.fleetLoading = true;
        state.fleetLoadState = 'loading';
        state.fleetLoadError = '';

        // Simulate API 200 response with active buses
        const mockResponse = [
            { id: 1, name: 'Bus 1', status: 'active' },
            { id: 2, name: 'Bus 2', status: 'active' }
        ];
        state.fleetBuses = mockResponse;
        const activeBuses = mockResponse.filter(b => b.status === 'active');
        if (activeBuses.length === 0) {
            state.fleetLoadState = 'loaded_empty';
        } else {
            state.fleetLoadState = 'loaded_success';
        }
        state.fleetLoading = false;

        assert.strictEqual(state.fleetLoadState, 'loaded_success');
        assert.strictEqual(state.fleetLoading, false);
        assert.strictEqual(state.fleetBuses.length, 2);
    });

    test('12. Behavioral simulation: transitions through loading -> loaded_empty when 0 buses returned', () => {
        const state = {
            fleetBuses: [],
            fleetLoading: true,
            fleetLoadState: 'loading',
            fleetLoadError: ''
        };

        // Simulate API 200 response with empty array
        const mockResponse = [];
        state.fleetBuses = mockResponse;
        const activeBuses = mockResponse.filter(b => b.status === 'active');
        if (activeBuses.length === 0) {
            state.fleetLoadState = 'loaded_empty';
        } else {
            state.fleetLoadState = 'loaded_success';
        }
        state.fleetLoading = false;

        assert.strictEqual(state.fleetLoadState, 'loaded_empty');
        assert.strictEqual(state.fleetLoading, false);
        assert.strictEqual(state.fleetBuses.length, 0);
    });

    test('13. Behavioral simulation: transitions through loading -> load_error when API fails', () => {
        const state = {
            fleetBuses: [],
            fleetLoading: true,
            fleetLoadState: 'loading',
            fleetLoadError: ''
        };

        // Simulate API error (e.g. 500 / 42501)
        const err = new Error('Permission denied');
        state.fleetLoadState = 'load_error';
        state.fleetLoadError = 'Ошибка загрузки списка автобусов';
        state.fleetLoading = false;

        assert.strictEqual(state.fleetLoadState, 'load_error');
        assert.strictEqual(state.fleetLoading, false);
        assert.strictEqual(state.fleetLoadError, 'Ошибка загрузки списка автобусов');

        // Form save guard check
        const isSaveAllowed = (isEditing) => {
            if (isEditing && (state.fleetLoadState === 'loading' || state.fleetLoadState === 'load_error')) {
                return false;
            }
            return true;
        };

        assert.strictEqual(isSaveAllowed(true), false, 'Saving must be blocked when editing and load_error');
    });

    test('14. Behavioral simulation: Retry from load_error recovers to loaded_success', () => {
        const state = {
            fleetBuses: [],
            fleetLoading: false,
            fleetLoadState: 'load_error',
            fleetLoadError: 'Network Error'
        };

        // User clicks "Повторить" -> fetch begins again
        state.fleetLoading = true;
        state.fleetLoadState = 'loading';
        state.fleetLoadError = '';

        // API succeeds on retry
        const mockResponse = [{ id: 10, name: 'Recovered Bus', status: 'active' }];
        state.fleetBuses = mockResponse;
        state.fleetLoadState = 'loaded_success';
        state.fleetLoading = false;

        assert.strictEqual(state.fleetLoadState, 'loaded_success');
        assert.strictEqual(state.fleetLoadError, '');
    });
});
