import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import dotenv from "dotenv";

dotenv.config();

// Singleton for model initialization
let modelCache = null;
async function initializeModels(modelName) {
    if (modelCache) {
        console.log("Reusing cached embeddings and chat model...");
        return modelCache;
    }

    console.log("Initializing embeddings and chat model...");
    try {
        const embeddings = new OllamaEmbeddings({
            model: "nomic-embed-text",
            requestOptions: { timeout: 30000 }
        });
        const testEmbedding = await embeddings.embedQuery("test");
        console.log("Test embedding length:", testEmbedding.length);
        if (testEmbedding.length !== 768) {
            throw new Error("Unexpected embedding dimension for nomic-embed-text.");
        }
        const chatModel = new ChatOllama({
            model: modelName,
            temperature: 0.7,
            topP: 0.9,
            maxRetries: 2,
            disableStreaming: true,
            numPredict: 200

        });
        console.log("Embeddings and chat model initialized.");
        modelCache = { embeddings, chatModel };
        return modelCache;
    } catch (err) {
        console.error("Error initializing models:", err.message);
        throw err;
    }
}

// Manage Pinecone index
async function managePineconeIndex(collectionName) {
    console.log("Connecting to Pinecone...");
    console.log(`Pinecone API Key: ${process.env.PINECONE_API_KEY ? "Loaded" : "Missing"}`);
    if (!process.env.PINECONE_API_KEY) {
        throw new Error("PINECONE_API_KEY is missing in environment variables.");
    }

    try {
        const { Pinecone } = await import("@pinecone-database/pinecone");
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

        const existingIndexes = await pinecone.listIndexes();
        const indexExists = existingIndexes.indexes?.some(index => index.name === collectionName) || false;
        console.log(`Index "${collectionName}" exists: ${indexExists}`);

        if (!indexExists) {
            console.log(`Creating index "${collectionName}"...`);
            await pinecone.createIndex({
                name: collectionName,
                dimension: 768,
                metric: "cosine",
                spec: { serverless: { cloud: "aws", region: "us-east-1" } }
            });
            console.log(`Index "${collectionName}" created successfully.`);

            while (true) {
                console.log(`Checking status for index "${collectionName}"...`);
                const desc = await pinecone.describeIndex(collectionName);
                if (desc.status?.ready) {
                    console.log(`Index "${collectionName}" is ready.`);
                    break;
                }
                console.log("Index not ready yet. Waiting...");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const index = pinecone.Index(collectionName);
        return { index, isNew: !indexExists };
    } catch (err) {
        console.error("Error managing Pinecone index:", err.message);
        throw err;
    }
}

// Load PDF documents
async function loadDocuments(documentPaths) {
    console.log("Loading PDF documents...");
    const allDocs = [];
    const loadPromises = documentPaths.map(async (docPath) => {
        try {
            console.log(`Loading document: ${docPath}`);
            const loader = new PDFLoader(docPath);
            const docs = await loader.load();
            console.log(`Loaded ${docs.length} documents from ${docPath}`);
            if (docs.length > 0 && !docs[0].pageContent.trim()) {
                console.warn(`Document ${docPath} appears to have no extractable text.`);
            }
            return docs;
        } catch (err) {
            console.error(`Error loading PDF file ${docPath}:`, err.message);
            return [];
        }
    });
    const results = await Promise.all(loadPromises);
    results.forEach(docs => allDocs.push(...docs));

    if (allDocs.length === 0) {
        console.error("No documents loaded from PDFs.");
        throw new Error("No documents loaded from provided paths.");
    }
    console.log(`Total documents loaded: ${allDocs.length}`);
    return allDocs;
}

// Split documents into chunks
async function splitDocuments(documents) {
    console.log("Splitting documents into chunks...");
    try {
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 800,
            chunkOverlap: 150
        });
        const chunks = await textSplitter.splitDocuments(documents);
        if (chunks.length === 0) {
            console.error("No chunks created from documents.");
            throw new Error("No chunks created from documents.");
        }
        console.log(`Total chunks created: ${chunks.length}`);
        return chunks;
    } catch (err) {
        console.error("Error during text splitting:", err.message);
        throw err;
    }
}

// Ingest documents into Pinecone
async function ingestDocuments(index, embeddings, documentPaths) {
    console.log("Checking if documents need to be ingested...");
    try {
        const stats = await index.describeIndexStats();
        const vectorCount = stats.totalRecordCount || stats.totalVectorCount || stats.namespaces?.[""]?.recordCount || 0;

        if (vectorCount > 0) {
            console.log(`Index already contains ${vectorCount} vectors. Loading existing vector store...`);
            return await PineconeStore.fromExistingIndex(embeddings, { pineconeIndex: index });
        }

        if (!documentPaths || documentPaths.length === 0) {
            console.error("No document paths provided for ingestion.");
            throw new Error("Document paths required for initial ingestion.");
        }

        console.log("Index is empty or new. Ingesting documents...");
        const documents = await loadDocuments(documentPaths);
        const chunks = await splitDocuments(documents);
        const vectorStore = await PineconeStore.fromDocuments(chunks, embeddings, { pineconeIndex: index });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const newStats = await index.describeIndexStats();
        const newVectorCount = newStats.totalRecordCount || newStats.totalVectorCount || newStats.namespaces?.[""]?.recordCount || 0;
        if (newVectorCount === 0) {
            console.error("No vectors uploaded to Pinecone index during ingestion.");
            throw new Error("Failed to ingest documents into Pinecone index.");
        }
        console.log(`Successfully ingested ${newVectorCount} vectors into index.`);
        return vectorStore;
    } catch (err) {
        console.error("Error ingesting documents:", err.message);
        throw err;
    }
}

// Set up retriever
function setupRetriever(vectorStore) {
    console.log("Setting up retriever...");
    try {
        const retriever = vectorStore.asRetriever({
            searchType: "similarity",
            searchKwargs: { k: 3 }
        });
        console.log("Retriever set up successfully.");
        return retriever;
    } catch (err) {
        console.error("Error setting up retriever:", err.message);
        throw err;
    }
}

// Create document combiner chain
async function createCombineDocsChain(chatModel) {
    console.log("Creating document combiner chain...");
    try {
        const promptTemplate = PromptTemplate.fromTemplate(`
You are a highly knowledgeable expert in banking. Answer the user's question based on the provided document context.

Guidelines:
- Keep your answer **crisp, concise, and professional** (maximum **3-4 lines**).
- Do **not** reference the document or say phrases like "According to the document" or "The document states".
- If the answer is not clearly found in the context, use your understanding of the **document's general topic** to respond helpfully.
- If the question is unrelated to the topic, respond with:  
  **"I'm sorry, I don't know. The answer is not in the provided documents."**

Context:
{context}

User: {question}  
Assistant:
        `);
        const combineDocsChain = await createStuffDocumentsChain({
            llm: chatModel,
            prompt: promptTemplate
        });
        console.log("Document combiner chain created successfully.");
        return combineDocsChain;
    } catch (err) {
        console.error("Error creating document combiner chain:", err.message);
        throw err;
    }
}

// Ask a question
async function askQuestion(retriever, combineDocsChain, userInput) {
    console.log(`Processing question: "${userInput}"`);
    try {
        const retrievedDocs = await retriever.invoke(userInput);
        if (retrievedDocs.length === 0) {
            console.warn("No documents retrieved for query.");
            return "I'm sorry, I don't know. The answer is not in the provided documents.";
        }
        const result = await combineDocsChain.invoke({
            input_documents: retrievedDocs,
            question: userInput
        });
        console.log("Answer generated successfully.");
        return result.trim();
    } catch (err) {
        console.error("Error generating answer:", err.message);
        return "An error occurred while processing your question.";
    }
}

// Main pipeline function
async function createRAGPipeline(documentPaths = null, collectionName = "bank-rag", modelName = "llama3.2:1b") {
    console.log("Initializing RAGPipeline...");
    console.log(`Document paths: ${documentPaths ? JSON.stringify(documentPaths) : 'Using existing index'}`);
    console.log(`Model name: ${modelName}`);

    // Validate collection name
    if (!/^[a-z0-9-]{1,45}$/.test(collectionName)) {
        console.error(`Invalid collectionName: ${collectionName}. Must be lowercase, numbers, hyphens only, and <= 45 characters.`);
        throw new Error("Invalid Pinecone index name.");
    }

    try {
        const { embeddings, chatModel } = await initializeModels(modelName);
        const { index } = await managePineconeIndex(collectionName);
        const vectorStore = await ingestDocuments(index, embeddings, documentPaths);
        const retriever = setupRetriever(vectorStore);
        const combineDocsChain = await createCombineDocsChain(chatModel);
        return {
            ask: async (userInput) => askQuestion(retriever, combineDocsChain, userInput),
            ingest: async (paths) => ingestDocuments(index, embeddings, paths)
        };
    } catch (err) {
        console.error("RAGPipeline creation failed:", err.message);
        throw err;
    }
}

export { createRAGPipeline };