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

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

app.use(cors({ origin: "*" }));
app.use(express.json());

/* ─────────────────────────────
   MEMORY DATABASE (NO MONGODB)
───────────────────────────── */

let bookings = [];
let admins = [];

/* ─────────────────────────────
   TELEGRAM BOT
───────────────────────────── */

let bot = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: false,
  });

  console.log("✅ Telegram bot initialized");
}

const sendTelegram = async (booking) => {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;

  const msg = `
⚽ NEW BOOKING

👤 ${booking.name}
📞 ${booking.phone}
🏟 ${booking.stadium}
📅 ${booking.date}
🕐 ${booking.startTime}
⏳ ${booking.duration}h
💰 ${booking.totalPrice} UZS
  `;

  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, msg);
  } catch (e) {
    console.log("Telegram error:", e.message);
  }
};

/* ─────────────────────────────
   ADMIN SEED
───────────────────────────── */

const seedAdmin = async () => {
  const exists = admins.find(
    (a) => a.username === (process.env.ADMIN_USERNAME || "admin")
  );

  if (!exists) {
    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || "admin123",
      10
    );

    admins.push({
      id: Date.now(),
      username: process.env.ADMIN_USERNAME || "admin",
      password: hashedPassword,
    });

    console.log("✅ Admin created (memory)");
  }
};

/* ─────────────────────────────
   AUTH MIDDLEWARE
───────────────────────────── */

const auth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const decoded = jwt.verify(
      token.split(" ")[1],
      process.env.JWT_SECRET || "secret"
    );

    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* ─────────────────────────────
   PUBLIC API
───────────────────────────── */

app.get("/api/bookings", (req, res) => {
  res.json(bookings);
});

app.post("/api/bookings", (req, res) => {
  try {
    const { name, phone, stadium, date, startTime, duration } = req.body;

    const start = parseInt(startTime.split(":")[0]);
    const dur = Number(duration);

    if (start < 6 || start + dur > 24) {
      return res.status(400).json({
        message: "Booking allowed only 06:00 - 00:00",
      });
    }

    const slots = Array.from({ length: dur }, (_, i) => start + i);

    const conflict = bookings.find(
      (b) =>
        b.stadium === stadium &&
        b.date === date &&
        b.status === "active" &&
        b.bookedSlots.some((s) => slots.includes(s))
    );

    if (conflict) {
      return res.status(409).json({
        message: "Time already booked",
      });
    }

    const booking = {
      id: Date.now(),
      name,
      phone,
      stadium,
      date,
      startTime,
      duration: dur,
      bookedSlots: slots,
      totalPrice: dur * 200000,
      status: "active",
      createdAt: new Date(),
    };

    bookings.push(booking);

    io.emit("booking:new", booking);

    sendTelegram(booking);

    res.json({ success: true, booking });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ─────────────────────────────
   ADMIN LOGIN
───────────────────────────── */

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  const admin = admins.find((a) => a.username === username);

  if (!admin) {
    return res.status(401).json({ message: "Wrong login" });
  }

  const ok = await bcrypt.compare(password, admin.password);

  if (!ok) {
    return res.status(401).json({ message: "Wrong password" });
  }

  const token = jwt.sign(
    { username },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/* ─────────────────────────────
   ADMIN API
───────────────────────────── */

app.get("/api/admin/bookings", auth, (req, res) => {
  res.json(bookings);
});

app.delete("/api/admin/bookings/:id", auth, (req, res) => {
  bookings = bookings.filter((b) => b.id != req.params.id);

  io.emit("booking:deleted", req.params.id);

  res.json({ success: true });
});

/* ─────────────────────────────
   SOCKET.IO
───────────────────────────── */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

/* ─────────────────────────────
   START SERVER
───────────────────────────── */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", async () => {
  await seedAdmin();
  console.log("🚀 Server running on port", PORT);
});