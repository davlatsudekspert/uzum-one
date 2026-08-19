require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const likesRoutes = require('./routes/likes');
const orderRoutes = require('./routes/orders');
const messageRoutes = require('./routes/messages');
const reportRoutes = require('./routes/reports');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const offerRoutes = require('./routes/offers');
const profileRoutes = require('./routes/profile');
const priceAlertRoutes = require('./routes/pricealerts');
const translateRoutes = require('./routes/translate');
const aiRoutes = require('./routes/ai');
const geocodeRoutes = require('./routes/geocode');
const { startBot } = require('./phonebot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/users', profileRoutes);
app.use('/api/price-alerts', priceAlertRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/geocode', geocodeRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UzumOne server running on http://localhost:${PORT}`);
  startBot();
});
