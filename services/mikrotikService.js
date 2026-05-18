const RosApi = require('node-routeros').RouterOSAPI;
require('dotenv').config();

const createMikrotikTicket = async (code, duration) => {
  const conn = new RosApi({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
  });

  try {
    await conn.connect();
    console.log('Connecté au MikroTik');

    // Commande pour ajouter un utilisateur hotspot
    // On assume que le profil correspond à la durée (ex: "1h", "24h")
    // ou qu'on utilise un profil par défaut "default"
    await conn.write('/ip/hotspot/user/add', [
      '=name=' + code,
      '=password=' + code, // Le mot de passe est le même que le login pour simplifier
      '=limit-uptime=' + duration,
      '=comment=Achat via App WiFi Zone Niger'
    ]);

    console.log(`Ticket ${code} créé sur MikroTik pour ${duration}`);
    await conn.close();
    return true;
  } catch (err) {
    console.error('Erreur MikroTik:', err);
    return false;
  }
};

module.exports = { createMikrotikTicket };
