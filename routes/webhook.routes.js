import express from 'express';
import { handleIncomingMessage } from '../services/llm.services.js';
import { sendWhatsAppMessage } from '../services/twilio.services.js';

const router = express.Router();

router.post('/', async (req, res) => {

  // Safely access 'from' and 'body' properties
  // Check if req.body exists and if 'from' and 'body' properties are present
  const from = req.body?.From;
  const body = req.body?.Body;

  // If 'from' or 'body' are missing, log a warning and send an error response
  if (!from || !body) {
    console.warn("Webhook Route: Missing 'from' or 'body' in the incoming request.");
    // You might want to log req.body here to see what was actually received
    console.warn("Received req.body:", req.body);
    return res.status(400).json({ error: 'Missing required parameters: from or body.' });
  }

  console.log("Received message from: ", from);
  console.log("Message body :", body);

  try {
    const reply = await handleIncomingMessage(body);
    // Ensure sendWhatsAppMessage is robust enough to handle potential errors
    await sendWhatsAppMessage(from, reply);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling message in webhook:', error);
    res.sendStatus(500);
  }
});

export default router;
