const RosApi = require('node-routeros').RouterOSAPI;
require('dotenv').config();

const createMikrotikTicket = async (code, duration, routerConfig) => {
  const conn = new RosApi({
    host: routerConfig.ipAddress,
    user: routerConfig.apiUser,
    password: routerConfig.apiPassword,
    port: routerConfig.apiPort || 8728
  });

  try {
    await conn.connect();
// ...
    console.log(`Ticket ${code} créé sur MikroTik (${routerConfig.ipAddress}) pour ${duration}`);
    await conn.close();
    return true;
  } catch (err) {
    console.error(`Erreur MikroTik (${routerConfig.ipAddress}):`, err);
    throw err; // On propage l'erreur pour la gérer dans le flux principal
  }
};

module.exports = { createMikrotikTicket };
