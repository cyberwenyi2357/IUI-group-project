// server.ts
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import {AssemblyAI} from "assemblyai";
dotenv.config();

const app = express();
const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
app.get('/token', async(_req, res) => {
    // 从环境变量获取 API key
    const token = await aai.realtime.createTemporaryToken({ expires_in: 3600 });
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (!aai) {
        res.json({ error: 'API key not found' });
        return;
    }
    res.json({ token });

});
app.use(cors({
    origin: 'http://localhost:5173', // Vite 开发服务器的默认地址
    methods: ['GET', 'POST'],
    credentials: true
}));

app.listen(3001, () => {
    console.log('Server running on port 3001');
});