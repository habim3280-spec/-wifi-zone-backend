const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  sn: { type: String, required: true, unique: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  category: { type: String, enum: ['Router', 'Antenna', 'Starlink'], required: true },
  // Champs techniques pour la connexion MikroTik
  ipAddress: { type: String }, 
  apiUser: { type: String },
  apiPassword: { type: String },
  apiPort: { type: Number, default: 8728 },
  macAddress: { type: String },
  status: { type: String, enum: ['Registered', 'Configured', 'Active'], default: 'Registered' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
