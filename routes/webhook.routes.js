import express from 'express';
import { handleIncomingMessage } from '../services/llm.services.js';
import { sendWhatsAppMessage } from '../services/twilio.services.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const from = req.body.from;
  const body = req.body.body;
//   console.log("Received message from: ", from);
//   console.log("Message body :", body);

  try {
    const reply = await handleIncomingMessage(body);
    await sendWhatsAppMessage(from, reply);
    res.sendStatus(200);
  } catch (error) {
    console.error(' Error handling message:', error);
    res.sendStatus(500);
  }
});

export default router;
