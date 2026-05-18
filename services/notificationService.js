/**
 * Notification Service for ZonePass
 * Handles sending tickets via WhatsApp, SMS, and Email.
 */

/**
 * Sends a WiFi ticket via WhatsApp.
 * In production, this would use a provider like Twilio, Meta Graph API, or a local SMS/WA gateway.
 */
const sendWhatsAppTicket = async (phoneNumber, ticketCode, planName) => {
    console.log(`[WhatsApp] Sending ticket ${ticketCode} to ${phoneNumber}...`);
    
    // Logic for production:
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({ from: 'whatsapp:+14155238886', to: `whatsapp:${phoneNumber}`, body: ... });

    // Simulation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
        success: true,
        method: 'WhatsApp',
        message: `Félicitations ! Votre code WiFi ZonePass pour le forfait ${planName} est : ${ticketCode}. Merci de votre confiance.`
    };
};

/**
 * Sends a WiFi ticket via SMS (Fallback or primary for non-smartphone users).
 */
const sendSMSTicket = async (phoneNumber, ticketCode, planName) => {
    console.log(`[SMS] Sending ticket ${ticketCode} to ${phoneNumber}...`);
    
    // Simulation delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
        success: true,
        method: 'SMS',
        message: `ZonePass: Votre code ${planName} est ${ticketCode}. Connectez-vous et profitez !`
    };
};

module.exports = {
    sendWhatsAppTicket,
    sendSMSTicket
};
