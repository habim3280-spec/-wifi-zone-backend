const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Modèles
const Plan = require('./models/Plan');
const Ticket = require('./models/Ticket');
const Device = require('./models/Device');
const User = require('./models/User');
const Transaction = require('./models/Transaction');

// Services
const { createMikrotikTicket } = require('./services/mikrotikService');
const { generateMikrotikConfig, calculateCoverage } = require('./services/configService');
const { initiateLocalPayment, verifyPaymentStatus } = require('./services/paymentService');
const { sendWhatsAppTicket, sendSMSTicket, sendOwnerSaleNotification } = require('./services/notificationService');

const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_tres_prive';

// Middleware
app.use(cors());
app.use(express.json());

// Route de test racine
app.get('/', (req, res) => {
  res.send('Serveur ZonePass opérationnel !');
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role, phone } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Utilisateur déjà existant' });

    const user = new User({ username, password, role: role || 'client', phone });
    await user.save();
    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      if (username === 'admin' && password === 'admin') {
        const token = jwt.sign({ id: 'demo', role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
        return res.json({ token, user: { username: 'admin', role: 'admin' } });
      }
      return res.status(401).json({ message: 'Identifiants invalides (Mode Démo)' });
    }

    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// MongoDB Connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connecté à MongoDB');
      seedDatabase();
    })
    .catch(err => console.error('Erreur de connexion MongoDB:', err));
}

const defaultPlans = [
  { _id: '1', name: '1 Heure', price: 100, duration: '1h', color: 'blue' },
  { _id: '2', name: '3 Heures', price: 250, duration: '3h', color: 'green' },
  { _id: '3', name: '24 Heures', price: 500, duration: '24h', color: 'orange' },
  { _id: '4', name: '7 Jours', price: 2500, duration: '7d', color: 'purple' }
];

app.get('/api/plans', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const plans = await Plan.find();
      if (plans.length > 0) return res.json(plans);
    }
    res.json(defaultPlans);
  } catch (err) {
    res.json(defaultPlans);
  }
});

app.post('/api/devices', async (req, res) => {
  try {
    const device = new Device(req.body);
    await device.save();
    res.status(201).json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/config/generate-mikrotik', (req, res) => {
  const config = generateMikrotikConfig(req.body);
  res.json({ config });
});

app.post('/api/config/simulate-coverage', (req, res) => {
  const result = calculateCoverage(req.body);
  res.json(result);
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('planId')
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/stats/sales', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ticketsToday = await Ticket.find({ createdAt: { $gte: today } }).populate('planId');
    const totalRevenueToday = ticketsToday.reduce((sum, t) => sum + (t.planId ? t.planId.price : 0), 0);
    const countToday = ticketsToday.length;
    const statsByPlan = {};
    ticketsToday.forEach(t => {
      const name = t.planId ? t.planId.name : 'Inconnu';
      statsByPlan[name] = (statsByPlan[name] || 0) + 1;
    });
    res.json({ today: { revenue: totalRevenueToday, count: countToday }, planDistribution: statsByPlan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ROUTE CRUCIALE : ACHAT ET NOTIFICATIONS
app.post('/api/create-ticket', async (req, res) => {
  const { planId, phoneNumber, paymentMethod, userId } = req.body;
  try {
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan non trouvé' });

    const transaction = new Transaction({ userId, planId, amount: plan.price, phoneNumber, paymentMethod, status: 'pending' });
    await transaction.save();

    const paymentResult = await initiateLocalPayment(plan.price, phoneNumber, paymentMethod);
    if (!paymentResult.success) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ message: "Échec paiement" });
    }

    transaction.externalTransactionId = paymentResult.providerReference;
    transaction.status = 'completed';
    await transaction.save();

    const randomCode = "WIFI-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    let mikrotikSuccess = false;
    const router = await Device.findOne({ category: 'Router', status: 'Active' }).populate('ownerId');
    
    try {
      if (router && router.ipAddress) {
        mikrotikSuccess = await createMikrotikTicket(randomCode, plan.duration, router);
      }
    } catch (e) { console.warn("MikroTik off-line, mode simulation"); }

    const newTicket = new Ticket({ code: randomCode, planId: plan._id, phoneNumber, paymentMethod });
    await newTicket.save();
    transaction.ticketId = newTicket._id;
    await transaction.save();

    // NOTIFICATION CLIENT
    try {
      await sendWhatsAppTicket(phoneNumber, randomCode, plan.name);
    } catch (e) {
      await sendSMSTicket(phoneNumber, randomCode, plan.name);
    }

    // NOTIFICATION VENDEUR (Propriétaire)
    if (router && router.ownerId && router.ownerId.phone) {
      try {
        await sendOwnerSaleNotification(router.ownerId.phone, plan.price, phoneNumber, randomCode);
      } catch (e) { console.error("Erreur notification vendeur"); }
    }

    res.status(201).json({ ticket: newTicket, transactionId: transaction.externalTransactionId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function seedDatabase() {
  try {
    const countPlans = await Plan.countDocuments();
    if (countPlans === 0) {
      await Plan.insertMany([
        { name: '1 Heure', price: 100, duration: '1h', color: 'blue' },
        { name: '3 Heures', price: 250, duration: '3h', color: 'green' },
        { name: '24 Heures', price: 500, duration: '24h', color: 'orange' }
      ]);
    }
    const countUsers = await User.countDocuments();
    if (countUsers === 0) {
      const admin = new User({ username: 'admin', password: 'admin', role: 'admin', phone: '+22700000000' });
      await admin.save();
    }
  } catch (err) { console.error(err); }
}

app.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));
