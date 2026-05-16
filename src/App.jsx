import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── SOCKET SINGLETON ───────────────────────────────────────────────────────
let socket = null;
const getSocket = () => {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || '', { path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return socket;
};

// ─── AXIOS CONFIG ────────────────────────────────────────────────────────────
const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('admin_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
// admin
// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STADIUMS = [
  { id: 'open', name: 'Ochiq Stadion', type: 'open', price: 200000, emoji: '🏟️', desc: 'Chiroqlar va suniy maysazor bilan jihozlangan chempionat darajasidagi ochiq maydon.' },
  { id: 'indoor', name: 'Yopiq Stadion', type: 'indoor', price: 200000, emoji: '🏛️', desc: 'Premium sintetik yuzali iqlim nazorati ostidagi yopiq arena.' },
];
const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 6..24
const UZS = n => new Intl.NumberFormat('uz-UZ').format(n) + ' UZS';
const TODAY = () => new Date().toISOString().split('T')[0];
const pad = n => String(n).padStart(2, '0');
const fmtHour = h => `${pad(h % 24)}:00`;

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────
const ToastContext = React.createContext(null);
const useToast = () => React.useContext(ToastContext);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={add}>
      {children}
      <div style={{ position: 'fixed', bottom: 28, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                background: t.type === 'success' ? 'linear-gradient(135deg,#0f3 0%,#0a9a00 100%)' :
                  t.type === 'error' ? 'linear-gradient(135deg,#ff3b30 0%,#a00000 100%)' :
                    'linear-gradient(135deg,#1a1f2e 0%,#0d1117 100%)',
                border: `1px solid ${t.type === 'success' ? '#00ff6640' : t.type === 'error' ? '#ff3b3040' : '#ffffff15'}`,
                borderRadius: 14, padding: '12px 20px', color: '#fff',
                fontSize: 14, fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)', maxWidth: 320,
                backdropFilter: 'blur(20px)',
              }}
            >
              {t.type === 'success' ? '✅ ' : t.type === 'error' ? '❌ ' : 'ℹ️ '}{t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #04060d;
      --surface: #080c16;
      --surface2: #0d1221;
      --surface3: #111827;
      --border: rgba(255,255,255,0.07);
      --border-glow: rgba(0,255,102,0.3);
      --green: #00ff66;
      --green-dim: #00cc52;
      --red: #ff3b30;
      --gold: #ffd700;
      --blue: #4f9eff;
      --text: #f0f4ff;
      --text2: #8892a8;
      --text3: #4a5568;
      --font-display: 'Bebas Neue', sans-serif;
      --font-heading: 'Syne', sans-serif;
      --font-body: 'DM Sans', sans-serif;
      --radius: 16px;
      --radius-lg: 24px;
      --shadow: 0 8px 32px rgba(0,0,0,0.5);
      --shadow-glow: 0 0 40px rgba(0,255,102,0.15);
    }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--surface); }
    ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 99px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--green-dim); }
    input, select, textarea {
      font-family: var(--font-body);
      outline: none;
      border: none;
    }
    button { cursor: pointer; border: none; font-family: var(--font-body); }
    a { text-decoration: none; color: inherit; }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 10px rgba(0,255,102,0.4), 0 0 30px rgba(0,255,102,0.1); }
      50% { box-shadow: 0 0 20px rgba(0,255,102,0.7), 0 0 60px rgba(0,255,102,0.25); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    @keyframes spin-slow {
      to { transform: rotate(360deg); }
    }
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes ripple {
      0% { transform: scale(0); opacity: 0.5; }
      100% { transform: scale(4); opacity: 0; }
    }
    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .glass {
      background: rgba(13, 18, 33, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
    }
    .glass-bright {
      background: rgba(20, 28, 50, 0.85);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .glow-text {
      text-shadow: 0 0 20px rgba(0,255,102,0.5);
    }
    .shimmer-text {
      background: linear-gradient(90deg, #fff 25%, var(--green) 50%, #fff 75%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmer 3s linear infinite;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--green) 0%, #00b347 100%);
      color: #000;
      font-weight: 700;
      font-family: var(--font-heading);
      border-radius: 12px;
      padding: 14px 28px;
      font-size: 15px;
      letter-spacing: 0.5px;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0,255,102,0.35);
    }
    .btn-primary:active { transform: translateY(0); }
    .btn-secondary {
      background: transparent;
      color: var(--text);
      font-weight: 600;
      font-family: var(--font-heading);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 13px 24px;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-secondary:hover {
      border-color: var(--green);
      color: var(--green);
      background: rgba(0,255,102,0.05);
    }
    .btn-danger {
      background: linear-gradient(135deg, var(--red) 0%, #a00 100%);
      color: #fff;
      font-weight: 600;
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 13px;
      transition: all 0.2s;
    }
    .btn-danger:hover { opacity: 0.85; transform: scale(0.98); }
    .field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .field label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--text2);
      font-family: var(--font-heading);
    }
    .field input, .field select {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 13px 16px;
      color: var(--text);
      font-size: 15px;
      font-family: var(--font-body);
      transition: all 0.2s;
      width: 100%;
    }
    .field input:focus, .field select:focus {
      border-color: var(--green);
      background: rgba(0,255,102,0.04);
      box-shadow: 0 0 0 3px rgba(0,255,102,0.08);
    }
    .field select option { background: #0d1221; }
    .slot-available {
      background: rgba(0,255,102,0.1);
      border: 1px solid rgba(0,255,102,0.3);
      color: var(--green);
    }
    .slot-booked {
      background: rgba(255,59,48,0.1);
      border: 1px solid rgba(255,59,48,0.3);
      color: var(--red);
      cursor: not-allowed;
    }
    .slot-active {
      animation: pulse-glow 2s infinite;
      background: rgba(0,255,102,0.15);
      border: 1px solid var(--green);
      color: var(--green);
    }
    @media (max-width: 768px) {
      .hide-mobile { display: none !important; }
    }
    @media (min-width: 769px) {
      .hide-desktop { display: none !important; }
    }
  `}</style>
);

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
function LoadingScreen({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
      style={{ position: 'fixed', inset: 0, background: '#04060d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, type: 'spring' }}
        style={{ fontSize: 72, marginBottom: 24, animation: 'float 3s ease-in-out infinite' }}>⚽</motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 52, letterSpacing: 6, color: '#fff', marginBottom: 6 }}>
        STADIUMX
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        style={{ color: '#00ff66', fontSize: 13, letterSpacing: 4, fontFamily: 'Syne, sans-serif', marginBottom: 40 }}>
        PREMIUM FUTBOL BRONLASH
      </motion.div>
      <motion.div initial={{ width: 0 }} animate={{ width: 200 }} transition={{ delay: 0.9, duration: 1.2, ease: 'easeInOut' }}
        style={{ height: 2, background: 'linear-gradient(90deg, transparent, #00ff66, transparent)', borderRadius: 99 }} />
    </motion.div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ page, setPage, adminToken, onAdminLogout }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  const navLinks = [
    { label: 'Bosh sahifa', key: 'home' },
    { label: 'Bronlash', key: 'book' },
    { label: 'Stadionlar', key: 'stadiums' },
  ];
  return (
    <motion.nav initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        transition: 'all 0.3s',
        background: scrolled ? 'rgba(4,6,13,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        <button onClick={() => setPage('home')} style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚽</span>
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: 3, color: '#fff' }}>STADIUMX</span>
        </button>
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navLinks.map(l => (
            <button key={l.key} onClick={() => setPage(l.key)}
              style={{
                background: page === l.key ? 'rgba(0,255,102,0.08)' : 'none',
                color: page === l.key ? 'var(--green)' : 'var(--text2)',
                border: page === l.key ? '1px solid rgba(0,255,102,0.2)' : '1px solid transparent',
                borderRadius: 10, padding: '8px 18px', fontSize: 14,
                fontFamily: 'Syne, sans-serif', fontWeight: 600, transition: 'all 0.2s',
              }}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="hide-mobile" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {adminToken ? (
            <>
              <button onClick={() => setPage('admin')} className="btn-secondary" style={{ padding: '9px 18px', fontSize: 13 }}>Admin Panel</button>
              <button onClick={onAdminLogout} className="btn-danger" style={{ padding: '9px 16px', fontSize: 13 }}>Chiqish</button>
            </>
          ) : (
            <button onClick={() => setPage('admin-login')} className="btn-secondary" style={{ padding: '9px 18px', fontSize: 13 }}>Admin</button>
          )}
          <button onClick={() => setPage('book')} className="btn-primary" style={{ padding: '10px 22px', fontSize: 14 }}>Bronlash</button>
        </div>
        <button className="hide-desktop" onClick={() => setMobileOpen(v => !v)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 18 }}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ background: 'rgba(4,6,13,0.98)', borderTop: '1px solid var(--border)', padding: '16px 24px 20px' }}>
            {navLinks.map(l => (
              <button key={l.key} onClick={() => { setPage(l.key); setMobileOpen(false); }}
                style={{ display: 'block', width: '100%', background: 'none', color: page === l.key ? 'var(--green)' : 'var(--text2)', textAlign: 'left', padding: '12px 0', fontSize: 16, fontFamily: 'Syne, sans-serif', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {l.label}
              </button>
            ))}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {adminToken ? (
                <button onClick={() => { setPage('admin'); setMobileOpen(false); }} className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}>Admin Panel</button>
              ) : (
                <button onClick={() => { setPage('admin-login'); setMobileOpen(false); }} className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}>Admin kirish</button>
              )}
              <button onClick={() => { setPage('book'); setMobileOpen(false); }} className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>Bronlash</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ─── HERO SECTION ─────────────────────────────────────────────────────────────
function HeroSection({ setPage }) {
  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingTop: 80 }}>
      {/* Animated background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '5%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,255,102,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(79,158,255,0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.5 }} />
      </div>
      <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,255,102,0.08)', border: '1px solid rgba(0,255,102,0.2)', borderRadius: 99, padding: '6px 18px', marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff66', animation: 'blink 1.5s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#00ff66', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: 1.5 }}>REAL VAQTDA MAVJUDLIK</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(60px, 12vw, 120px)', letterSpacing: 4, lineHeight: 0.95, marginBottom: 24, color: '#fff' }}>
          STADIONINGIZNI<br />
          <span className="shimmer-text">HOZIROQ</span><br />
          BRONLANG
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ fontSize: 18, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
          Premium futbol maydonlarini soniyalar ichida band qiling. Real vaqtda slot mavjudligi, darhol tasdiqlash va qulay bronlash tajribasi.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setPage('book')} className="btn-primary" style={{ padding: '16px 36px', fontSize: 16, borderRadius: 14 }}>
            ⚽ Bronlash
          </button>
          <button onClick={() => setPage('stadiums')} className="btn-secondary" style={{ padding: '16px 36px', fontSize: 16, borderRadius: 14 }}>
            Stadionlarni ko'rish →
          </button>
        </motion.div>
        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 70, flexWrap: 'wrap' }}>
          {[['2', 'Premium Maydon'], ['18soat', 'Kunlik Kirish'], ['200K', 'UZS/Soat']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, color: '#fff', letterSpacing: 2 }}>{v}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'Syne, sans-serif' }}>{l}</div>
            </div>
          ))}
        </motion.div>
      </div>
      {/* Scroll hint */}
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
        style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', color: 'var(--text3)', fontSize: 22 }}>↓</motion.div>
    </section>
  );
}

// ─── STADIUM CARDS ────────────────────────────────────────────────────────────
function StadiumCard({ stadium, onBook, compact }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      style={{
        background: hovered ? 'rgba(20,30,55,0.9)' : 'rgba(13,18,33,0.7)',
        border: hovered ? '1px solid rgba(0,255,102,0.35)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 24, overflow: 'hidden', cursor: 'pointer', position: 'relative',
        backdropFilter: 'blur(20px)', transition: 'all 0.3s',
        boxShadow: hovered ? '0 20px 60px rgba(0,255,102,0.1), 0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.3)',
      }}>
      {/* Top gradient */}
      <div style={{
        height: compact ? 140 : 200, position: 'relative', overflow: 'hidden',
        background: stadium.type === 'open'
          ? 'linear-gradient(135deg, #0a2e1a 0%, #0d3d20 50%, #1a5c35 100%)'
          : 'linear-gradient(135deg, #0a1a3e 0%, #0d2060 50%, #1a3a80 100%)',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.02) 30px, rgba(255,255,255,0.02) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.02) 30px, rgba(255,255,255,0.02) 31px)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.span animate={{ scale: hovered ? 1.2 : 1 }} transition={{ duration: 0.3 }} style={{ fontSize: compact ? 50 : 72, filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' }}>{stadium.emoji}</motion.span>
        </div>
        <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, letterSpacing: 1.5, color: stadium.type === 'open' ? '#00ff66' : '#4f9eff' }}>
            {stadium.type === 'open' ? 'OCHIQ' : 'YOPIQ'}
          </span>
        </div>
      </div>
      <div style={{ padding: compact ? '18px 20px' : '24px 28px' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: compact ? 18 : 22, marginBottom: 8, color: '#fff' }}>{stadium.name}</h3>
        {!compact && <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>{stadium.desc}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: compact ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'Syne, sans-serif', letterSpacing: 1, marginBottom: 2 }}>SOATIGA</div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, color: '#fff', letterSpacing: 1 }}>{UZS(stadium.price)}</div>
          </div>
          {onBook && (
            <button onClick={() => onBook(stadium)} className="btn-primary" style={{ padding: '10px 20px', fontSize: 13, borderRadius: 12 }}>
              Bronlash
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── STADIUMS PAGE ────────────────────────────────────────────────────────────
function StadiumsPage({ setPage, bookings }) {
  const [selectedStadium, setSelectedStadium] = useState('open');
  const [selectedDate, setSelectedDate] = useState(TODAY());
  const now = new Date();

  const getSlotStatus = (stadiumId, hour) => {
    const dayBookings = bookings.filter(b =>
      b.stadium === stadiumId &&
      b.date === selectedDate &&
      b.status !== 'cancelled' &&
      b.bookedSlots.includes(hour)
    );
    if (dayBookings.length === 0) return 'available';
    const active = dayBookings.find(b => {
      const h = parseInt(b.startTime.split(':')[0]);
      return now.getHours() >= h && now.getHours() < h + b.duration && selectedDate === TODAY();
    });
    return active ? 'active' : 'booked';
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 90, paddingBottom: 60, maxWidth: 1100, margin: '0 auto', padding: '90px 24px 60px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 52, letterSpacing: 3, marginBottom: 6 }}>BIZNING STADIONLAR</h1>
        <p style={{ color: 'var(--text2)', marginBottom: 40 }}>Maydoningizni tanlang va jonli mavjudlikni ko'ring</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 48 }}>
          {STADIUMS.map(s => <StadiumCard key={s.id} stadium={s} onBook={() => setPage('book')} />)}
        </div>
        {/* Availability grid */}
        <div className="glass" style={{ borderRadius: 24, padding: '28px 32px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 28 }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, flex: 1 }}>Jonli Mavjudlik</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {STADIUMS.map(s => (
                <button key={s.id} onClick={() => setSelectedStadium(s.id)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 600,
                    background: selectedStadium === s.id ? (s.type === 'open' ? 'rgba(0,255,102,0.15)' : 'rgba(79,158,255,0.15)') : 'rgba(255,255,255,0.04)',
                    border: selectedStadium === s.id ? `1px solid ${s.type === 'open' ? 'rgba(0,255,102,0.4)' : 'rgba(79,158,255,0.4)'}` : '1px solid var(--border)',
                    color: selectedStadium === s.id ? (s.type === 'open' ? 'var(--green)' : 'var(--blue)') : 'var(--text2)',
                    transition: 'all 0.2s',
                  }}>{s.name}</button>
              ))}
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={TODAY()}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {HOURS.map(h => {
              const status = getSlotStatus(selectedStadium, h);
              return (
                <motion.div key={h} whileHover={status === 'available' ? { scale: 1.05 } : {}}
                  className={status === 'available' ? 'slot-available' : status === 'active' ? 'slot-active' : 'slot-booked'}
                  style={{ borderRadius: 10, padding: '10px 0', textAlign: 'center', fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 600, transition: 'all 0.2s' }}>
                  <div>{fmtHour(h)}</div>
                  <div style={{ fontSize: 9, marginTop: 3, opacity: 0.7, letterSpacing: 0.5 }}>
                    {status === 'available' ? 'BO\'SH' : status === 'active' ? 'JONLI' : 'BAND'}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
            {[['slot-available', '#00ff66', 'Bo\'sh'], ['slot-booked', '#ff3b30', 'Band'], ['slot-active', '#00ff66', 'Hozir Jonli']].map(([cls, color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color + '33', border: `1px solid ${color}66` }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── BOOKING FORM ─────────────────────────────────────────────────────────────
function BookingPage({ bookings, onBookingCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', stadium: 'open', date: TODAY(), startTime: '08', duration: 1 });
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);

  const startHour = parseInt(form.startTime);
  const totalPrice = form.duration * 200000;

  useEffect(() => {
    const taken = bookings
      .filter(b => b.stadium === form.stadium && b.date === form.date && b.status !== 'cancelled')
      .flatMap(b => b.bookedSlots);
    setBookedSlots([...new Set(taken)]);
  }, [bookings, form.stadium, form.date]);

  const isSlotConflict = () => {
    const slots = Array.from({ length: form.duration }, (_, i) => startHour + i);
    return slots.some(s => bookedSlots.includes(s));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) return toast('Barcha maydonlarni to\'ldiring', 'error');
    if (form.phone.length < 9) return toast('To\'g\'ri telefon raqam kiriting', 'error');
    if (startHour < 6 || startHour + form.duration > 24) return toast('Bronlash 06:00–00:00 oralig\'ida bo\'lishi kerak', 'error');
    if (isSlotConflict()) return toast('Tanlangan vaqt allaqachon band!', 'error');
    setLoading(true);
    try {
      const res = await API.post('/bookings', {
        name: form.name, phone: form.phone, stadium: form.stadium,
        date: form.date, startTime: `${pad(startHour)}:00`, duration: form.duration,
      });
      setSuccessData(res.data.booking);
      onBookingCreated(res.data.booking);
      toast('Bronlash tasdiqlandi! 🎉', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Bronlash amalga oshmadi. Qaytadan urinib ko\'ring.', 'error');
    }
    setLoading(false);
  };

  const isConflict = isSlotConflict();

  return (
    <div style={{ minHeight: '100vh', paddingTop: 90, paddingBottom: 60 }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 52, letterSpacing: 3, marginBottom: 6 }}>STADION BRONLASH</h1>
          <p style={{ color: 'var(--text2)', marginBottom: 36 }}>Maydoningizni band qilish uchun ma'lumotlarni kiriting</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            {/* Form */}
            <div className="glass" style={{ borderRadius: 24, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="field">
                <label>To'liq Ism</label>
                <input placeholder="To'liq ismingiz" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Telefon Raqam</label>
                <input placeholder="+998 90 123 45 67" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="field">
                <label>Stadion</label>
                <select value={form.stadium} onChange={e => setForm(f => ({ ...f, stadium: e.target.value }))}>
                  {STADIUMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Sana</label>
                <input type="date" value={form.date} min={TODAY()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Boshlanish Vaqti</label>
                <select value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}>
                  {HOURS.slice(0, 18).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Davomiyligi (soat)</label>
                <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) }))}>
                  {[1, 2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{d} soat</option>)}
                </select>
              </div>
              {isConflict && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--red)' }}>
                  ⚠️ Vaqt to'qnashuvi aniqlandi. Boshqa vaqt tanlang.
                </motion.div>
              )}
              {/* Price summary */}
              <div style={{ background: 'rgba(0,255,102,0.05)', border: '1px solid rgba(0,255,102,0.15)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                  <span>{form.duration} soat × 200,000 UZS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>JAMI</span>
                  <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: 'var(--green)', letterSpacing: 1 }}>{UZS(totalPrice)}</span>
                </div>
              </div>
              <button onClick={handleSubmit} disabled={loading || isConflict} className="btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: 15, opacity: (loading || isConflict) ? 0.6 : 1, cursor: (loading || isConflict) ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Tasdiqlanmoqda...' : '⚽ Bronlashni Tasdiqlash'}
              </button>
            </div>
            {/* Slot visualizer */}
            <div>
              <div className="glass" style={{ borderRadius: 24, padding: '24px 20px' }}>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Vaqt Slotlari Mavjudligi</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {HOURS.map(h => {
                    const isBooked = bookedSlots.includes(h);
                    const isSelected = h >= startHour && h < startHour + form.duration;
                    const isOverlap = isSelected && isBooked;
                    return (
                      <div key={h}
                        style={{
                          borderRadius: 8, padding: '8px 0', textAlign: 'center', fontSize: 12,
                          fontFamily: 'Syne, sans-serif', fontWeight: 600,
                          background: isOverlap ? 'rgba(255,59,48,0.2)' : isSelected ? 'rgba(0,255,102,0.15)' : isBooked ? 'rgba(255,59,48,0.1)' : 'rgba(255,255,255,0.03)',
                          border: isOverlap ? '1px solid rgba(255,59,48,0.5)' : isSelected ? '1px solid rgba(0,255,102,0.4)' : isBooked ? '1px solid rgba(255,59,48,0.3)' : '1px solid rgba(255,255,255,0.05)',
                          color: isOverlap ? 'var(--red)' : isSelected ? 'var(--green)' : isBooked ? 'var(--red)' : 'var(--text3)',
                          transition: 'all 0.15s',
                        }}>
                        {fmtHour(h)}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(0,255,102,0.15)', border: '1px solid rgba(0,255,102,0.4)' }} />
                    Sizning tanlovingiz
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)' }} />
                    Allaqachon band
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {successData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: 24, backdropFilter: 'blur(8px)' }}
            onClick={() => setSuccessData(null)}>
            <motion.div initial={{ scale: 0.8, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'linear-gradient(145deg, #0d1221 0%, #080c16 100%)', border: '1px solid rgba(0,255,102,0.3)', borderRadius: 28, padding: '40px 36px', maxWidth: 440, width: '100%', boxShadow: '0 0 60px rgba(0,255,102,0.15), 0 40px 80px rgba(0,0,0,0.6)', textAlign: 'center' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                style={{ fontSize: 64, marginBottom: 20 }}>🎉</motion.div>
              <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: 3, marginBottom: 6, color: 'var(--green)' }}>BRONLASH TASDIQLANDI!</h2>
              <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 28 }}>Stadioningiz muvaffaqiyatli band qilindi</p>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Bron ID', '#' + successData._id?.slice(-8).toUpperCase()],
                  ['Stadion', STADIUMS.find(s => s.id === successData.stadium)?.name],
                  ['Sana', successData.date],
                  ['Vaqt', `${successData.startTime} — ${fmtHour(parseInt(successData.startTime) + successData.duration)}`],
                  ['Davomiyligi', `${successData.duration} soat`],
                  ['Jami', UZS(successData.totalPrice)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text2)' }}>{k}</span>
                    <span style={{ fontWeight: 600, color: k === 'Jami' ? 'var(--green)' : '#fff' }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setSuccessData(null)} className="btn-primary" style={{ width: '100%', marginTop: 24, padding: '14px' }}>
                Tayyor
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: 'aaaa', password: 'aaaa' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!form.username || !form.password) return toast('Ma\'lumotlarni kiriting', 'error');
    setLoading(true);
    try {
      const res = await API.post('/admin/login', form);
      localStorage.setItem('admin_token', res.data.token);
      onLogin(res.data.token);
      toast('Xush kelibsiz, Admin!', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Noto\'g\'ri ma\'lumotlar', 'error');
    }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 400, background: 'rgba(13,18,33,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28, padding: '44px 36px', backdropFilter: 'blur(20px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 32, letterSpacing: 3 }}>ADMIN KIRISH</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>StadiumX Boshqaruv Paneli</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="field">
            <label>Foydalanuvchi nomi</label>
            <input placeholder="admin" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div className="field">
            <label>Parol</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ width: '100%', padding: '15px', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Kirilmoqda...' : 'Kirish →'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ adminToken, onLogout }) {
  const toast = useToast();
  const [tab, setTab] = useState('dashboard');
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ phone: '', date: '', stadium: '' });

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, aRes] = await Promise.all([API.get('/admin/bookings'), API.get('/admin/analytics')]);
      setBookings(bRes.data);
      setAnalytics(aRes.data);
    } catch (err) {
      if (err.response?.status === 401) onLogout();
    }
    setLoading(false);
  }, [onLogout]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const sock = getSocket();
    sock.on('booking:new', b => { setBookings(prev => [b, ...prev]); fetchAll(); });
    sock.on('booking:cancelled', ({ id }) => { setBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b)); fetchAll(); });
    return () => { sock.off('booking:new'); sock.off('booking:cancelled'); };
  }, [fetchAll]);

  const handleCancel = async id => {
    try {
      await API.patch(`/admin/bookings/${id}/cancel`);
      setBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b));
      toast('Bronlash bekor qilindi', 'success');
      fetchAll();
    } catch { toast('Bekor qilishda xatolik', 'error'); }
  };

  const handleDelete = async id => {
    if (!confirm('Bu bronlashni butunlay o\'chirib tashlamoqchimisiz?')) return;
    try {
      await API.delete(`/admin/bookings/${id}`);
      setBookings(prev => prev.filter(b => b._id !== id));
      toast('Bronlash o\'chirildi', 'success');
      fetchAll();
    } catch { toast('O\'chirishda xatolik', 'error'); }
  };

  const filtered = bookings.filter(b =>
    (!search.phone || b.phone.includes(search.phone)) &&
    (!search.date || b.date === search.date) &&
    (!search.stadium || b.stadium === search.stadium)
  );

  const tabs = [
    { key: 'dashboard', label: '📊 Boshqaruv' },
    { key: 'bookings', label: '📋 Bronlar' },
    { key: 'live', label: '🔴 Jonli Holat' },
    { key: 'analytics', label: '📈 Tahlil' },
  ];

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--green)', borderRadius: '50%' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', paddingTop: 68 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 44, letterSpacing: 3, marginBottom: 4 }}>ADMIN PANEL</h1>
              <p style={{ color: 'var(--text2)', fontSize: 14 }}>StadiumX Boshqaruv Tizimi</p>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 20px', borderRadius: 12, fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 600, whiteSpace: 'nowrap',
                  background: tab === t.key ? 'rgba(0,255,102,0.12)' : 'rgba(255,255,255,0.04)',
                  border: tab === t.key ? '1px solid rgba(0,255,102,0.3)' : '1px solid var(--border)',
                  color: tab === t.key ? 'var(--green)' : 'var(--text2)',
                  transition: 'all 0.2s',
                }}>{t.label}</button>
            ))}
          </div>

          {/* Dashboard */}
          {tab === 'dashboard' && analytics && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Jami Bronlar', value: analytics.total, icon: '📋', color: 'var(--blue)' },
                  { label: 'Faol Bronlar', value: analytics.active, icon: '✅', color: 'var(--green)' },
                  { label: 'Bugungi Daromad', value: UZS(analytics.dailyRevenue), icon: '💰', color: 'var(--gold)', small: true },
                  { label: 'Oylik Daromad', value: UZS(analytics.monthlyRevenue), icon: '📆', color: '#ff9500', small: true },
                  { label: 'Yillik Daromad', value: UZS(analytics.yearlyRevenue), icon: '🏆', color: '#bf5af2', small: true },
                  { label: 'Umumiy Daromad', value: UZS(analytics.totalRevenue), icon: '💎', color: 'var(--green)', small: true },
                ].map(card => (
                  <motion.div key={card.label} whileHover={{ y: -3 }}
                    style={{ background: 'rgba(13,18,33,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '20px 22px', backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: 24, marginBottom: 10 }}>{card.icon}</div>
                    <div style={{ fontSize: card.small ? 18 : 28, fontFamily: 'Bebas Neue, sans-serif', color: card.color, letterSpacing: 1, lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, fontFamily: 'Syne, sans-serif', letterSpacing: 0.5 }}>{card.label}</div>
                  </motion.div>
                ))}
              </div>
              {/* Recent bookings preview */}
              <div className="glass" style={{ borderRadius: 20, padding: '24px' }}>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>So'nggi Bronlar</h3>
                {bookings.slice(0, 5).map(b => (
                  <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{b.name}</span>
                      <span style={{ color: 'var(--text2)', marginLeft: 10 }}>{b.phone}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: 'var(--text2)' }}>{b.stadium === 'open' ? '🏟️' : '🏛️'} {b.date}</span>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                        background: b.status === 'active' ? 'rgba(0,255,102,0.15)' : b.status === 'cancelled' ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.08)',
                        color: b.status === 'active' ? 'var(--green)' : b.status === 'cancelled' ? 'var(--red)' : 'var(--text2)',
                        border: `1px solid ${b.status === 'active' ? 'rgba(0,255,102,0.3)' : b.status === 'cancelled' ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                        {b.status === 'active' ? 'FAOL' : b.status === 'cancelled' ? 'BEKOR' : b.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bookings tab */}
          {tab === 'bookings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <input placeholder="Telefon raqam bo'yicha..." value={search.phone} onChange={e => setSearch(s => ({ ...s, phone: e.target.value }))}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, fontFamily: 'DM Sans, sans-serif', flex: 1, minWidth: 160 }} />
                <input type="date" value={search.date} onChange={e => setSearch(s => ({ ...s, date: e.target.value }))}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }} />
                <select value={search.stadium} onChange={e => setSearch(s => ({ ...s, stadium: e.target.value }))}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
                  <option value="">Barcha Stadionlar</option>
                  {STADIUMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {(search.phone || search.date || search.stadium) && (
                  <button onClick={() => setSearch({ phone: '', date: '', stadium: '' })} className="btn-secondary" style={{ padding: '10px 16px', fontSize: 13 }}>Tozalash</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>Bronlar topilmadi</div>}
                {filtered.map(b => (
                  <motion.div key={b._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    style={{ background: 'rgba(13,18,33,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, backdropFilter: 'blur(10px)' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{b.name}</div>
                      <div style={{ color: 'var(--text2)', fontSize: 13 }}>{b.phone}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>#{b._id?.slice(-8).toUpperCase()}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160, fontSize: 13 }}>
                      <div>{b.stadium === 'open' ? '🏟️ Ochiq Stadion' : '🏛️ Yopiq Stadion'}</div>
                      <div style={{ color: 'var(--text2)', marginTop: 2 }}>{b.date} · {b.startTime} ({b.duration}soat)</div>
                      <div style={{ color: 'var(--green)', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginTop: 2 }}>{UZS(b.totalPrice)}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                        background: b.status === 'active' ? 'rgba(0,255,102,0.15)' : b.status === 'cancelled' ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.08)',
                        color: b.status === 'active' ? 'var(--green)' : b.status === 'cancelled' ? 'var(--red)' : 'var(--text2)',
                        border: `1px solid ${b.status === 'active' ? 'rgba(0,255,102,0.3)' : b.status === 'cancelled' ? 'rgba(255,59,48,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                        {b.status === 'active' ? 'FAOL' : b.status === 'cancelled' ? 'BEKOR' : b.status?.toUpperCase()}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {b.status !== 'cancelled' && (
                          <button onClick={() => handleCancel(b._id)} className="btn-danger" style={{ padding: '6px 14px', fontSize: 12 }}>Bekor qilish</button>
                        )}
                        <button onClick={() => handleDelete(b._id)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text2)', borderRadius: 8, padding: '6px 12px', fontSize: 12, transition: 'all 0.2s' }}>
                          O'chirish
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Live Status */}
          {tab === 'live' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', animation: 'blink 1.5s infinite' }} />
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'var(--green)', fontSize: 14 }}>JONLI — Avtomatik yangilanmoqda</span>
              </div>
              {STADIUMS.map(stadium => {
                const today = TODAY();
                const nowH = new Date().getHours();
                const todayBookings = bookings.filter(b => b.stadium === stadium.id && b.date === today && b.status !== 'cancelled');
                const currentBooking = todayBookings.find(b => {
                  const h = parseInt(b.startTime);
                  return nowH >= h && nowH < h + b.duration;
                });
                return (
                  <div key={stadium.id} className="glass" style={{ borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>{stadium.emoji} {stadium.name}</h3>
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
                          {currentBooking ? `🔴 Hozir band: ${currentBooking.name}` : '🟢 Hozir bo\'sh'}
                        </div>
                      </div>
                      {currentBooking && (
                        <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 13 }}>
                          <div style={{ color: 'var(--red)', fontWeight: 600 }}>{currentBooking.name}</div>
                          <div style={{ color: 'var(--text2)' }}>{currentBooking.startTime} + {currentBooking.duration}soat</div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                      {HOURS.map(h => {
                        const isBooked = todayBookings.some(b => b.bookedSlots.includes(h));
                        const isNow = h === nowH;
                        return (
                          <div key={h}
                            className={isBooked ? 'slot-booked' : isNow ? 'slot-active' : 'slot-available'}
                            style={{ borderRadius: 8, padding: '8px 0', textAlign: 'center', fontSize: 12, fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                            {fmtHour(h)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Analytics */}
          {tab === 'analytics' && analytics && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {/* Revenue chart */}
                <div className="glass" style={{ borderRadius: 20, padding: '24px', gridColumn: '1 / -1' }}>
                  <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Daromad Ko'rinishi (So'nggi 7 kun)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={analytics.revenueChart || []}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff66" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00ff66" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#8892a8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#8892a8', fontSize: 11 }} tickFormatter={v => (v / 1000) + 'K'} />
                      <Tooltip contentStyle={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff' }} formatter={v => UZS(v)} />
                      <Area type="monotone" dataKey="revenue" stroke="#00ff66" strokeWidth={2} fill="url(#revenueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Bookings chart */}
                <div className="glass" style={{ borderRadius: 20, padding: '24px' }}>
                  <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Kunlik Bronlar</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.revenueChart || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#8892a8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#8892a8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff' }} />
                      <Bar dataKey="count" fill="#4f9eff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Stadium split */}
                <div className="glass" style={{ borderRadius: 20, padding: '24px' }}>
                  <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Stadion Foydalanish Ulushi</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={analytics.stadiumSplit || []} dataKey="count" nameKey="stadium" cx="50%" cy="50%" outerRadius={70} paddingAngle={4}>
                        {(analytics.stadiumSplit || []).map((_, i) => <Cell key={i} fill={i === 0 ? '#00ff66' : '#4f9eff'} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff' }} />
                      <Legend formatter={(v) => <span style={{ color: '#8892a8', fontSize: 12 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState('home');
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('admin_token'));
  const [bookings, setBookings] = useState([]);

  // Fetch public bookings on mount
  useEffect(() => {
    API.get('/bookings').then(r => setBookings(r.data)).catch(() => {});
  }, []);

  // Realtime
  useEffect(() => {
    const sock = getSocket();
    sock.on('booking:new', b => setBookings(prev => [...prev, b]));
    sock.on('booking:cancelled', ({ id }) => setBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b)));
    return () => { sock.off('booking:new'); sock.off('booking:cancelled'); };
  }, []);

  const handleLogin = token => { setAdminToken(token); setPage('admin'); };
  const handleLogout = () => { localStorage.removeItem('admin_token'); setAdminToken(null); setPage('home'); };

  const renderPage = () => {
    switch (page) {
      case 'home': return (
        <>
          <HeroSection setPage={setPage} />
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: 48 }}>
              <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 42, letterSpacing: 3, marginBottom: 8 }}>MAYDONINGIZNI TANLANG</h2>
              <p style={{ color: 'var(--text2)' }}>O'yiningiz uchun ikkita premium maydon tayyor</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              {STADIUMS.map(s => <StadiumCard key={s.id} stadium={s} onBook={() => setPage('book')} />)}
            </div>
          </div>
        </>
      );
      case 'stadiums': return <StadiumsPage setPage={setPage} bookings={bookings} />;
      case 'book': return <BookingPage bookings={bookings} onBookingCreated={b => setBookings(prev => [...prev, b])} />;
      case 'admin-login': return <AdminLogin onLogin={handleLogin} />;
      case 'admin': return adminToken ? <AdminPanel adminToken={adminToken} onLogout={handleLogout} /> : <AdminLogin onLogin={handleLogin} />;
      default: return null;
    }
  };

  return (
    <ToastProvider>
      <GlobalStyles />
      <AnimatePresence>
        {!loaded && <LoadingScreen key="loader" onDone={() => setLoaded(true)} />}
      </AnimatePresence>
      {loaded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Navbar page={page} setPage={setPage} adminToken={adminToken} onAdminLogout={handleLogout} />
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
          {/* Footer */}
          <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: 3, color: '#fff', marginBottom: 6 }}>STADIUMX</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>© 2025 StadiumX. Premium Futbol Bronlash Platformasi.</div>
          </footer>
        </motion.div>
      )}
    </ToastProvider>
  );
}