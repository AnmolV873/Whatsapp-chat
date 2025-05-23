import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const handleIncomingMessage = async (userInput) => {
  try {
    const response = await axios.post(
      process.env.NBFC_LLM_API_URL,  
      { query: userInput },       
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.answer || "NBFS AI Assistant – Sorry, I couldn't understand your query.";
  } catch (error) {
    console.error('LLM Integration Error:', error.response?.data || error.message);
    return "NBFS AI Assistant – Sorry, something went wrong.";
  }
}