import express from 'express';
import ngrok from '@ngrok/ngrok'
import bodyParser from 'body-parser';
import webhookRouter from './routes/webhook.routes.js';
import ragRouter from './routes/rag.routes.js';
import dotenv from "dotenv";

dotenv.config();

export const startServer = () => {
    const app = express();

    // Use the 'verify' option to capture the raw body BEFORE parsing
    app.use(bodyParser.json({
        limit: '10mb',
        verify: (req, res, buf) => {
            // Check if buf exists before converting to string
            if (buf && buf.length > 0) {
                req.rawBody = buf.toString('utf8');
            } else {
                req.rawBody = ''; // Or handle empty body case
            }
        }
    }));
    app.use(bodyParser.urlencoded({
        extended: true, // Keep this as true
        verify: (req, res, buf) => {
            // Check if buf exists before converting to string
            if (buf && buf.length > 0) {
                req.rawBody = buf.toString('utf8');
            } else {
                req.rawBody = ''; // Or handle empty body case
            }
        }
    }));

    // Log incoming requests (now with raw body populated by body-parser's verify)
    app.use((req, res, next) => {
        console.log(`\n--- Incoming Request ---`);
        // console.log("Raw body (from body-parser verify):", req.rawBody); // This will now be populated
        console.log("Parsed body:", req.body); // This should now be correctly parsed!
        console.log(`------------------------\n`);
        next();
    });

    // Welcome route
    app.get('/', (req, res) => {
        res.status(200).json({
            message: "Welcome to the Banking RAG API!",
            description: "This API uses a Retrieval-Augmented Generation pipeline to answer banking-related questions based on PDF documents.",
            endpoints: {
                "/webhook/": {
                    method: "POST",
                    body: {
                        from: "Sender's Name",
                        body: "Message Body"
                    },
                    description: "Submit a question to get an answer from the RAG pipeline."
                },
                "/api/v1/rag": {
                    method: "POST",
                    body: {
                        query: "Your question here"
                    },
                    description: "Submit a query directly to the RAG pipeline and get an answer."
                }
            }
        });
    });

    // Routes
    app.use('/webhook', webhookRouter);
    app.use('/api/v1', ragRouter);

    // Error handling
    app.use((err, req, res, next) => {
        console.error("Server error:", err.stack);
        res.status(500).json({ error: "Internal server error" });
    });

    const PORT = process.env.PORT || 3000;

    (async function () {
        console.log("Starting ngrok tunnel...");

        try {
            const tunnel_url = await ngrok.connect({
                proto: "http",
                authtoken: process.env.NGROK_AUTH_TOKEN,
                hostname: "polite-heron-unlikely.ngrok-free.app",
                addr: PORT,
            });
            console.log(`Listening on ${tunnel_url.url()}`);
        } catch (ngrokError) {
            console.error("Error starting ngrok tunnel:", ngrokError.message);
            process.exit(1);
        }
    })();

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};
