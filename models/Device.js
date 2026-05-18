const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  sn: { type: String, required: true, unique: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  category: { type: String, enum: ['Router', 'Antenna', 'Starlink'], required: true },
  macAddress: { type: String },
  status: { type: String, enum: ['Registered', 'Configured', 'Active'], default: 'Registered' },
  ownerId: { type: String }, // Simplifié pour l'instant
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
