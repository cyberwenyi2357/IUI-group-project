// server.ts
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.get('/token', (req, res) => {
    // 从环境变量获取 API key
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
        res.json({ error: 'API key not found' });
        return;
    }

    res.json({ token: apiKey });
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});