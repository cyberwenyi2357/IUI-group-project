import { WebSocketServer } from 'ws';
import recorder  from 'node-record-lpcm16';
import { AssemblyAI } from 'assemblyai';
import express from 'express';
import cors from 'cors';
import { openai } from './src/utils/openai';


const app = express();
const PORT = 8070;

let storedEmbeddings: { text: string, embedding: number[] }[] = [];
let transcriptionForMarking: string = '';
let transcriptionForReminder: string = '';
let currentParentId: string | null = null;

app.use(cors({
    origin: 'http://localhost:5001', // 或者你的前端运行的端口
    methods: ['GET', 'POST'],
    credentials: true
}));

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
        const texts = req.body;
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
        res.json({success: true});
        const storedTexts = storedEmbeddings.map(item => item.text);
        console.log('stored texts', storedTexts);
    } catch (error) {
        console.error('Error generating embedding:', error);
        res.status(500).json({error: 'Failed to generate embedding'});
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

app.post('/update-parent', async(req, res) => {
    const { parentId } = req.body;
    currentParentId = parentId;
    const reminders = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
            role: "system",
            content: "Divide the given text into meaningful segments and extract keywords for each segment. " +
                     "Return in the following JSON format: " +
                     "{ \"segments\": [{ \"text\": \"segment content\", \"keyword\": \"key phrase\" }] }. " +
                     "Each keyword should not exceed 2 words."
        }, {
            role: "user",
            content: transcriptionForReminder
        }],
        temperature: 0.3,
        response_format: { type: "json_object" }
    });
    
    const segments = JSON.parse(reminders.choices[0].message.content ?? '{}').segments;
    
    res.json({ 
        success: true, 
        parentId: currentParentId,
        segments: segments
    });
    transcriptionForMarking = '';
});

app.get('/handle-answer-click', async (req, res) => {
    // 设置 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // 第一个 API 调用获取分段摘要
        const segmentResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: "Segment the given transcription into meaningful parts, and extract the keyword from the last segment. Return in JSON array format with just the keyword (maximum 2 words)."
            }, {
                role: "user",
                content: transcriptionForMarking
            }],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });
        // 发送第一个结果
        const segments = JSON.parse(segmentResponse.choices[0].message.content || '{}');
        console.log('segments',segments);
        res.write(`event: segments\ndata: ${JSON.stringify(segments)}\n\n`);
        // openai.chat.completions.create({
        //                 model: "gpt-4o",
        //                 messages: [{
        //                     role: "system",
        //                     content: "You are an expert in qualitative research, and you are investigating User's Sense of Agency Over Time and Content Choice on Netflix. You are given a segment of User's transcription, and you need to generate a follow-up question based on the segment."
        //                 }, {
        //                     role: "user",
        //                     content: transcriptionForMarking
        //                 }],
        //             }).then(followUpQuestion =>{
        //                 transcriptionForMarking = '';
        //                 console.log('followUpQuestion',followUpQuestion);
        //                 res.write(`event: followUpQuestion\ndata: ${JSON.stringify({ followUpQuestion: followUpQuestion.choices[0].message.content })}\n\n`);
        //                 res.end();
        //             })
        // 第二个 API 调用获取跟进问题

        const followUpResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: "You are investigating User's Sense of Agency Over Time and Content Choice on Netflix. You are given a piece of user's answer in transcriptForMarking, please suggest one follow up question. Please be brief, just give some keywords/concepts of the question, but not a complete question. "
            }, {
                role: "user",
                content: transcriptionForMarking
            }],
        });

        // 发送第二个结果
        transcriptionForMarking = '';
        const followUpQuestion = followUpResponse.choices[0].message.content;
        res.write(`event: followUp\ndata: ${JSON.stringify({ followUpQuestion })}\n\n`);
        //清空记录
        //结束连接
        res.end();
    } catch (error) {
        console.error('Error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to process request' })}\n\n`);
        res.end();
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
            transcriptionForReminder += transcript.text;
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
