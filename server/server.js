require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── MONGOOSE SCHEMAS ─────────────────────────────────────────────────────────
const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

const BookingSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, required: true, trim: true },
  stadium:    { type: String, enum: ['open', 'indoor'], required: true },
  date:       { type: String, required: true }, // YYYY-MM-DD
  startTime:  { type: String, required: true }, // HH:00
  duration:   { type: Number, required: true, min: 1, max: 18 },
  totalPrice: { type: Number, required: true },
  bookedSlots:{ type: [Number], required: true }, // array of hour numbers
  status:     { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
}, { timestamps: true });

const Admin = mongoose.model('Admin', AdminSchema);
const Booking = mongoose.model('Booking', BookingSchema);

// ─── TELEGRAM BOT ─────────────────────────────────────────────────────────────
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
  try {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ Telegram bot initialized');
  } catch (e) {
    console.warn('⚠️ Telegram bot init failed:', e.message);
  }
}

const sendTelegramNotification = async (booking) => {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  const stadiumName = booking.stadium === 'open' ? '🏟️ Open Stadium' : '🏛️ Indoor Stadium';
  const endHour = parseInt(booking.startTime) + booking.duration;
  const endTime = `${String(endHour % 24).padStart(2, '0')}:00`;
  const priceFormatted = new Intl.NumberFormat('uz-UZ').format(booking.totalPrice) + ' UZS';
  const message = `
⚽ <b>NEW STADIUM BOOKING</b>

👤 <b>Name:</b> ${booking.name}
📞 <b>Phone:</b> ${booking.phone}
🏟 <b>Stadium:</b> ${stadiumName}
📅 <b>Date:</b> ${booking.date}
🕐 <b>Time:</b> ${booking.startTime} → ${endTime}
⏱ <b>Duration:</b> ${booking.duration} hour${booking.duration > 1 ? 's' : ''}
💰 <b>Total Price:</b> ${priceFormatted}
🆔 <b>Booking ID:</b> #${String(booking._id).slice(-8).toUpperCase()}
  `.trim();
  try {
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });
  } catch (e) {
    console.warn('Telegram send error:', e.message);
  }
};

// ─── JWT MIDDLEWARE ───────────────────────────────────────────────────────────
const authenticateAdmin = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'fallback_secret_key');
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ─── ADMIN AUTH ROUTES ────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '7d' });
    res.json({ token, username: admin.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUBLIC BOOKING ROUTES ────────────────────────────────────────────────────
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({ status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).select('-__v').lean();
    res.json(bookings);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { name, phone, stadium, date, startTime, duration } = req.body;

    // Validation
    if (!name || !phone || !stadium || !date || !startTime || !duration)
      return res.status(400).json({ message: 'All fields are required' });
    if (!['open', 'indoor'].includes(stadium))
      return res.status(400).json({ message: 'Invalid stadium type' });
    if (phone.replace(/\D/g, '').length < 9)
      return res.status(400).json({ message: 'Invalid phone number' });

    const startHour = parseInt(startTime.split(':')[0]);
    const dur = parseInt(duration);

    if (isNaN(startHour) || isNaN(dur) || dur < 1 || dur > 18)
      return res.status(400).json({ message: 'Invalid time or duration' });
    if (startHour < 6 || startHour + dur > 24)
      return res.status(400).json({ message: 'Booking must be within 06:00 – 00:00' });

    const bookedSlots = Array.from({ length: dur }, (_, i) => startHour + i);
    const totalPrice = dur * 200000;

    // Anti-overlap: atomic check + insert with a DB-level query
    const conflicting = await Booking.findOne({
      stadium,
      date,
      status: { $ne: 'cancelled' },
      bookedSlots: { $in: bookedSlots },
    });
    if (conflicting) return res.status(409).json({ message: 'Time slot already booked. Please choose another time.' });

    const booking = await Booking.create({ name: name.trim(), phone: phone.trim(), stadium, date, startTime, duration: dur, totalPrice, bookedSlots });

    // Emit realtime event
    io.emit('booking:new', booking);

    // Send Telegram notification (non-blocking)
    sendTelegramNotification(booking).catch(() => {});

    res.status(201).json({ booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Booking failed. Please try again.' });
  }
});

// ─── ADMIN BOOKING ROUTES ─────────────────────────────────────────────────────
app.get('/api/admin/bookings', authenticateAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
    res.json(bookings);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/bookings/:id/cancel', authenticateAdmin, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    io.emit('booking:cancelled', { id: booking._id });
    res.json({ booking });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/admin/bookings/:id', authenticateAdmin, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    io.emit('booking:deleted', { id: req.params.id });
    res.json({ message: 'Deleted successfully' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── ANALYTICS ROUTE ──────────────────────────────────────────────────────────
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    const all = await Booking.find({ status: { $ne: 'cancelled' } }).lean();
    const active = all.filter(b => b.status === 'active').length;
    const total = all.length;
    const totalRevenue = all.reduce((s, b) => s + b.totalPrice, 0);
    const dailyRevenue = all.filter(b => b.date === todayStr).reduce((s, b) => s + b.totalPrice, 0);
    const monthlyRevenue = all.filter(b => b.date >= monthStart).reduce((s, b) => s + b.totalPrice, 0);
    const yearlyRevenue = all.filter(b => b.date >= yearStart).reduce((s, b) => s + b.totalPrice, 0);

    // Last 7 days chart
    const revenueChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayBookings = all.filter(b => b.date === dateStr);
      revenueChart.push({
        date: dateStr.slice(5), // MM-DD
        revenue: dayBookings.reduce((s, b) => s + b.totalPrice, 0),
        count: dayBookings.length,
      });
    }

    // Stadium split
    const openCount = all.filter(b => b.stadium === 'open').length;
    const indoorCount = all.filter(b => b.stadium === 'indoor').length;
    const stadiumSplit = [
      { stadium: 'Open Stadium', count: openCount },
      { stadium: 'Indoor Stadium', count: indoorCount },
    ];

    res.json({ total, active, totalRevenue, dailyRevenue, monthlyRevenue, yearlyRevenue, revenueChart, stadiumSplit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});

// ─── DB + SERVER START ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stadium-booking';

const seedAdmin = async () => {
  const exists = await Admin.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
  if (!exists) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
    await Admin.create({ username: process.env.ADMIN_USERNAME || 'admin', password: hashed });
    console.log(`✅ Admin seeded: username="${process.env.ADMIN_USERNAME || 'admin'}"`);
  }
};

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedAdmin();
    server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });