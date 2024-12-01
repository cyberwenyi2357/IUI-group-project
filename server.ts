
import { WebSocketServer } from 'ws';
import recorder  from 'node-record-lpcm16';
import { AssemblyAI } from 'assemblyai';
import express from 'express';
import cors from 'cors';
import { openai } from './src/openai';
const app = express();
const PORT = 8070;
let storedEmbeddings: { text: string, embedding: number[] }[] = [];
let transcriptionForMarking: string = '';
app.use(cors());
app.use(express.json());
function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}
//get embedding for questions
app.post('/initial-embedding-for-questions', async (req, res) => {
    try {
        const texts  = req.body;
        for (const text of texts) {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });
        const embedding = response.data[0].embedding;
        // 存储 embedding
        storedEmbeddings.push({
            text,
            embedding
        });
        }
        res.json({ success: true });
        const storedTexts = storedEmbeddings.map(item => item.text);
        console.log('stored texts',storedTexts);
    } catch (error) {
        console.error('Error generating embedding:', error);
        res.status(500).json({ error: 'Failed to generate embedding' });
    }
});
//get embedding for realtime transcription
app.post('/embedding', async (req, res) => {
    try {
        const { text } = req.body;
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });
        const newEmbedding = response.data[0].embedding;
        const similarities = storedEmbeddings
        .filter(e => e.embedding !== null)
        .map((e, index) => ({    
            text: e.text,
            similarity: cosineSimilarity(newEmbedding, e.embedding!),
            index: index         
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 1);  // 只返回最相似的一个
        res.json({ 
            similarities: similarities
        });
        console.log('similarities',similarities); 
    } catch (error) {
        console.error('Error generating embedding:', error);
        res.status(500).json({ error: 'Failed to generate embedding' });
    }
});
app.get('/handle-answer-click', async (req, res) => {

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: "Segment the given transcription into meaningful parts, and summarize the last segment in a word or two. Return in the following JSON format: { \"text\": \"segment\"}. No other words."
            }, {
                role: "user",
                content: transcriptionForMarking
            }],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });
        if (response.choices[0].message.content) {
            const segments = JSON.parse(response.choices[0].message.content);
            console.log('Segments:', segments);
            // 清空 transcriptionForMarking 为下一次记录做准备
            transcriptionForMarking = '';
            res.json(segments);
        }

});

// 启动 HTTP 服务器
app.listen(PORT, () => {
    console.log(`HTTP server running on http://localhost:${PORT}`);
});
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws:WebSocket) => {
    console.log('Client connected');

    const client = new AssemblyAI({
        apiKey: 'e18e8b76cbcb4b1394db420ad738cf30',
    });

    const transcriber = client.realtime.transcriber({
        sampleRate: 16000,
    });

    transcriber.on('open', ({ sessionId }: { sessionId: string }) => {
        console.log(`Session opened with ID: ${sessionId}`);
    });

    transcriber.on('error', (error: Error) => {
        console.error('Error:', error);
    });

    transcriber.on('close', (code: number, reason: string) => {
        console.log('Session closed:', code, reason);
    });

    transcriber.on('transcript', (transcript: { text: string; message_type: string }) => {
        if (transcript.text && transcript.message_type === 'FinalTranscript') {
            ws.send(transcript.text);
            transcriptionForMarking += transcript.text;
            console.log('transcriptionForMarking',transcriptionForMarking);
        }
    });

    ws.on('message', (message: string) => {
        if (message == 'start') {
            console.log('Starting recording');
            transcriber.connect().then(() => {
                const recording = recorder.record({
                    channels: 1,
                    sampleRate: 16000,
                    audioType: 'wav',
                });

                recording.stream().on('data', (buffer: Buffer) => {
                    transcriber.sendAudio(buffer);
                });

                ws.on('close', async () => {
                    console.log('Stopping recording');
                    recording.stop();
                    await transcriber.close();
                });
            });
        }else{
            console.log('received other message',message);
        }
    });
});

console.log('WebSocket server started on ws://localhost:8080');