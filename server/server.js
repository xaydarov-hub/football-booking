require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const server = http.createServer(app);

/* ─────────────────────────────────────────────────────────────
   SOCKET.IO
───────────────────────────────────────────────────────────── */

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] },
});

io.on("connection", (socket) => {
  console.log("🔌 Client ulandi:", socket.id);
  socket.on("disconnect", () => console.log("🔌 Client uzildi:", socket.id));
});

/* ─────────────────────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────────────────────── */

app.use(cors({ origin: "*" }));
app.use(express.json());

// So'rovlarni loglash
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ─────────────────────────────────────────────────────────────
   MEMORY DATABASE
───────────────────────────────────────────────────────────── */

let bookings = [];   // { id, name, phone, stadium, date, startTime, duration, bookedSlots, totalPrice, status, createdAt }
let admins   = [];   // { id, username, password }

/* ─────────────────────────────────────────────────────────────
   TELEGRAM BOT
───────────────────────────────────────────────────────────── */

let bot = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  console.log("✅ Telegram bot ishga tushdi");
}

const sendTelegram = async (booking) => {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;

  const stadionNomi = booking.stadium === "open" ? "🏟️ Ochiq Stadion" : "🏛️ Yopiq Stadion";
  const endHour = parseInt(booking.startTime) + booking.duration;
  const endTime = `${String(endHour % 24).padStart(2, "0")}:00`;

  const msg =
    `⚽ *YANGI BRON!*\n\n` +
    `👤 Mijoz: *${booking.name}*\n` +
    `📞 Telefon: \`${booking.phone}\`\n` +
    `${stadionNomi}\n` +
    `📅 Sana: *${booking.date}*\n` +
    `🕐 Vaqt: *${booking.startTime} — ${endTime}*\n` +
    `⏳ Davomiyligi: *${booking.duration} soat*\n` +
    `💰 Jami: *${new Intl.NumberFormat("uz-UZ").format(booking.totalPrice)} so'm*\n` +
    `🆔 ID: \`${String(booking.id)}\``;

  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, msg, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("Telegram xato:", e.message);
  }
};

/* ─────────────────────────────────────────────────────────────
   ADMIN SEED — server ishga tushganda admin yaratish
───────────────────────────────────────────────────────────── */

const seedAdmin = async () => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const exists = admins.find((a) => a.username === username);
  if (exists) return;

  const hashed = await bcrypt.hash(password, 10);
  admins.push({ id: Date.now(), username, password: hashed });
  console.log(`✅ Admin yaratildi → username: "${username}"`);
};

/* ─────────────────────────────────────────────────────────────
   AUTH MIDDLEWARE — JWT tekshirish
───────────────────────────────────────────────────────────── */

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token topilmadi" });
  }

  try {
    const decoded = jwt.verify(
      header.split(" ")[1],
      process.env.JWT_SECRET || "secret"
    );
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token yaroqsiz yoki muddati tugagan" });
  }
};

/* ─────────────────────────────────────────────────────────────
   YORDAMCHI FUNKSIYALAR
───────────────────────────────────────────────────────────── */

// Berilgan stadion, sana va slotlar uchun to'qnashuv tekshirish
const hasConflict = ({ stadium, date, slots, excludeId = null }) => {
  return bookings.some(
    (b) =>
      b.id != excludeId &&
      b.stadium === stadium &&
      b.date === date &&
      b.status === "active" &&
      b.bookedSlots.some((s) => slots.includes(s))
  );
};

// Soatlarni hisoblash
const calcSlots = (startTime, duration) => {
  const start = parseInt(String(startTime).split(":")[0]);
  const dur = Number(duration);
  return { start, dur, slots: Array.from({ length: dur }, (_, i) => start + i) };
};

// Analytics hisoblash
const calcAnalytics = () => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearStr  = String(now.getFullYear());

  const active    = bookings.filter((b) => b.status === "active");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const totalRevenue   = active.reduce((s, b) => s + b.totalPrice, 0);
  const dailyRevenue   = active.filter((b) => b.date === todayStr).reduce((s, b) => s + b.totalPrice, 0);
  const monthlyRevenue = active.filter((b) => b.date.startsWith(monthStr)).reduce((s, b) => s + b.totalPrice, 0);
  const yearlyRevenue  = active.filter((b) => b.date.startsWith(yearStr)).reduce((s, b) => s + b.totalPrice, 0);

  // So'nggi 7 kun uchun grafik
  const revenueChart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const dayBookings = active.filter((b) => b.date === dateStr);
    return {
      date: `${d.getDate()}-${d.getMonth() + 1}`,
      revenue: dayBookings.reduce((s, b) => s + b.totalPrice, 0),
      count: dayBookings.length,
    };
  });

  // Stadion bo'yicha taqsimot
  const stadiumSplit = ["open", "indoor"].map((id) => ({
    stadium: id === "open" ? "Ochiq" : "Yopiq",
    count: active.filter((b) => b.stadium === id).length,
    revenue: active.filter((b) => b.stadium === id).reduce((s, b) => s + b.totalPrice, 0),
  }));

  return {
    total: bookings.length,
    active: active.length,
    cancelled: cancelled.length,
    totalRevenue,
    dailyRevenue,
    monthlyRevenue,
    yearlyRevenue,
    revenueChart,
    stadiumSplit,
  };
};

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════ */

// GET /api/bookings — barcha faol bronlarni olish (frontend uchun)
app.get("/api/bookings", (_req, res) => {
  // Faqat kerakli maydonlarni qaytaramiz (telefon raqamini yashiramiz)
  const safe = bookings.map(({ id, stadium, date, startTime, duration, bookedSlots, status }) => ({
    _id: String(id),
    stadium,
    date,
    startTime,
    duration,
    bookedSlots,
    status,
  }));
  res.json(safe);
});

// POST /api/bookings — yangi bron yaratish
app.post("/api/bookings", (req, res) => {
  try {
    const { name, phone, stadium, date, startTime, duration } = req.body;

    // Validatsiya
    if (!name?.trim())    return res.status(400).json({ message: "Ism kiritilmadi" });
    if (!phone?.trim())   return res.status(400).json({ message: "Telefon kiritilmadi" });
    if (!stadium)         return res.status(400).json({ message: "Stadion tanlanmadi" });
    if (!date)            return res.status(400).json({ message: "Sana kiritilmadi" });
    if (!startTime)       return res.status(400).json({ message: "Vaqt kiritilmadi" });
    if (!duration)        return res.status(400).json({ message: "Davomiylik kiritilmadi" });
    if (!["open", "indoor"].includes(stadium)) return res.status(400).json({ message: "Noto'g'ri stadion" });

    const { start, dur, slots } = calcSlots(startTime, duration);

    if (start < 6 || start + dur > 24) {
      return res.status(400).json({ message: "Bronlash faqat 06:00–00:00 oralig'ida mumkin" });
    }
    if (dur < 1 || dur > 6) {
      return res.status(400).json({ message: "Davomiylik 1–6 soat bo'lishi kerak" });
    }

    if (hasConflict({ stadium, date, slots })) {
      return res.status(409).json({ message: "Tanlangan vaqt allaqachon band!" });
    }

    const booking = {
      id: Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      stadium,
      date,
      startTime: `${String(start).padStart(2, "0")}:00`,
      duration: dur,
      bookedSlots: slots,
      totalPrice: dur * 200000,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    bookings.push(booking);

    // Socket — barcha clientlarga xabar
    io.emit("booking:new", { ...booking, _id: String(booking.id) });

    // Telegram xabar
    sendTelegram(booking).catch(() => {});

    console.log(`✅ Yangi bron: ${booking.name} | ${booking.stadium} | ${booking.date} ${booking.startTime}`);

    res.status(201).json({
      success: true,
      booking: { ...booking, _id: String(booking.id) },
    });
  } catch (e) {
    console.error("Bron yaratishda xato:", e);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/* ══════════════════════════════════════════════════════════════
   ADMIN AUTH
══════════════════════════════════════════════════════════════ */

// POST /api/admin/login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username va parol kiritilmadi" });
    }

    const admin = admins.find((a) => a.username === username);
    if (!admin) return res.status(401).json({ message: "Foydalanuvchi topilmadi" });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ message: "Noto'g'ri parol" });

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    console.log(`🔐 Admin kirdi: ${username}`);
    res.json({ token, username: admin.username });
  } catch (e) {
    console.error("Login xato:", e);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/* ══════════════════════════════════════════════════════════════
   ADMIN ROUTES  (JWT kerak)
══════════════════════════════════════════════════════════════ */

// GET /api/admin/bookings — barcha bronlar (to'liq ma'lumot)
app.get("/api/admin/bookings", auth, (_req, res) => {
  const result = bookings
    .map((b) => ({ ...b, _id: String(b.id) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(result);
});

// GET /api/admin/analytics — statistika
app.get("/api/admin/analytics", auth, (_req, res) => {
  res.json(calcAnalytics());
});

// PATCH /api/admin/bookings/:id/cancel — bronni bekor qilish
app.patch("/api/admin/bookings/:id/cancel", auth, (req, res) => {
  const booking = bookings.find((b) => String(b.id) === req.params.id);
  if (!booking) return res.status(404).json({ message: "Bron topilmadi" });
  if (booking.status === "cancelled") {
    return res.status(400).json({ message: "Bron allaqachon bekor qilingan" });
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date().toISOString();

  io.emit("booking:cancelled", { id: req.params.id });

  console.log(`❌ Bron bekor qilindi: ID ${req.params.id}`);
  res.json({ success: true, booking: { ...booking, _id: String(booking.id) } });
});

// DELETE /api/admin/bookings/:id — bronni o'chirish
app.delete("/api/admin/bookings/:id", auth, (req, res) => {
  const idx = bookings.findIndex((b) => String(b.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Bron topilmadi" });

  const [removed] = bookings.splice(idx, 1);
  io.emit("booking:deleted", { id: req.params.id });

  console.log(`🗑️  Bron o'chirildi: ID ${req.params.id}`);
  res.json({ success: true, id: req.params.id });
});

// GET /api/admin/stats/today — bugungi tezkor statistika
app.get("/api/admin/stats/today", auth, (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const todayActive = bookings.filter((b) => b.date === today && b.status === "active");
  res.json({
    date: today,
    count: todayActive.length,
    revenue: todayActive.reduce((s, b) => s + b.totalPrice, 0),
    bookings: todayActive.map((b) => ({ ...b, _id: String(b.id) })),
  });
});

/* ─────────────────────────────────────────────────────────────
   HEALTH CHECK
───────────────────────────────────────────────────────────── */

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    bookings: bookings.length,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Route topilmadi" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Global xato:", err);
  res.status(500).json({ message: "Server xatosi" });
});

/* ─────────────────────────────────────────────────────────────
   SERVER START
───────────────────────────────────────────────────────────── */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", async () => {
  await seedAdmin();
  console.log(`\n🚀 Server ishga tushdi → http://localhost:${PORT}`);
  console.log(`📡 Socket.IO tayyor`);
  console.log(`🗄️  Ma'lumotlar xotirada saqlanadi\n`);
});