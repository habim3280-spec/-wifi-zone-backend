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
const { sendWhatsAppTicket, sendSMSTicket } = require('./services/notificationService');

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
    // Si MongoDB est déconnecté, on utilise un compte de démo
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

// Middleware pour protéger les routes
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
      seedDatabase(); // Initialiser quelques données de test
    })
    .catch(err => console.error('Erreur de connexion MongoDB:', err));
} else {
  console.warn("Attention: MONGODB_URI n'est pas défini. Le serveur tournera en mode démo.");
}

// Forfaits par défaut (Fallback si MongoDB est absent)
const defaultPlans = [
  { _id: '1', name: '1 Heure', price: 100, duration: '1h', color: 'blue' },
  { _id: '2', name: '3 Heures', price: 250, duration: '3h', color: 'green' },
  { _id: '3', name: '24 Heures', price: 500, duration: '24h', color: 'orange' },
  { _id: '4', name: '7 Jours', price: 2500, duration: '7d', color: 'purple' }
];

// Route pour récupérer les forfaits
app.get('/api/plans', async (req, res) => {
  try {
    // Si MongoDB est connecté, on cherche en base
    if (mongoose.connection.readyState === 1) {
      const plans = await Plan.find();
      if (plans.length > 0) return res.json(plans);
    }
    // Sinon on renvoie les forfaits par défaut
    res.json(defaultPlans);
  } catch (err) {
    res.json(defaultPlans); // Fallback même en cas d'erreur
  }
});

// Route pour enregistrer un équipement
app.post('/api/devices', async (req, res) => {
  try {
    const device = new Device(req.body);
    await device.save();
    res.status(201).json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Route pour récupérer les équipements
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour générer une config MikroTik
app.post('/api/config/generate-mikrotik', (req, res) => {
  const config = generateMikrotikConfig(req.body);
  res.json({ config });
});

// Route pour simuler la couverture
app.post('/api/config/simulate-coverage', (req, res) => {
  const result = calculateCoverage(req.body);
  res.json(result);
});

// Route pour récupérer toutes les transactions (Dashboard Pro)
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

// Route pour les statistiques de ventes
app.get('/api/stats/sales', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ventes du jour (avec population pour avoir le prix)
    const ticketsToday = await Ticket.find({ createdAt: { $gte: today } }).populate('planId');
    
    const totalRevenueToday = ticketsToday.reduce((sum, t) => sum + (t.planId ? t.planId.price : 0), 0);
    const countToday = ticketsToday.length;

    // Répartition par forfait (pour camembert)
    const statsByPlan = {};
    ticketsToday.forEach(t => {
      const name = t.planId ? t.planId.name : 'Inconnu';
      statsByPlan[name] = (statsByPlan[name] || 0) + 1;
    });

    // Evolution 7 derniers jours (pour graphique barres)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const weeklyTickets = await Ticket.find({ createdAt: { $gte: sevenDaysAgo } }).populate('planId');
    
    const dailyStats = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      dailyStats[date.toLocaleDateString('fr-FR', { weekday: 'short' })] = 0;
    }

    weeklyTickets.forEach(t => {
      const dayName = t.createdAt.toLocaleDateString('fr-FR', { weekday: 'short' });
      if (dailyStats[dayName] !== undefined) {
        dailyStats[dayName] += (t.planId ? t.planId.price : 0);
      }
    });

    res.json({
      today: {
        revenue: totalRevenueToday,
        count: countToday
      },
      planDistribution: statsByPlan,
      weeklyTrend: Object.entries(dailyStats).reverse().map(([day, amount]) => ({ day, amount }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour créer un ticket après paiement (Version PRO avec Intégration Paiement & Notifications)
app.post('/api/create-ticket', async (req, res) => {
  const { planId, phoneNumber, paymentMethod, userId } = req.body;
  
  try {
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan non trouvé' });

    // 1. Créer une transaction initiale 'pending'
    const transaction = new Transaction({
      userId,
      planId,
      amount: plan.price,
      phoneNumber,
      paymentMethod,
      status: 'pending'
    });
    await transaction.save();

    // 2. APPEL AU SERVICE DE PAIEMENT (Nita/Amana/Mobile Money)
    const paymentResult = await initiateLocalPayment(plan.price, phoneNumber, paymentMethod);

    if (!paymentResult.success) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(400).json({ message: "Échec de l'initialisation du paiement." });
    }

    transaction.externalTransactionId = paymentResult.providerReference;
    await transaction.save();

    // 3. VÉRIFICATION DU PAIEMENT
    const verification = await verifyPaymentStatus(paymentResult.providerReference);

    if (verification.status !== 'completed') {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(402).json({ message: "Le paiement n'a pas été confirmé." });
    }

    transaction.status = 'completed';

    // 4. GÉNÉRATION DU TICKET MIKROTIK (Mode Simulation si pas de routeur)
    const randomCode = "WIFI-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    let mikrotikSuccess = false;
    
    try {
      mikrotikSuccess = await createMikrotikTicket(randomCode, plan.duration);
    } catch (e) {
      console.warn("Routeur non joignable, passage en mode simulation.");
    }

    // On autorise la création même si MikroTik échoue (pour le test/démo)
    const bypassMikrotik = true; 

    if (!mikrotikSuccess && !bypassMikrotik) {
      transaction.status = 'failed';
      await transaction.save();
      return res.status(500).json({ message: "Erreur lors de la création du ticket sur le routeur." });
    }

    // 5. ENREGISTREMENT DU TICKET
    const newTicket = new Ticket({
      code: randomCode,
      planId: plan._id,
      phoneNumber,
      paymentMethod
    });
    await newTicket.save();

    // 6. LIER LE TICKET À LA TRANSACTION
    transaction.ticketId = newTicket._id;
    await transaction.save();

    // 7. ENVOI AUTOMATIQUE DU TICKET (WhatsApp ou SMS)
    try {
      await sendWhatsAppTicket(phoneNumber, randomCode, plan.name);
    } catch (notifyErr) {
      await sendSMSTicket(phoneNumber, randomCode, plan.name);
    }

    res.status(201).json({ 
      ticket: newTicket, 
      transactionId: transaction.externalTransactionId,
      message: "Paiement réussi et ticket envoyé par WhatsApp/SMS."
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Initialisation de la base de données avec des forfaits par défaut
async function seedDatabase() {
  try {
    const count = await Plan.countDocuments();
    if (count === 0) {
      const defaultPlans = [
        { name: '1 Heure', price: 100, duration: '1h', color: 'blue' },
        { name: '3 Heures', price: 250, duration: '3h', color: 'green' },
        { name: '24 Heures', price: 500, duration: '24h', color: 'orange' },
        { name: '7 Jours', price: 2500, duration: '7d', color: 'purple' }
      ];
      await Plan.insertMany(defaultPlans);
      console.log('Forfaits par défaut ajoutés.');
    }

    // Création d'un compte Admin par défaut si la base est vide
    const countUsers = await User.countDocuments();
    if (countUsers === 0) {
      const admin = new User({
        username: 'admin',
        password: 'admin',
        role: 'admin'
      });
      await admin.save();
      console.log('Compte Admin par défaut créé (admin/admin).');
    }
  } catch (err) {
    console.error('Erreur seedDatabase:', err);
  }
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
