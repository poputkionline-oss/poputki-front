<script>
export default {
    name: 'BusSeatSelector',
    props: {
        modelValue: { type: Array, default: () => [] },
        bookedSeats: { type: Array, default: () => [] },
        totalSeats: { type: Number, default: 53 },
        floor1Seats: { type: Number, default: 20 },
        floor2Seats: { type: Number, default: 56 },
        maxSelectable: { type: Number, default: 1 },
        seatGenders: { type: Object, default: () => ({}) },
        busType: { type: String, default: 'single' },
        premiumSeats: { type: Array, default: () => [] },
        premiumPrice: { type: Number, default: 0 },
        regularPrice: { type: Number, default: 0 }
    },
    emits: ['update:modelValue', 'seat-dblclick'],
    data() {
        return {
            currentFloor: this.busType === 'double' ? 2 : 1
        };
    },
    computed: {
        selectedSeats: {
            get() { return this.modelValue; },
            set(val) { this.$emit('update:modelValue', val); }
        },

        doubleDeckPremiumSeats() {
            // Floor 2 front seats (first 4) are always premium on a double-decker
            const floor2Front = [1, 2, 3, 4];
            
            // Floor 1: First 3 rows (first 10 seats) are the ONLY VIP seats on floor 1
            const f2 = this.floor2Seats;
            const floor1VIP = [];
            for (let i = 1; i <= 10; i++) {
                const seatNum = f2 + i;
                if (seatNum <= f2 + this.floor1Seats) {
                    floor1VIP.push(seatNum);
                }
            }
            
            // Filter out any other floor 1 seats from the premiumSeats prop
            const otherPremium = (this.premiumSeats || []).filter(s => {
                if (s > f2 && s <= f2 + this.floor1Seats) return floor1VIP.includes(s);
                return true;
            });
            
            return [...new Set([...floor2Front, ...floor1VIP, ...otherPremium])];
        },

        singleFloorLayout() {
            const maxSeats = this.totalSeats;
            const layout = [];

            // Header labels (TV/exit)
            layout.push({ type: 'header', items: [
                { type: 'label', text: 'TV', colspan: 2 },
                { type: 'spacer' },
                { type: 'label', text: 'exit', variant: 'exit', colspan: 2 }
            ]});

            // Driver row
            layout.push({ type: 'special-row', items: [
                { type: 'driver' },
                { type: 'guide', text: '1 в' },
                { type: 'spacer' },
                { type: 'guide', text: '2 в' },
                { type: 'empty' }
            ]});

            // Initial rows 1-20 (5 rows of 4)
            for (let i = 0; i < 5; i++) {
                const row = [1, 2, 3, 4].map(n => i * 4 + n);
                const filtered = row.filter(s => s <= maxSeats);
                if (filtered.length > 0) {
                    layout.push({ type: 'seat-row', left: filtered.slice(0, 2), right: filtered.slice(2) });
                }
            }

            // Intermediate rows near WC and Middle Exit
            if (maxSeats > 20) {
                const filtered = [21, 22].filter(s => s <= maxSeats);
                if (filtered.length > 0) {
                    layout.push({ type: 'seat-row', 
                        left: filtered, right: [],
                        rightLabels: [{ type: 'label', text: 'TV', variant: 'tv' }, { type: 'label', text: 'WC', variant: 'wc' }]
                    });
                }
            }

            if (maxSeats > 22) {
                const filtered = [23, 24].filter(s => s <= maxSeats);
                if (filtered.length > 0) {
                    layout.push({ type: 'seat-row', 
                        left: filtered, right: [],
                        rightLabels: [{ type: 'empty' }, { type: 'label', text: 'exit', variant: 'exit' }]
                    });
                }
            }

            // Dynamic rows starting from 25
            let currentSeat = 25;
            while (currentSeat <= maxSeats) {
                const remaining = maxSeats - currentSeat + 1;
                // If remaining seats are 5 or fewer, they form the final back row
                if (remaining <= 5) {
                    const lastRow = [];
                    for (let s = currentSeat; s <= maxSeats; s++) lastRow.push(s);
                    layout.push({ type: 'last-row', seats: lastRow });
                    break;
                } else {
                    // Regular row of 4
                    const row = [currentSeat, currentSeat + 1, currentSeat + 2, currentSeat + 3];
                    layout.push({ type: 'seat-row', left: row.slice(0, 2), right: row.slice(2) });
                    currentSeat += 4;
                }
            }

            return layout;
        },





        // ---------------------------------------------------------------
        // Double-deck Floor 2 (upper): seats 1..floor2Seats
        // Rows of 4: left=[4i+1, 4i+2], right=[4i+4, 4i+3], trimmed from back
        // ---------------------------------------------------------------
        doubleFloor2Layout() {
            const max = this.floor2Seats;
            const layout = [];

            layout.push({ type: 'header', items: [
                { type: 'empty' }, { type: 'empty' }, { type: 'spacer' },
                { type: 'label', text: 'Лестница', variant: 'stairs' }, { type: 'empty' }
            ]});

            let seat = 1;
            while (seat <= max) {
                const left = [seat, seat + 1].filter(s => s <= max);
                const right = [seat + 3, seat + 2].filter(s => s <= max);
                if (left.length > 0 || right.length > 0) {
                    layout.push({ type: 'seat-row', left, right });
                }
                seat += 4;
            }

            layout.push({ type: 'footer-label', text: 'Лестница', variant: 'stairs' });
            return layout;
        },

        // ---------------------------------------------------------------
        // Double-deck Floor 1 (lower): seats (floor2Seats+1)..(floor2Seats+floor1Seats)
        // First row has staircase on the left. Optional table row at midpoint.
        // ---------------------------------------------------------------
        doubleFloor1Layout() {
            const f2 = this.floor2Seats;
            const max = f2 + this.floor1Seats;
            const layout = [];

            layout.push({ type: 'header', items: [
                { type: 'label', text: 'Лестница', variant: 'stairs' }, { type: 'empty' },
                { type: 'spacer' }, { type: 'empty' },
                { type: 'label', text: 'Вход', variant: 'exit' }
            ]});

            // First row: stairs on left, 2 seats on right
            const firstRight = [f2 + 2, f2 + 1].filter(s => s <= max);
            if (firstRight.length > 0) {
                layout.push({ type: 'seat-row', left: 'stairs', right: firstRight });
            }

            // Second row: 4 seats
            const secondRowLeft = [f2 + 3, f2 + 4].filter(s => s <= max);
            const secondRowRight = [f2 + 6, f2 + 5].filter(s => s <= max);
            if (secondRowLeft.length > 0 || secondRowRight.length > 0) {
                layout.push({ type: 'seat-row', left: secondRowLeft, right: secondRowRight });
            }

            // Tables always come right after the second row
            if (this.floor1Seats >= 10) {
                layout.push({ type: 'table-row', left: 'table', right: 'table' });
            }

            let seat = f2 + 7;
            while (seat <= max) {
                const left = [seat, seat + 1].filter(s => s <= max);
                const right = [seat + 3, seat + 2].filter(s => s <= max);
                if (left.length > 0 || right.length > 0) {
                    layout.push({ type: 'seat-row', left, right });
                }
                seat += 4;
            }

            layout.push({ type: 'footer-label', text: 'Выход', variant: 'exit' });
            layout.push({ type: 'facilities', items: ['Туалет', 'Мини Кухня', 'Лестница'] });
            layout.push({ type: 'baggage', text: 'Багажное отделение' });
            return layout;
        },

        currentLayout() {
            if (this.busType === 'single') return this.singleFloorLayout;
            return this.currentFloor === 1 ? this.doubleFloor1Layout : this.doubleFloor2Layout;
        },

        normalizedBookedSeats() {
            if (!Array.isArray(this.bookedSeats)) return [];
            return this.bookedSeats.map(s => Number(s)).filter(s => !isNaN(s));
        }
    },
    methods: {
        isSeatBooked(seatNum) {
            const num = Number(seatNum);
            if (isNaN(num)) return false;
            return this.normalizedBookedSeats.includes(num);
        },
        isSeatSelected(seatNum) {
            const num = Number(seatNum);
            if (isNaN(num)) return false;
            return (this.selectedSeats || []).some(s => Number(s) === num);
        },
        isSeatPremium(seatNum) {
            if (this.busType !== 'double') return false;
            const num = Number(seatNum);
            if (isNaN(num)) return false;
            return this.doubleDeckPremiumSeats.includes(num);
        },
        toggleSeat(seatNum) {
            if (this.isSeatBooked(seatNum)) return;
            const num = Number(seatNum);
            if (isNaN(num)) return;
            const idx = (this.selectedSeats || []).findIndex(s => Number(s) === num);
            if (idx > -1) {
                this.selectedSeats = this.selectedSeats.filter(s => Number(s) !== num);
            } else {
                if (this.selectedSeats.length >= this.maxSelectable) {
                    if (this.maxSelectable === 1) this.selectedSeats = [num];
                    else this.selectedSeats = [...this.selectedSeats.slice(1), num];
                } else {
                    this.selectedSeats = [...this.selectedSeats, num];
                }
            }
        },
        handleDblClick(seatNum) {
            if (this.isSeatBooked(seatNum)) return;
            this.$emit('seat-dblclick', Number(seatNum));
        },
        getBookedSeatGender(seatNum) {
            if (!this.isSeatBooked(seatNum)) return null;
            const num = Number(seatNum);
            const gender = this.seatGenders?.[num] || this.seatGenders?.[String(seatNum)] || null;
            return (gender === 'male' || gender === 'female') ? gender : null;
        },
        getSeatGender(seatNum) {
            return this.getBookedSeatGender(seatNum);
        },
        getSeatClass(seatNum) {
            if (this.isSeatBooked(seatNum)) {
                const gender = this.getBookedSeatGender(seatNum);
                if (gender === 'male') return 'seat-booked seat-male-booked booked-male';
                if (gender === 'female') return 'seat-booked seat-female-booked booked-female';
                return 'seat-booked';
            }
            if (this.isSeatSelected(seatNum)) return 'seat-selected';
            if (this.isSeatPremium(seatNum)) return 'seat-premium';
            return 'seat-free';
        }
    },
    watch: {
        busType(newVal) {
            this.currentFloor = newVal === 'double' ? 2 : 1;
        }
    }
}
</script>

<template>
    <div class="bus-selector">
        <div class="selector-hint">Схема может отличаться от реальности</div>
        <div class="bus-body">
            <div v-if="busType === 'double'" class="floor-switcher">
                <button @click="currentFloor = 1" :class="currentFloor === 1 ? 'active' : ''">1 Этаж</button>
                <button @click="currentFloor = 2" :class="currentFloor === 2 ? 'active' : ''">2 Этаж</button>
            </div>

            <div v-for="(row, rIdx) in currentLayout" :key="rIdx" class="layout-row">
                <!-- 5-column grid: [seat][seat] [aisle] [seat/label][seat/label] -->
                
                <template v-if="row.type === 'header'">
                    <template v-for="(item, iIdx) in row.items" :key="iIdx">
                        <div v-if="item.type === 'label'" class="label-tile" :class="'label-'+(item.variant||'default')" :style="item.colspan ? {gridColumn: 'span '+item.colspan} : {}">{{ item.text }}</div>
                        <div v-else-if="item.type === 'spacer'" class="aisle"></div>
                        <div v-else class="empty-cell"></div>
                    </template>
                </template>

                <template v-else-if="row.type === 'special-row'">
                    <template v-for="(item, iIdx) in row.items" :key="iIdx">
                        <div v-if="item.type === 'driver'" class="driver-cell">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="driver-icon"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
                        </div>
                        <div v-else-if="item.type === 'guide'" class="guide-cell">{{ item.text }}</div>
                        <div v-else-if="item.type === 'spacer'" class="aisle"></div>
                        <div v-else class="empty-cell"></div>
                    </template>
                </template>

                <template v-else-if="row.type === 'table-row'">
                    <div v-if="row.left === 'table'" class="table-cell span-2">СТОЛ</div>
                    <div v-else-if="Array.isArray(row.left)" class="seat-pair">
                        <button v-for="s in row.left" :key="s" @click="toggleSeat(s)" @dblclick.prevent="handleDblClick(s)" :class="['seat-btn', getSeatClass(s), getSeatGender(s) ? 'booked-'+getSeatGender(s) : '']" :disabled="isSeatBooked(s)">
                            <template v-if="getSeatGender(s)">
                                <svg class="gender-icon" :class="getSeatGender(s)==='male'?'male':'female'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                            </template>
                            <template v-else>
                                <span class="num">{{ s }}</span>
                                <span v-if="isSeatPremium(s) && !isSeatBooked(s) && !isSeatSelected(s)" class="star">★</span>
                            </template>
                        </button>
                        <div v-for="n in (2 - row.left.length)" :key="'el'+n" class="empty-cell"></div>
                    </div>
                    <div v-else class="empty-cell span-2"></div>

                    <div class="aisle"></div>

                    <div v-if="row.right === 'table'" class="table-cell span-2">СТОЛ</div>
                    <div v-else-if="Array.isArray(row.right)" class="seat-pair">
                        <button v-for="s in row.right" :key="s" @click="toggleSeat(s)" @dblclick.prevent="handleDblClick(s)" :class="['seat-btn', getSeatClass(s), getSeatGender(s) ? 'booked-'+getSeatGender(s) : '']" :disabled="isSeatBooked(s)">
                            <template v-if="getSeatGender(s)">
                                <svg class="gender-icon" :class="getSeatGender(s)==='male'?'male':'female'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                            </template>
                            <template v-else>
                                <span class="num">{{ s }}</span>
                                <span v-if="isSeatPremium(s) && !isSeatBooked(s) && !isSeatSelected(s)" class="star">★</span>
                            </template>
                        </button>
                        <div v-for="n in (2 - row.right.length)" :key="'er'+n" class="empty-cell"></div>
                    </div>
                    <div v-else class="empty-cell span-2"></div>
                </template>

                <template v-else-if="row.type === 'seat-row'">
                    <!-- Left Pair -->
                    <div class="seat-pair">
                        <div v-if="row.left === 'stairs'" class="label-tile span-2 label-stairs">Лестница</div>
                        <template v-else>
                            <button v-for="s in row.left" :key="s" @click="toggleSeat(s)" @dblclick.prevent="handleDblClick(s)" :class="['seat-btn', getSeatClass(s), getSeatGender(s) ? 'booked-'+getSeatGender(s) : '']" :disabled="isSeatBooked(s)">
                                <template v-if="getSeatGender(s)">
                                    <svg class="gender-icon" :class="getSeatGender(s)==='male'?'male':'female'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                                </template>
                                <template v-else>
                                    <span class="num">{{ s }}</span>
                                    <span v-if="isSeatPremium(s) && !isSeatBooked(s) && !isSeatSelected(s)" class="star">★</span>
                                </template>
                            </button>
                            <div v-for="n in (2 - row.left.length)" :key="'el'+n" class="empty-cell"></div>
                        </template>
                    </div>
                    
                    <div class="aisle"></div>

                    <!-- Right Pair -->
                    <div class="seat-pair">
                        <template v-if="row.rightLabels">
                            <div v-for="(l, li) in row.rightLabels" :key="li" :class="l.type==='label'?'label-tile small label-'+l.variant:'empty-cell'">{{ l.text }}</div>
                        </template>
                        <template v-else>
                            <button v-for="s in row.right" :key="s" @click="toggleSeat(s)" @dblclick.prevent="handleDblClick(s)" :class="['seat-btn', getSeatClass(s), getSeatGender(s) ? 'booked-'+getSeatGender(s) : '']" :disabled="isSeatBooked(s)">
                                <template v-if="getSeatGender(s)">
                                    <svg class="gender-icon" :class="getSeatGender(s)==='male'?'male':'female'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                                </template>
                                <template v-else>
                                    <span class="num">{{ s }}</span>
                                    <span v-if="isSeatPremium(s) && !isSeatBooked(s) && !isSeatSelected(s)" class="star">★</span>
                                </template>
                            </button>
                            <div v-for="n in (2 - row.right.length)" :key="'er'+n" class="empty-cell"></div>
                        </template>
                    </div>
                </template>

                <template v-else-if="row.type === 'last-row'">
                    <div class="last-row-grid">
                        <button v-for="s in row.seats" :key="s" @click="toggleSeat(s)" @dblclick.prevent="handleDblClick(s)" :class="['seat-btn', getSeatClass(s), getSeatGender(s) ? 'booked-'+getSeatGender(s) : '']" :disabled="isSeatBooked(s)">
                            <template v-if="getSeatGender(s)">
                                <svg class="gender-icon" :class="getSeatGender(s)==='male'?'male':'female'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                            </template>
                            <template v-else>
                                <span class="num">{{ s }}</span>
                            </template>
                        </button>
                    </div>
                </template>

                <template v-else-if="row.type === 'footer-label'">
                    <div class="empty-cell"></div><div class="empty-cell"></div><div class="aisle"></div>
                    <div class="label-tile span-2" :class="'label-'+row.variant">{{ row.text }}</div>
                </template>

                <template v-else-if="row.type === 'facilities'">
                    <div v-for="f in row.items" :key="f" class="facility-cell">{{ f }}</div>
                </template>

                <template v-else-if="row.type === 'baggage'">
                    <div class="baggage-cell">БАГАЖНОЕ ОДТЕЛЕНИЕ</div>
                </template>
            </div>
        </div>

        <div class="legend">
            <div class="item"><div class="swatch selected">N</div><span>Выбрано</span></div>
            <div class="item"><div class="swatch male"><svg class="ico" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg></div><span>Мужчина</span></div>
            <div class="item"><div class="swatch female"><svg class="ico" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg></div><span>Женщина</span></div>
            <div class="item"><div class="swatch booked">N</div><span>Занято (пол не указан)</span></div>
            <div class="item"><div class="swatch free">N</div><span>Свободно</span></div>
            <div v-if="busType === 'double'" class="item"><div class="swatch premium">★</div><span>Премиум</span></div>
        </div>
    </div>
</template>

<style scoped>
.bus-selector { width: 100%; margin: 0 auto; }
.selector-hint { font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 12px; }
.bus-body { background: transparent; display: flex; flex-direction: column; gap: 8px; width: 100%; }

/* Dynamic grid columns: larger seats */
.layout-row {
    display: grid;
    grid-template-columns: 60px 60px 30px 60px 60px;
    align-items: center;
    gap: 4px;
    justify-content: center;
}

.seat-pair { display: contents; } /* Act as direct children of the grid */
.aisle { width: 30px; height: 100%; grid-column: 3; }

.empty-cell { width: 60px; height: 60px; }

.seat-btn {
    width: 60px; height: 60px; border-radius: 12px; border: 2px solid #e2e8f0;
    background: #fff; display: flex; align-items: center; justify-content: center;
    position: relative; cursor: pointer; transition: 0.1s; padding: 0;
}
.seat-free { border-color: #cbd5e1; }
.seat-selected { background: #2563eb; border-color: #1e40af; color: #fff; }
.seat-booked { background: #f1f5f9; border-color: #e2e8f0; cursor: not-allowed; }
.booked-male, .seat-male-booked { background: #eff6ff; border-color: #bfdbfe; cursor: not-allowed; }
.booked-female, .seat-female-booked { background: #fdf2f8; border-color: #fbcfe8; cursor: not-allowed; }
.legend .swatch.booked { background: #f1f5f9; border-color: #e2e8f0; color: #94a3b8; }
.seat-premium { background: #fffbeb; border-color: #fcd34d; color: #92400e; }

.num { font-size: 16px; font-weight: 900; }
.star { position: absolute; top: 2px; right: 2px; font-size: 12px; color: #f59e0b; }
.gender-icon { width: 24px; height: 24px; }
.gender-icon.male { color: #3b82f6; }
.gender-icon.female { color: #ec4899; }

.label-tile {
    height: 50px; display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; text-transform: uppercase; border-radius: 10px; padding: 0 8px; border: 1px solid #cbd5e1;
}
.label-default { background: #f8fafc; color: #64748b; }
.label-exit { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.label-stairs { background: #f1f5f9; color: #94a3b8; }
.label-tv { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.label-wc { background: #f5f3ff; color: #5b21b6; border-color: #ddd6fe; }
.span-2 { grid-column: span 2; }

.table-cell {
    grid-column: span 2; height: 40px; background: #f1f5f9; border: 2px dashed #cbd5e1;
    border-radius: 20px; display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; color: #94a3b8; margin: 8px 0;
}

.driver-cell { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 30px; }
.driver-icon { width: 28px; height: 28px; color: #cbd5e1; }
.guide-cell { width: 60px; height: 60px; border: 2px dashed #cbd5e1; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; font-weight: 900; }

.floor-switcher { display: flex; gap: 4px; background: #f1f5f9; padding: 3px; border-radius: 10px; margin-bottom: 12px; }
.floor-switcher button { flex: 1; border: none; background: none; padding: 6px; font-size: 11px; font-weight: 700; color: #64748b; border-radius: 7px; cursor: pointer; }
.floor-switcher button.active { background: #fff; color: #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

.facilities-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 8px; }
.facility-cell { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; text-align: center; background: #f8fafc; padding: 6px; border-radius: 6px; }
.baggage-cell { grid-column: 1 / -1; font-size: 8px; font-weight: 800; color: #cbd5e1; text-align: center; padding: 8px; background: #f8fafc; border-radius: 6px; margin-top: 4px; }

.last-row-grid { grid-column: 1 / -1; display: flex; gap: 4px; justify-content: center; }

.legend { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.legend .item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #64748b; font-weight: 600; }
.legend .swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 9px; }
.legend .swatch.selected { background: #2563eb; color: #fff; border-color: #1e40af; }
.legend .swatch.male { background: #eff6ff; border-color: #bfdbfe; }
.legend .swatch.female { background: #fdf2f8; border-color: #fbcfe8; }
.legend .swatch.premium { background: #fffbeb; border-color: #fcd34d; color: #f59e0b; }
.ico { width: 10px; height: 10px; }
</style>
