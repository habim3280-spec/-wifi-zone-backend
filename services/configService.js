const generateMikrotikConfig = (params) => {
  const { ssid, hotspotIp, poolStart, poolEnd, dnsName } = params;

  return `
# Script de configuration WiFi Zone Niger
# Modèle: MikroTik Auto-Config

/interface bridge add name=bridge-hotspot
/interface bridge port add bridge=bridge-hotspot interface=ether2
/interface bridge port add bridge=bridge-hotspot interface=wlan1

/ip address add address=${hotspotIp}/24 interface=bridge-hotspot

/ip pool add name=hs-pool ranges=${poolStart}-${poolEnd}

/ip dhcp-server add address-pool=hs-pool disabled=no interface=bridge-hotspot name=dhcp-hs

/ip dhcp-server network add address=${hotspotIp.split('.').slice(0,3).join('.')}.0/24 gateway=${hotspotIp}

/ip hotspot profile add dns-name=${dnsName} hotspot-address=${hotspotIp} name=hsprof1
/ip hotspot add address-pool=hs-pool disabled=no interface=bridge-hotspot name=hs1 profile=hsprof1

/ip hotspot user add name=admin password=admin comment="Compte Admin"
  `.trim();
};

const calculateCoverage = (params) => {
  const { area, obstacles, clientCount } = params;
  
  // Rayon de couverture estimé par antenne (en mètres)
  // Basé sur des obstacles typiques au Niger (murs en parpaings, arbres)
  let coverageRadius = 100; // Rayon par défaut en champ libre
  
  if (obstacles === 'Moyen') coverageRadius = 60;
  if (obstacles === 'Dense') coverageRadius = 30;

  const areaPerAntenna = Math.PI * Math.pow(coverageRadius, 2);
  let recommendedAntennas = Math.ceil(area / areaPerAntenna);
  
  // Capacité client (assumant 40-50 clients max par antenne outdoor standard)
  const capacityPerAntenna = 45;
  const antennasByCapacity = Math.ceil(clientCount / capacityPerAntenna);
  
  // On prend le plus élevé des deux
  const finalCount = Math.max(recommendedAntennas, antennasByCapacity);

  return {
    recommendedAntennas: finalCount,
    estimatedRadius: coverageRadius,
    reasons: [
      `Couverture basée sur une surface de ${area}m²`,
      `Obstacles ${obstacles}: rayon estimé à ${coverageRadius}m`,
      `Capacité cible: ${clientCount} utilisateurs simultanés`
    ]
  };
};

module.exports = { generateMikrotikConfig, calculateCoverage };
