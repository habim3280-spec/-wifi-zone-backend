const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  code: { type: String, required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  phoneNumber: { type: String, required: true },
  paymentMethod: { type: String, enum: ['Nita', 'Amana'], required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  status: { type: String, enum: ['active', 'expired'], default: 'active' }
});

module.exports = mongoose.model('Ticket', ticketSchema);
