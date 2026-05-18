const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Optionnel pour les achats invités
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'XOF' },
  phoneNumber: { type: String, required: true }, // Numéro utilisé pour le paiement (Nita, Amana, etc.)
  paymentMethod: { type: String, required: true },
  externalTransactionId: { type: String }, // ID de transaction du fournisseur de paiement
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'], 
    default: 'pending' 
  },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
