import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendWhatsAppMessage = async (to, message) => {
  try {
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    console.log(" Sending WhatsApp message");
    console.log(" From:", from);
    console.log(" To:", to);
    console.log(" Body:", message);

    const response = await client.messages.create({
      from,
      to,
      body: message,
    });

    console.log("Message sent:", response.sid);

  } catch (error) {
    console.error(' Twilio Error:', error.message);
    console.error(' Full error:', error);
  }
};
