import { useState, useEffect, useCallback, useRef } from "react";

// ══════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ══════════════════════════════════════════════════════════

const STADIUMS = [
  { id: "open", name: "Usti ochiq stadion", icon: "⛳" },
  { id: "closed", name: "Yopiq stadion", icon: "🏟️" },
];

const TIME_SLOTS = [
  { label: "20:00", minutes: 1200 },
  { label: "20:30", minutes: 1230 },
  { label: "21:00", minutes: 1260 },
  { label: "21:30", minutes: 1290 },
  { label: "22:00", minutes: 1320 },
  { label: "22:30", minutes: 1350 },
  { label: "23:00", minutes: 1380 },
  { label: "23:30", minutes: 1410 },
  { label: "00:00", minutes: 1440 },
];

const DURATION_OPTIONS = [
  { label: "30 daqiqa", value: 30 },
  { label: "1 soat", value: 60 },
  { label: "1.5 soat", value: 90 },
  { label: "2 soat", value: 120 },
  { label: "2.5 soat", value: 150 },
  { label: "3 soat", value: 180 },
  { label: "3.5 soat", value: 210 },
  { label: "4 soat", value: 240 },
];

const DAYS_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
const DAYS_FULL = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

const VIEWS = {
  DASHBOARD: "dashboard",
  ADD_BOOKING: "add_booking",
  BOOKINGS: "bookings",
  REGULARS: "regulars",
  ARCHIVE: "archive",
};

// ══════════════════════════════════════════════════════════
// BUSINESS LOGIC — CONFLICT DETECTION
// ══════════════════════════════════════════════════════════

function hasOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function getBookingsForDate(bookings, regulars, date) {
  const day = new Date(date).getDay();
  const dateStr = date;
  const regularBookings = [];
  regulars.forEach((r) => {
    if (r.paused) return;
    if (r.skippedDates && r.skippedDates.includes(dateStr)) return;
    if (r.days.includes(day)) {
      regularBookings.push({
        ...r,
        date: dateStr,
        isRegular: true,
        startMinute: r.startMinute,
        endMinute: r.startMinute + r.duration,
      });
    }
  });
  const dayBookings = bookings.filter((b) => b.date === dateStr && !b.cancelled);
  return [...dayBookings, ...regularBookings];
}

function checkConflict(stadiumId, date, startMinute, endMinute, bookings, regulars, excludeId = null) {
  const existing = getBookingsForDate(bookings, regulars, date).filter(
    (b) => b.stadiumId === stadiumId && b.id !== excludeId
  );
  for (const b of existing) {
    const bEnd = b.endMinute || b.startMinute + b.duration;
    if (hasOverlap(startMinute, endMinute, b.startMinute, bEnd)) {
      return b;
    }
  }
  return null;
}

function getAvailableStartTimes(stadiumId, date, duration, bookings, regulars, excludeId = null) {
  return TIME_SLOTS.filter((slot) => {
    const endMinute = slot.minutes + duration;
    if (endMinute > 1440 + 30) return false;
    const conflict = checkConflict(stadiumId, date, slot.minutes, endMinute, bookings, regulars, excludeId);
    return !conflict;
  });
}

function minutesToLabel(m) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function validatePhone(phone) {
  return /^[\d\s\+\-\(\)]{7,15}$/.test(phone.trim());
}

// ══════════════════════════════════════════════════════════
// LOCAL STORAGE
// ══════════════════════════════════════════════════════════

function loadState(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ══════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0b;
    --bg2: #111113;
    --bg3: #18181b;
    --bg4: #222226;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.12);
    --text: #f4f4f5;
    --text2: #a1a1aa;
    --text3: #71717a;
    --accent: #6366f1;
    --accent2: #4f46e5;
    --accent-soft: rgba(99,102,241,0.15);
    --green: #22c55e;
    --green-soft: rgba(34,197,94,0.12);
    --red: #ef4444;
    --red-soft: rgba(239,68,68,0.12);
    --amber: #f59e0b;
    --amber-soft: rgba(245,158,11,0.12);
    --radius: 12px;
    --radius-sm: 8px;
    --radius-xs: 6px;
    --shadow: 0 8px 32px rgba(0,0,0,0.5);
    --shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
    --font: 'DM Sans', system-ui, sans-serif;
    --mono: 'DM Mono', monospace;
    --transition: 0.18s cubic-bezier(0.4,0,0.2,1);
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }

  .app {
    min-height: 100vh;
    max-width: 430px;
    margin: 0 auto;
    background: var(--bg);
    position: relative;
    overflow-x: hidden;
  }

  /* HEADER */
  .header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(10,10,11,0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-logo {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.3px;
    color: var(--text);
  }

  .header-logo span {
    color: var(--accent);
  }

  /* BOTTOM NAV */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    background: rgba(17,17,19,0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border);
    display: flex;
    padding: 8px 0 max(8px, env(safe-area-inset-bottom));
    z-index: 100;
  }

  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 4px;
    cursor: pointer;
    background: none;
    border: none;
    color: var(--text3);
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    transition: color var(--transition);
    -webkit-tap-highlight-color: transparent;
  }

  .nav-item.active { color: var(--accent); }
  .nav-item svg { width: 22px; height: 22px; stroke-width: 1.8; }

  /* MAIN CONTENT */
  .main {
    padding: 16px 16px 100px;
  }

  /* CARDS */
  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
    transition: border-color var(--transition);
  }

  .card:hover { border-color: var(--border2); }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* SLOT GRID */
  .slot-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .slot {
    border-radius: var(--radius-xs);
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    font-weight: 500;
    font-family: var(--mono);
    cursor: default;
  }

  .slot.free {
    background: var(--green-soft);
    color: var(--green);
    border: 1px solid rgba(34,197,94,0.2);
  }

  .slot.busy {
    background: var(--red-soft);
    color: var(--red);
    border: 1px solid rgba(239,68,68,0.2);
  }

  .slot.partial {
    background: var(--amber-soft);
    color: var(--amber);
    border: 1px solid rgba(245,158,11,0.2);
  }

  .slot-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* SECTION LABEL */
  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  /* BOOKING ITEM */
  .booking-item {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 8px;
    animation: fadeIn 0.25s ease;
  }

  .booking-item.cancelled {
    opacity: 0.5;
    border-style: dashed;
  }

  .booking-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .booking-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .booking-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .booking-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }

  /* BADGES */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 20px;
  }

  .badge-open { background: rgba(99,102,241,0.15); color: #818cf8; }
  .badge-closed { background: rgba(168,85,247,0.15); color: #c084fc; }
  .badge-free { background: var(--green-soft); color: var(--green); }
  .badge-busy { background: var(--red-soft); color: var(--red); }
  .badge-regular { background: var(--amber-soft); color: var(--amber); }
  .badge-cancelled { background: rgba(113,113,122,0.15); color: var(--text3); }

  /* BUTTONS */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition);
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn:active { transform: scale(0.97); }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover { background: var(--accent2); }

  .btn-ghost {
    background: transparent;
    color: var(--text2);
    border-color: var(--border2);
  }

  .btn-ghost:hover { background: var(--bg3); color: var(--text); }

  .btn-danger {
    background: transparent;
    color: var(--red);
    border-color: rgba(239,68,68,0.3);
  }

  .btn-danger:hover { background: var(--red-soft); }

  .btn-success {
    background: transparent;
    color: var(--green);
    border-color: rgba(34,197,94,0.3);
  }

  .btn-success:hover { background: var(--green-soft); }

  .btn-sm {
    font-size: 12px;
    padding: 6px 10px;
  }

  .btn-full { width: 100%; }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  /* FAB */
  .fab {
    position: fixed;
    bottom: 72px;
    right: 16px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    border: none;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(99,102,241,0.5);
    transition: all var(--transition);
    z-index: 90;
    -webkit-tap-highlight-color: transparent;
  }

  .fab:hover { transform: scale(1.05); background: var(--accent2); }
  .fab:active { transform: scale(0.95); }

  /* FORMS */
  .form-group {
    margin-bottom: 14px;
  }

  .form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .form-input {
    width: 100%;
    background: var(--bg3);
    border: 1px solid var(--border2);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font);
    font-size: 15px;
    padding: 11px 13px;
    outline: none;
    transition: border-color var(--transition);
    -webkit-appearance: none;
    appearance: none;
  }

  .form-input:focus { border-color: var(--accent); }
  .form-input::placeholder { color: var(--text3); }

  .form-input option {
    background: #1a1a1e;
    color: var(--text);
  }

  .form-error {
    font-size: 12px;
    color: var(--red);
    margin-top: 4px;
  }

  /* MODAL */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: overlayIn 0.2s ease;
  }

  .modal {
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: var(--radius) var(--radius) 0 0;
    width: 100%;
    max-width: 430px;
    max-height: 92vh;
    overflow-y: auto;
    padding: 0 0 max(20px, env(safe-area-inset-bottom));
    animation: slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    -webkit-overflow-scrolling: touch;
  }

  .modal-handle {
    width: 36px;
    height: 4px;
    background: var(--border2);
    border-radius: 2px;
    margin: 12px auto 0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg2);
    z-index: 10;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .modal-close {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg3);
    border: none;
    color: var(--text2);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
    -webkit-tap-highlight-color: transparent;
  }

  .modal-close:hover { background: var(--bg4); color: var(--text); }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    padding: 0 16px;
    display: flex;
    gap: 8px;
  }

  /* TOAST */
  .toast-container {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    width: calc(100% - 32px);
    max-width: 398px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-weight: 500;
    pointer-events: all;
    animation: toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: var(--shadow);
  }

  .toast.success { background: #14532d; border: 1px solid rgba(34,197,94,0.3); color: #86efac; }
  .toast.error { background: #450a0a; border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
  .toast.warning { background: #451a03; border: 1px solid rgba(245,158,11,0.3); color: #fcd34d; }

  /* DATE TABS */
  .date-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    margin-bottom: 16px;
    scrollbar-width: none;
  }

  .date-tabs::-webkit-scrollbar { display: none; }

  .date-tab {
    flex-shrink: 0;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    cursor: pointer;
    text-align: center;
    transition: all var(--transition);
    -webkit-tap-highlight-color: transparent;
  }

  .date-tab.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: #818cf8;
  }

  .date-tab-day {
    font-size: 10px;
    font-weight: 600;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .date-tab.active .date-tab-day { color: #818cf8; }

  .date-tab-num {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    font-family: var(--mono);
    line-height: 1.2;
  }

  /* STATS ROW */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .stat-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    text-align: center;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    font-family: var(--mono);
  }

  .stat-label {
    font-size: 10px;
    color: var(--text3);
    font-weight: 500;
    margin-top: 3px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* SEARCH */
  .search-box {
    position: relative;
    margin-bottom: 14px;
  }

  .search-box input {
    padding-left: 36px;
  }

  .search-icon {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text3);
    font-size: 16px;
    pointer-events: none;
  }

  /* TOGGLE */
  .toggle-row {
    display: flex;
    gap: 4px;
    background: var(--bg3);
    border-radius: var(--radius-sm);
    padding: 3px;
    margin-bottom: 14px;
  }

  .toggle-btn {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text3);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn.active {
    background: var(--bg2);
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }

  /* EMPTY STATE */
  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--text3);
  }

  .empty-state-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  .empty-state h3 {
    font-size: 15px;
    font-weight: 500;
    color: var(--text2);
    margin-bottom: 6px;
  }

  .empty-state p {
    font-size: 13px;
  }

  /* ANIMATIONS */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @keyframes overlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* REGULAR ITEM */
  .regular-item {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 8px;
    animation: fadeIn 0.2s ease;
  }

  .regular-item.paused {
    opacity: 0.6;
    border-style: dashed;
  }

  .regular-days {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .day-chip {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 20px;
    background: var(--accent-soft);
    color: #818cf8;
    font-family: var(--mono);
  }

  /* CONFIRM MODAL */
  .confirm-modal {
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: var(--radius);
    padding: 24px;
    width: calc(100% - 48px);
    max-width: 320px;
    animation: fadeIn 0.2s ease;
  }

  .confirm-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .confirm-text {
    font-size: 14px;
    color: var(--text2);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* DIVIDER */
  .divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 14px 0;
  }

  /* INFO ROW */
  .info-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
    color: var(--text2);
  }

  .info-row-label {
    color: var(--text3);
    min-width: 80px;
    font-size: 12px;
  }

  /* SKELETON */
  .skeleton {
    background: linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-xs);
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* PHONE INPUT HINT */
  .hint {
    font-size: 11px;
    color: var(--text3);
    margin-top: 4px;
  }

  /* CONFLICT WARNING */
  .conflict-banner {
    background: var(--red-soft);
    border: 1px solid rgba(239,68,68,0.3);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-size: 13px;
    color: #fca5a5;
    margin-bottom: 14px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  /* SCROLLBAR */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 2px; }
`;

// ══════════════════════════════════════════════════════════
// SVG ICONS
// ══════════════════════════════════════════════════════════

const Icon = {
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Archive: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, strokeWidth: 2.5 }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, strokeWidth: 2.5 }}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Ban: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Pause: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Skip: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M23 12a11 11 0 11-22 0 11 11 0 0122 0z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Warning: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

// ══════════════════════════════════════════════════════════
// TOAST COMPONENT
// ══════════════════════════════════════════════════════════

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "⚠"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════════════════

function ConfirmModal({ title, text, onConfirm, onCancel, danger = false }) {
  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="confirm-modal">
        <div className="confirm-title">{title}</div>
        <div className="confirm-text">{text}</div>
        <div className="confirm-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Bekor
          </button>
          <button className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════════════

function DashboardView({ bookings, regulars, onAddBooking }) {
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const todayBookings = getBookingsForDate(bookings, regulars, selectedDate);

  const getSlotStatus = (stadiumId, slotMinutes) => {
    return todayBookings.find((b) => {
      if (b.stadiumId !== stadiumId) return false;
      const bEnd = b.endMinute || b.startMinute + b.duration;
      return slotMinutes >= b.startMinute && slotMinutes < bEnd;
    });
  };

  const totalToday = todayBookings.length;
  const busyOpenSlots = TIME_SLOTS.filter((s) => getSlotStatus("open", s.minutes)).length;
  const busyClosedSlots = TIME_SLOTS.filter((s) => getSlotStatus("closed", s.minutes)).length;

  return (
    <div className="main">
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{totalToday}</div>
          <div className="stat-label">Bugun</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--red)" }}>
            {busyOpenSlots + busyClosedSlots}
          </div>
          <div className="stat-label">Band slot</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--green)" }}>
            {TIME_SLOTS.length * 2 - busyOpenSlots - busyClosedSlots}
          </div>
          <div className="stat-label">Bo'sh slot</div>
        </div>
      </div>

      {/* Date Tabs */}
      <div className="date-tabs">
        {dates.map((d) => {
          const dateObj = new Date(d + "T00:00:00");
          const dayIdx = dateObj.getDay();
          return (
            <div
              key={d}
              className={`date-tab ${selectedDate === d ? "active" : ""}`}
              onClick={() => setSelectedDate(d)}
            >
              <div className="date-tab-day">{DAYS_UZ[dayIdx]}</div>
              <div className="date-tab-num">{dateObj.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Stadiums Grid */}
      {STADIUMS.map((st) => {
        return (
          <div className="card" key={st.id}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{st.icon}</span>
                <span className="card-title">{st.name}</span>
              </div>
              <span
                className={`badge ${st.id === "open" ? "badge-open" : "badge-closed"}`}
              >
                {TIME_SLOTS.filter((s) => !getSlotStatus(st.id, s.minutes)).length} bo'sh
              </span>
            </div>
            <div className="slot-grid">
              {TIME_SLOTS.map((slot) => {
                const occupant = getSlotStatus(st.id, slot.minutes);
                return (
                  <div
                    key={slot.label}
                    className={`slot ${occupant ? "busy" : "free"}`}
                    title={occupant ? occupant.clientName : "Bo'sh"}
                  >
                    <div className="slot-dot" />
                    <span>{slot.label}</span>
                    {occupant && (
                      <span
                        style={{
                          fontSize: "9px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                          opacity: 0.8,
                        }}
                      >
                        {occupant.clientName.split(" ")[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Today's bookings list */}
      {todayBookings.length > 0 && (
        <div>
          <div className="section-label">Bugungi bronlar</div>
          {todayBookings
            .sort((a, b) => a.startMinute - b.startMinute)
            .map((b) => (
              <div key={b.id} className="booking-item">
                <div className="booking-top">
                  <div>
                    <div className="booking-name">{b.clientName}</div>
                    <div className="booking-meta">
                      <span className={`badge ${b.stadiumId === "open" ? "badge-open" : "badge-closed"}`}>
                        {STADIUMS.find((s) => s.id === b.stadiumId)?.name}
                      </span>
                      <span className="badge" style={{ background: "var(--bg3)", color: "var(--text2)" }}>
                        {minutesToLabel(b.startMinute)} – {minutesToLabel(b.endMinute || b.startMinute + b.duration)}
                      </span>
                      {b.isRegular && <span className="badge badge-regular">Doimiy</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: "13px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                    {b.phone}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ADD/EDIT BOOKING MODAL
// ══════════════════════════════════════════════════════════

function BookingModal({ booking, bookings, regulars, onSave, onClose, showToast }) {
  const isEdit = !!booking;
  const [form, setForm] = useState({
    clientName: booking?.clientName || "",
    phone: booking?.phone || "",
    stadiumId: booking?.stadiumId || "open",
    date: booking?.date || todayStr(),
    startMinute: booking?.startMinute || null,
    duration: booking?.duration || 60,
    note: booking?.note || "",
  });
  const [errors, setErrors] = useState({});
  const [conflict, setConflict] = useState(null);

  const endMinute = form.startMinute ? form.startMinute + form.duration : null;

  const availableStarts = form.stadiumId && form.date && form.duration
    ? getAvailableStartTimes(form.stadiumId, form.date, form.duration, bookings, regulars, booking?.id)
    : [];

  useEffect(() => {
    if (form.startMinute && form.duration && form.stadiumId && form.date) {
      const c = checkConflict(
        form.stadiumId,
        form.date,
        form.startMinute,
        form.startMinute + form.duration,
        bookings,
        regulars,
        booking?.id
      );
      setConflict(c);
    } else {
      setConflict(null);
    }
  }, [form.startMinute, form.duration, form.stadiumId, form.date]);

  const handleField = (key, val) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "stadiumId" || key === "date" || key === "duration") {
        next.startMinute = null;
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.clientName.trim()) e.clientName = "Ism kiritilmagan";
    if (!form.phone.trim()) e.phone = "Telefon kiritilmagan";
    else if (!validatePhone(form.phone)) e.phone = "Telefon noto'g'ri formatda";
    if (!form.date) e.date = "Sana tanlang";
    if (new Date(form.date) < new Date(todayStr()))
      e.date = "O'tgan sana tanlab bo'lmaydi";
    if (!form.startMinute) e.startMinute = "Vaqt tanlang";
    if (conflict) e.startMinute = "Vaqt to'qnashmoqda";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const id = booking?.id || generateId();
    onSave({
      id,
      clientName: form.clientName.trim(),
      phone: form.phone.trim(),
      stadiumId: form.stadiumId,
      date: form.date,
      startMinute: form.startMinute,
      endMinute: form.startMinute + form.duration,
      duration: form.duration,
      note: form.note.trim(),
      cancelled: booking?.cancelled || false,
      createdAt: booking?.createdAt || Date.now(),
    });
  };

  const minDate = todayStr();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{isEdit ? "Bronni tahrirlash" : "Yangi bron"}</span>
          <button className="modal-close" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          {conflict && (
            <div className="conflict-banner">
              <Icon.Warning />
              <span>
                <b>{conflict.clientName}</b> ({minutesToLabel(conflict.startMinute)} –{" "}
                {minutesToLabel(conflict.endMinute || conflict.startMinute + conflict.duration)}) bron
                qilgan. Boshqa vaqt tanlang.
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Mijoz ismi *</label>
            <input
              className="form-input"
              placeholder="To'liq ism"
              value={form.clientName}
              onChange={(e) => handleField("clientName", e.target.value)}
            />
            {errors.clientName && <div className="form-error">{errors.clientName}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Telefon *</label>
            <input
              className="form-input"
              placeholder="+998 90 123 45 67"
              value={form.phone}
              inputMode="tel"
              onChange={(e) => handleField("phone", e.target.value)}
            />
            {errors.phone && <div className="form-error">{errors.phone}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Stadion *</label>
            <select
              className="form-input"
              value={form.stadiumId}
              onChange={(e) => handleField("stadiumId", e.target.value)}
            >
              {STADIUMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sana *</label>
            <input
              className="form-input"
              type="date"
              min={minDate}
              value={form.date}
              onChange={(e) => handleField("date", e.target.value)}
            />
            {errors.date && <div className="form-error">{errors.date}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Davomiylik *</label>
            <select
              className="form-input"
              value={form.duration}
              onChange={(e) => handleField("duration", Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Boshlanish vaqti *</label>
            {availableStarts.length === 0 ? (
              <div
                style={{
                  background: "var(--red-soft)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  fontSize: "13px",
                  color: "#fca5a5",
                }}
              >
                Bu stadion, sana va davomiylik uchun bo'sh vaqt yo'q
              </div>
            ) : (
              <select
                className="form-input"
                value={form.startMinute || ""}
                onChange={(e) => handleField("startMinute", Number(e.target.value))}
              >
                <option value="">— Vaqt tanlang —</option>
                {availableStarts.map((s) => (
                  <option key={s.minutes} value={s.minutes}>
                    {s.label} → {minutesToLabel(s.minutes + form.duration)}
                  </option>
                ))}
              </select>
            )}
            {errors.startMinute && <div className="form-error">{errors.startMinute}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Izoh</label>
            <input
              className="form-input"
              placeholder="Qo'shimcha ma'lumot (ixtiyoriy)"
              value={form.note}
              onChange={(e) => handleField("note", e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-full" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            className="btn btn-primary btn-full"
            onClick={handleSave}
            disabled={!!conflict}
          >
            {isEdit ? "Saqlash" : "Bron qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// BOOKINGS VIEW
// ══════════════════════════════════════════════════════════

function BookingsView({ bookings, regulars, setBookings, showToast, showConfirm }) {
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [editBooking, setEditBooking] = useState(null);

  const today = todayStr();

  const filtered = bookings.filter((b) => {
    if (filter === "active" && (b.cancelled || b.date < today)) return false;
    if (filter === "cancelled" && !b.cancelled) return false;
    if (filter === "today" && (b.date !== today || b.cancelled)) return false;

    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        b.clientName.toLowerCase().includes(s) ||
        b.phone.includes(s) ||
        b.date.includes(s)
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? 1 : -1;
    return a.startMinute - b.startMinute;
  });

  const handleCancel = (id) => {
    showConfirm(
      "Bronni bekor qilish",
      "Haqiqatan ham bu bronni bekor qilmoqchimisiz?",
      () => {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, cancelled: true } : b))
        );
        showToast("Bron bekor qilindi", "warning");
      },
      true
    );
  };

  const handleDelete = (id) => {
    showConfirm(
      "Bronni o'chirish",
      "Bu amalni qaytarib bo'lmaydi. O'chirishni tasdiqlaysizmi?",
      () => {
        setBookings((prev) => prev.filter((b) => b.id !== id));
        showToast("Bron o'chirildi", "success");
      },
      true
    );
  };

  const handleRestore = (id) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, cancelled: false } : b))
    );
    showToast("Bron tiklandi", "success");
  };

  return (
    <div className="main">
      <div className="toggle-row">
        {[
          { key: "today", label: "Bugun" },
          { key: "active", label: "Aktiv" },
          { key: "cancelled", label: "Bekor" },
        ].map((t) => (
          <button
            key={t.key}
            className={`toggle-btn ${filter === t.key ? "active" : ""}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="search-box">
        <span className="search-icon"><Icon.Search /></span>
        <input
          className="form-input"
          placeholder="Ism, telefon yoki sana..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>Bron topilmadi</h3>
          <p>Qidiruv mezonlarini o'zgartiring</p>
        </div>
      ) : (
        sorted.map((b) => (
          <div key={b.id} className={`booking-item ${b.cancelled ? "cancelled" : ""}`}>
            <div className="booking-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="booking-name">{b.clientName}</div>
                <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "2px" }}>
                  {b.phone}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontFamily: "var(--mono)",
                    color: "var(--text2)",
                  }}
                >
                  {minutesToLabel(b.startMinute)}–{minutesToLabel(b.endMinute)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
                  {formatDate(b.date)}
                </div>
              </div>
            </div>
            <div className="booking-meta">
              <span className={`badge ${b.stadiumId === "open" ? "badge-open" : "badge-closed"}`}>
                {STADIUMS.find((s) => s.id === b.stadiumId)?.name}
              </span>
              {b.cancelled && <span className="badge badge-cancelled">Bekor</span>}
              {b.note && (
                <span className="badge" style={{ background: "var(--bg3)", color: "var(--text3)" }}>
                  📝 {b.note}
                </span>
              )}
            </div>
            <div className="booking-actions">
              {!b.cancelled ? (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditBooking(b)}
                  >
                    <Icon.Edit /> Tahrirlash
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)}>
                    <Icon.Ban /> Bekor
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-success btn-sm" onClick={() => handleRestore(b.id)}>
                    <Icon.Check /> Tiklash
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}>
                    <Icon.Trash /> O'chirish
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      {editBooking && (
        <BookingModal
          booking={editBooking}
          bookings={bookings}
          regulars={regulars}
          onSave={(updated) => {
            setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            showToast("Bron yangilandi", "success");
            setEditBooking(null);
          }}
          onClose={() => setEditBooking(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// REGULARS VIEW
// ══════════════════════════════════════════════════════════

function AddRegularModal({ regular, bookings, regulars, onSave, onClose }) {
  const isEdit = !!regular;
  const [form, setForm] = useState({
    clientName: regular?.clientName || "",
    phone: regular?.phone || "",
    stadiumId: regular?.stadiumId || "open",
    days: regular?.days || [],
    startMinute: regular?.startMinute || null,
    duration: regular?.duration || 60,
    note: regular?.note || "",
  });
  const [errors, setErrors] = useState({});

  const handleDay = (d) => {
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d],
      startMinute: null,
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.clientName.trim()) e.clientName = "Ism kiritilmagan";
    if (!form.phone.trim()) e.phone = "Telefon kiritilmagan";
    else if (!validatePhone(form.phone)) e.phone = "Noto'g'ri format";
    if (form.days.length === 0) e.days = "Kamida bir kun tanlang";
    if (!form.startMinute) e.startMinute = "Vaqt tanlang";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      id: regular?.id || generateId(),
      clientName: form.clientName.trim(),
      phone: form.phone.trim(),
      stadiumId: form.stadiumId,
      days: form.days,
      startMinute: form.startMinute,
      endMinute: form.startMinute + form.duration,
      duration: form.duration,
      note: form.note.trim(),
      paused: regular?.paused || false,
      skippedDates: regular?.skippedDates || [],
      createdAt: regular?.createdAt || Date.now(),
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <span className="modal-title">{isEdit ? "Doimiy tahrirlash" : "Doimiy mijoz qo'shish"}</span>
          <button className="modal-close" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Ism *</label>
            <input
              className="form-input"
              placeholder="To'liq ism"
              value={form.clientName}
              onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
            />
            {errors.clientName && <div className="form-error">{errors.clientName}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Telefon *</label>
            <input
              className="form-input"
              placeholder="+998 90 123 45 67"
              value={form.phone}
              inputMode="tel"
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            {errors.phone && <div className="form-error">{errors.phone}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Stadion *</label>
            <select
              className="form-input"
              value={form.stadiumId}
              onChange={(e) => setForm((f) => ({ ...f, stadiumId: e.target.value, startMinute: null }))}
            >
              {STADIUMS.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Kunlar *</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {DAYS_FULL.map((day, i) => (
                <button
                  key={i}
                  className="btn btn-sm"
                  style={{
                    background: form.days.includes(i) ? "var(--accent)" : "var(--bg3)",
                    color: form.days.includes(i) ? "white" : "var(--text2)",
                    borderColor: form.days.includes(i) ? "var(--accent)" : "var(--border2)",
                  }}
                  onClick={() => handleDay(i)}
                >
                  {DAYS_UZ[i]}
                </button>
              ))}
            </div>
            {errors.days && <div className="form-error">{errors.days}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Davomiylik *</label>
            <select
              className="form-input"
              value={form.duration}
              onChange={(e) =>
                setForm((f) => ({ ...f, duration: Number(e.target.value), startMinute: null }))
              }
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Vaqt *</label>
            <select
              className="form-input"
              value={form.startMinute || ""}
              onChange={(e) => setForm((f) => ({ ...f, startMinute: Number(e.target.value) }))}
            >
              <option value="">— Vaqt tanlang —</option>
              {TIME_SLOTS.filter((s) => s.minutes + form.duration <= 1440 + 30).map((s) => (
                <option key={s.minutes} value={s.minutes}>
                  {s.label} → {minutesToLabel(s.minutes + form.duration)}
                </option>
              ))}
            </select>
            {errors.startMinute && <div className="form-error">{errors.startMinute}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Izoh</label>
            <input
              className="form-input"
              placeholder="Ixtiyoriy"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-full" onClick={onClose}>Bekor</button>
          <button className="btn btn-primary btn-full" onClick={handleSave}>
            {isEdit ? "Saqlash" : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RegularsView({ regulars, setRegulars, bookings, showToast, showConfirm }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editRegular, setEditRegular] = useState(null);
  const [skipModal, setSkipModal] = useState(null);

  const handleSave = (reg) => {
    setRegulars((prev) => {
      const exists = prev.find((r) => r.id === reg.id);
      return exists ? prev.map((r) => (r.id === reg.id ? reg : r)) : [...prev, reg];
    });
    showToast(editRegular ? "Doimiy yangilandi" : "Doimiy mijoz qo'shildi", "success");
    setShowAdd(false);
    setEditRegular(null);
  };

  const handleDelete = (id) => {
    showConfirm(
      "Doimiy o'chirish",
      "Doimiy mijozni butunlay o'chirishni tasdiqlaysizmi?",
      () => {
        setRegulars((prev) => prev.filter((r) => r.id !== id));
        showToast("Doimiy o'chirildi", "success");
      },
      true
    );
  };

  const handlePauseToggle = (id) => {
    setRegulars((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, paused: !r.paused } : r
      )
    );
    const reg = regulars.find((r) => r.id === id);
    showToast(reg?.paused ? "Doimiy tiklandi" : "Doimiy to'xtatildi", "warning");
  };

  const handleSkipWeek = (reg) => {
    const nextDates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayIdx = d.getDay();
      if (reg.days.includes(dayIdx)) {
        nextDates.push(d.toISOString().split("T")[0]);
        break;
      }
    }
    if (nextDates.length === 0) {
      showToast("Yaqin kun topilmadi", "error");
      return;
    }
    const dateToSkip = nextDates[0];
    setRegulars((prev) =>
      prev.map((r) =>
        r.id === reg.id
          ? { ...r, skippedDates: [...(r.skippedDates || []), dateToSkip] }
          : r
      )
    );
    showToast(`${formatDate(dateToSkip)} o'tkazib yuborildi`, "warning");
  };

  return (
    <div className="main">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div className="section-label" style={{ margin: 0, borderBottom: "none", padding: 0 }}>
          Doimiy mijozlar ({regulars.length})
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAdd(true)}
        >
          <Icon.Plus /> Qo'shish
        </button>
      </div>

      {regulars.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔄</div>
          <h3>Doimiy mijozlar yo'q</h3>
          <p>Har hafta takrorlanadigan bronlarni shu yerda boshqaring</p>
        </div>
      ) : (
        regulars.map((r) => (
          <div key={r.id} className={`regular-item ${r.paused ? "paused" : ""}`}>
            <div className="booking-top">
              <div style={{ flex: 1 }}>
                <div className="booking-name">{r.clientName}</div>
                <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "2px" }}>
                  {r.phone}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontFamily: "var(--mono)",
                    color: "var(--text2)",
                    fontWeight: 500,
                  }}
                >
                  {minutesToLabel(r.startMinute)}–{minutesToLabel(r.startMinute + r.duration)}
                </div>
                {r.paused && (
                  <span className="badge badge-cancelled" style={{ marginTop: "4px" }}>
                    To'xtatilgan
                  </span>
                )}
              </div>
            </div>

            <div className="booking-meta" style={{ marginTop: "10px" }}>
              <span className={`badge ${r.stadiumId === "open" ? "badge-open" : "badge-closed"}`}>
                {STADIUMS.find((s) => s.id === r.stadiumId)?.name}
              </span>
              <span className="badge badge-regular">
                {DURATION_OPTIONS.find((d) => d.value === r.duration)?.label}
              </span>
            </div>

            <div className="regular-days">
              {r.days.sort().map((d) => (
                <span key={d} className="day-chip">{DAYS_FULL[d]}</span>
              ))}
            </div>

            {r.skippedDates && r.skippedDates.length > 0 && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--amber)",
                  marginTop: "8px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px",
                }}
              >
                <span>O'tkazib yuborilgan:</span>
                {r.skippedDates.map((d) => (
                  <span
                    key={d}
                    style={{
                      background: "var(--amber-soft)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setRegulars((prev) =>
                        prev.map((reg) =>
                          reg.id === r.id
                            ? { ...reg, skippedDates: reg.skippedDates.filter((sd) => sd !== d) }
                            : reg
                        )
                      );
                    }}
                  >
                    {formatDate(d)} ✕
                  </span>
                ))}
              </div>
            )}

            <div className="booking-actions" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditRegular(r)}>
                <Icon.Edit /> Tahrirlash
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleSkipWeek(r)}>
                <Icon.Skip /> O'tkazish
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handlePauseToggle(r.id)}>
                {r.paused ? <><Icon.Play /> Tiklash</> : <><Icon.Pause /> To'xtatish</>}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                <Icon.Trash /> O'chirish
              </button>
            </div>
          </div>
        ))
      )}

      {(showAdd || editRegular) && (
        <AddRegularModal
          regular={editRegular}
          bookings={bookings}
          regulars={regulars}
          onSave={handleSave}
          onClose={() => {
            setShowAdd(false);
            setEditRegular(null);
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ARCHIVE VIEW
// ══════════════════════════════════════════════════════════

function ArchiveView({ bookings }) {
  const [search, setSearch] = useState("");
  const [filterStadium, setFilterStadium] = useState("all");
  const today = todayStr();

  const archived = bookings.filter((b) => b.date < today && !b.cancelled);

  const filtered = archived.filter((b) => {
    if (filterStadium !== "all" && b.stadiumId !== filterStadium) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        b.clientName.toLowerCase().includes(s) ||
        b.phone.includes(s) ||
        b.date.includes(s)
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (a.date > b.date ? -1 : 1));

  return (
    <div className="main">
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{archived.length}</div>
          <div className="stat-label">Jami</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {archived.filter((b) => b.stadiumId === "open").length}
          </div>
          <div className="stat-label">Ochiq</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {archived.filter((b) => b.stadiumId === "closed").length}
          </div>
          <div className="stat-label">Yopiq</div>
        </div>
      </div>

      <div className="search-box">
        <span className="search-icon"><Icon.Search /></span>
        <input
          className="form-input"
          placeholder="Ism, telefon, sana..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="toggle-row" style={{ marginBottom: "16px" }}>
        {[
          { key: "all", label: "Hammasi" },
          { key: "open", label: "⛳ Ochiq" },
          { key: "closed", label: "🏟️ Yopiq" },
        ].map((t) => (
          <button
            key={t.key}
            className={`toggle-btn ${filterStadium === t.key ? "active" : ""}`}
            onClick={() => setFilterStadium(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗄️</div>
          <h3>Arxiv bo'sh</h3>
          <p>Tugagan bronlar avtomatik shu yerga keladi</p>
        </div>
      ) : (
        sorted.map((b) => (
          <div key={b.id} className="booking-item">
            <div className="booking-top">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="booking-name">{b.clientName}</div>
                <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "2px" }}>
                  {b.phone}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontFamily: "var(--mono)",
                    color: "var(--text2)",
                  }}
                >
                  {minutesToLabel(b.startMinute)}–{minutesToLabel(b.endMinute)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
                  {formatDate(b.date)}
                </div>
              </div>
            </div>
            <div className="booking-meta">
              <span className={`badge ${b.stadiumId === "open" ? "badge-open" : "badge-closed"}`}>
                {STADIUMS.find((s) => s.id === b.stadiumId)?.name}
              </span>
              {b.note && (
                <span className="badge" style={{ background: "var(--bg3)", color: "var(--text3)" }}>
                  📝 {b.note}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════

export default function App() {
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [bookings, setBookingsState] = useState(() => loadState("sb_bookings", []));
  const [regulars, setRegularsState] = useState(() => loadState("sb_regulars", []));
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const toastTimers = useRef({});

  const setBookings = useCallback((updater) => {
    setBookingsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState("sb_bookings", next);
      return next;
    });
  }, []);

  const setRegulars = useCallback((updater) => {
    setRegularsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState("sb_regulars", next);
      return next;
    });
  }, []);

  const showToast = useCallback((message, type = "success") => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    toastTimers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const showConfirm = useCallback((title, text, onConfirm, danger = false) => {
    setConfirmState({ title, text, onConfirm, danger });
  }, []);

  useEffect(() => () => Object.values(toastTimers.current).forEach(clearTimeout), []);

  const handleAddBooking = (booking) => {
    setBookings((prev) => [...prev, booking]);
    showToast("Bron muvaffaqiyatli qo'shildi", "success");
    setShowAddBooking(false);
  };

  const navItems = [
    { key: VIEWS.DASHBOARD, label: "Dashboard", Icon: Icon.Home },
    { key: VIEWS.BOOKINGS, label: "Bronlar", Icon: Icon.Calendar },
    { key: VIEWS.REGULARS, label: "Doimiy", Icon: Icon.Users },
    { key: VIEWS.ARCHIVE, label: "Arxiv", Icon: Icon.Archive },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Toast */}
        <Toast toasts={toasts} />

        {/* Confirm Modal */}
        {confirmState && (
          <ConfirmModal
            title={confirmState.title}
            text={confirmState.text}
            danger={confirmState.danger}
            onConfirm={() => {
              confirmState.onConfirm();
              setConfirmState(null);
            }}
            onCancel={() => setConfirmState(null)}
          />
        )}

        {/* Header */}
        <div className="header">
          <div className="header-logo">
            Stadium<span>Pro</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text3)", fontFamily: "var(--mono)" }}>
            {new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </div>
        </div>

        {/* Views */}
        {view === VIEWS.DASHBOARD && (
          <DashboardView
            bookings={bookings}
            regulars={regulars}
            onAddBooking={() => setShowAddBooking(true)}
          />
        )}
        {view === VIEWS.BOOKINGS && (
          <BookingsView
            bookings={bookings}
            regulars={regulars}
            setBookings={setBookings}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        )}
        {view === VIEWS.REGULARS && (
          <RegularsView
            regulars={regulars}
            setRegulars={setRegulars}
            bookings={bookings}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        )}
        {view === VIEWS.ARCHIVE && <ArchiveView bookings={bookings} />}

        {/* FAB */}
        <button className="fab" onClick={() => setShowAddBooking(true)} aria-label="Yangi bron">
          <Icon.Plus />
        </button>

        {/* Bottom Nav */}
        <div className="bottom-nav">
          {navItems.map(({ key, label, Icon: NavIcon }) => (
            <button
              key={key}
              className={`nav-item ${view === key ? "active" : ""}`}
              onClick={() => setView(key)}
            >
              <NavIcon />
              {label}
            </button>
          ))}
        </div>

        {/* Add Booking Modal */}
        {showAddBooking && (
          <BookingModal
            bookings={bookings}
            regulars={regulars}
            onSave={handleAddBooking}
            onClose={() => setShowAddBooking(false)}
            showToast={showToast}
          />
        )}
      </div>
    </>
  );
}