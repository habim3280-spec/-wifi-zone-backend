const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: String, required: true }, // ex: "1h", "24h"
  description: { type: String, default: "Connexion haute vitesse" },
  color: { type: String, default: "blue" } // pour l'affichage UI
});

module.exports = mongoose.model('Plan', planSchema);
