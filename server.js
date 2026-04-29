const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { exec } = require("child_process");
const crypto = require("crypto");
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// MongoDB Connection (use 127.0.0.1 and a short serverSelectionTimeout for faster errors)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PhishGuard';
// remove deprecated options removed in mongoose v7
const connectOptions = { serverSelectionTimeoutMS: 5000, family: 4 };

async function connectWithRetry(retries = 5, delay = 2000) {
    try {
        await mongoose.connect(MONGO_URI, connectOptions);
        console.log('Connected to PhishGuard DB');
        startServer();
    } catch (err) {
        console.error('Database Connection Error:', err.message || err);
        if (retries > 0) {
            console.log(`Retrying MongoDB connection in ${delay}ms... (${retries} attempts left)`);
            setTimeout(() => connectWithRetry(retries - 1, Math.min(10000, delay * 1.5)), delay);
        } else {
            console.error('Could not connect to MongoDB after multiple attempts. Exiting.');
            process.exit(1);
        }
    }
}

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
mongoose.connection.on('error', err => console.error('MongoDB error:', err));

connectWithRetry();

// Schema for Phishing Analysis
const threatSchema = new mongoose.Schema({
    sender: String,
    subject: String,
    bodyText: String,
    timestamp: { type: Date, default: Date.now },
    analysisResult: String,
    mlConfidenceScore: Number,
    blockchainTxId: String
});

const Threat = mongoose.model('Threat', threatSchema, 'EmailScans');

// Scanner API
app.post('/api/scan-email', async (req, res) => {
    const { sender, subject, body } = req.body;
    try {
        // Use Buffer for binary/string conversion
        const safeContent = Buffer.from(body || '', 'utf8').toString('base64');
        // Execute Python ML Model (use full path to script)
        const scriptPath = path.join(__dirname, 'ml_predict.py');
        exec(`python "${scriptPath}" "${safeContent}"`, { windowsHide: true }, async (error, stdout, stderr) => {
            if (error) {
                console.error('ML execution error:', error, stderr);
                return res.status(500).json({ error: "ML Interference Error" });
            }

            let mlData;
            try { mlData = JSON.parse(stdout); } catch (e) {
                console.error('Failed to parse ML output:', e, stdout);
                return res.status(500).json({ error: 'Invalid ML output' });
            }

            // Blockchain Integrity Hash Generation
            const txHash = crypto.createHmac('sha256', process.env.BLOCKCHAIN_SECRET || 'secret').update(`${sender || 'unknown'}-${Date.now()}`).digest('hex');

            const newScan = new Threat({
                sender, subject, bodyText: body,
                analysisResult: mlData.classification,
                mlConfidenceScore: (mlData.confidence || 0) * 100,
                blockchainTxId: txHash
            });

            await newScan.save();
            res.json({ finalClassification: mlData.classification, mlConfidence: mlData.confidence, blockchainTxId: txHash });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// History API
app.get('/api/history', async (req, res) => {
    const { search, verdict } = req.query;
    let query = {};
    if (verdict && verdict !== 'All') query.analysisResult = verdict;
    if (search) {
        query.$or = [{ sender: new RegExp(search, 'i') }, { subject: new RegExp(search, 'i') }, { bodyText: new RegExp(search, 'i') }];
    }
    const results = await Threat.find(query).sort({ timestamp: -1 });
    res.json(results);
});

// Start the HTTP server on a normal app port (not MongoDB port)
function startServer() {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`PhishGuard Server running on port ${PORT}`));
}