async function sendWhatsApp(to, message) {
  const twilio = require('twilio');
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: toFormatted,
    body: message
  });
}

module.exports = { sendWhatsApp };