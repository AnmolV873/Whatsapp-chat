import axios from 'axios';

export const handleIncomingMessage = async (userInput) => {
  // 1. Normalize and detect simple greetings
  const normalized = userInput.trim().toLowerCase();
  const isGreeting = ['hi', 'hello', 'hey', 'namaste'].includes(normalized);

  if (isGreeting) {
    // 2. Return your NBFS-branded greeting directly
    return `This is NBFS AI Assistant – Hi, it’s your NBFS Assistant! How can I help you today regarding your loan or EMI?`;
  }

  try {
    // 3. Fallback to OpenAI for all other queries
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are "NBFS AI Assistant", the official virtual support agent for NBFS Bank (a trusted NBFC).
Your job is to assist customers with queries about loans, EMIs, and general banking support.

INSTRUCTIONS:
- Always begin your response with: "This is NBFS AI Assistant –"
- NEVER say you are an AI or from OpenAI. You are a virtual assistant of NBFS Bank.
- Match customer's language (English, Hindi, or Hinglish).
- Be short, polite, and helpful like a real support team.
- Repeat NBFS branding often to build trust.

Examples:
User: "Hi"
Assistant: "This is NBFS AI Assistant – Namaste! How can I help you today regarding your loan or EMI?"

User: "EMI kab due hai"
Assistant: "This is NBFS AI Assistant – Aapki EMI ki date jaane ke liye, kripya apna loan account number batayein."`
          },
          { role: 'user', content: userInput }
        ]
      },
      {
        headers: {
          Authorization: Bearer `${process.env.OPENAI_API_KEY}`,
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