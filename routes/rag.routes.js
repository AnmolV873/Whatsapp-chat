import express from 'express';
import { createRAGPipeline } from '../services/rag.services.js';

const router = express.Router();

// Initialize RAG pipeline
let ragPipeline = null;
async function initializeRAGPipeline() {
    if (ragPipeline) {
        console.log("Reusing existing RAG pipeline...");
        return ragPipeline;
    }
    console.log("Initializing RAG pipeline...");
    try {
        ragPipeline = await createRAGPipeline();
        console.log("RAG pipeline initialized successfully.");
        return ragPipeline;
    } catch (error) {
        console.error("Error initializing RAG pipeline:", error.message);
        throw error;
    }
}

// RAG test route
router.post('/rag', async (req, res) => {

    if (!req.body) {
        console.error("Request body is undefined. Check Content-Type, middleware, and request format.");
        return res.status(400).json({
            error: "Request body is missing. Ensure Content-Type is 'application/json' and body is valid JSON.",
            headers: req.headers,
            rawBody: req.rawBody
        });
    }

    const { query: queryFromReq, Body: bodyFromTwilio } = req.body;
    const query = queryFromReq || bodyFromTwilio;

    if (!query || typeof query !== 'string') {
        console.error("Invalid query:", query);
        return res.status(400).json({ error: "Invalid or missing 'query' in request body" });
    }

    try {
        const pipeline = await initializeRAGPipeline();
        const answer = await pipeline.ask(query);
        res.status(200).json({ query, answer });
    } catch (error) {
        console.error('Error handling RAG query:', error.message);
        res.status(500).json({ error: 'Failed to process query' });
    }
});

export default router;