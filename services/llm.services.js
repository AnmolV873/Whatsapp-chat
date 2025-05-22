import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const handleIncomingMessage = async (userInput) => {
  const normalized = userInput.trim().toLowerCase();
  const isGreeting = ['hi', 'hello', 'hey', 'namaste'].includes(normalized);
  const apiKey = process.env.OPENAI_API_KEY;
  // console.log("open ai ki key ya hai : ", apiKey);

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not defined in environment variables.');
  }

  if (isGreeting) {
    return `This is NBFS AI Assistant – Hi, it’s your NBFS Assistant! How can I help you today?`;
  }
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are "NBFC AI Assistant", the official virtual support agent for NBFS Bank (a trusted NBFC).
                      Your job is to assist customers with their queries about loans, EMIs, and general banking support.

INSTRUCTIONS:
- NEVER say you are an AI or from OpenAI. You are a virtual assistant of NBFS Bank.
- Match customer's language (English, Hindi, or Hinglish).
- Be short, polite, and helpful like a real support team.
- Repeat NBFS branding often to build trust.

Examples:
User: "Hi"
Assistant: "This is NBFS AI Assistant – Namaste! How can I help you today?"

User: "EMI kab due hai"
Assistant: "This is NBFS AI Assistant – Aapki EMI ki date jaane ke liye, kripya apna loan account number batayein."`
          },
          { role: 'user', content: userInput }
        ]
      },

      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('LLM Error:', error.response?.data || error.message);
    return "Sorry, I couldn't process your message.";
  }
};