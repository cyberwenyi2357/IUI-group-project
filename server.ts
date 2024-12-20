import { WebSocketServer } from 'ws';
import recorder  from 'node-record-lpcm16';
import { AssemblyAI } from 'assemblyai';
import express from 'express';
import cors from 'cors';
import https from "https";
// import http from "http";

import { openai } from './src/utils/openai';


const app = express();
const PORT = 8070;

let storedEmbeddings: { text: string, embedding: number[] }[] = [];
let transcriptionForMarking: string = '';
let transcriptionForReminder: string = '';
let transcriptionBuffer: string = '';
let currentParentId: string = 'Group-0';
let transcriptionStore: TranscriptionData[] = [];
interface TranscriptionData {
    parentId: string;
    transcription: string;
    marked: string[];
}
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

app.post('/update-parent', async(req, res) => {
    const { parentId } = req.body;
    currentParentId = parentId;
    console.log('current parent:',currentParentId);
    const existingIndex = transcriptionStore.findIndex(item => item.parentId === parentId);
    if (existingIndex !== -1) {
        // 如果已存在该 parentId，更新 transcription
        transcriptionStore[existingIndex].transcription += transcriptionForReminder;

    } else {
        // 如果是新的 parentId，创建新记录
        transcriptionStore.push({
            parentId,
            transcription: transcriptionForReminder,
            marked: []
        });
    }
});
app.post('/generate-reminder-talking-points', async (req, res) => {
    try{
        const { parentId } = req.body;
        const transcriptionData = transcriptionStore.find(item => item.parentId === parentId);
        console.log('see transcription',transcriptionStore);
        if(!transcriptionData){
            res.status(404).json({ error: 'Transcription not found' });
            return;
        }
        const { transcription, marked } = transcriptionData;
        const reminders = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: "Divide the given text into meaningful segments and extract keywords for each segment. " +
                         "Return in the following JSON format: " +
                         "{ \"segments\": [{ \"text\": \"segment content\", \"keyword\": \"key phrase\" }] }. " +
                         "Each keyword should not exceed 2 words. " +
                         "Please exclude any segments that are related to these already marked keywords: " + 
                         marked.join(", ")
            }, {
                role: "user",
                content: transcription
            }],
            temperature: 0.8,
            response_format: { type: "json_object" }
        });
        const segments = JSON.parse(reminders.choices[0].message.content ?? '{}').segments;
        
        res.json(segments);
    }catch(error){
        console.error('Error generating reminder talking points:', error);
        res.status(500).json({ error: 'Failed to generate reminder talking points' });
    }
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
        console.log('get segments',segments);
        // console.log('see clicked parent id',);
        const existingIndex = transcriptionStore.findIndex(item => item.parentId === currentParentId);
        if (existingIndex === -1 ) {
            // 如果记录不存在，创建一个新记录
            transcriptionStore.push({
                parentId: currentParentId,
                transcription: transcriptionForReminder,
                marked: []
            });
        }
        if (existingIndex !== -1 ) {
            const keyword = Array.isArray(segments.keyword) ? segments.keyword[0] : segments.keyword;
            transcriptionStore[existingIndex].marked.push(keyword);
            console.log('pushed into marked', transcriptionStore[existingIndex].marked);
        }
        
        console.log('segments',JSON.stringify(segments));
        res.write(`event: segments\ndata: ${JSON.stringify(segments)}\n\n`);
        // 第二个 API 调用获取跟进问题

        const followUpResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: "You are investigating how adapted practices have changed the meanings and use of different spaces in the context of the pandemic. Please be brief, just give some keywords/concepts of the question, but not a complete question. "
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


// For reporting any event for logging
app.post("/send-event", async (req, res) => {
    // NOTE: the host entry could be changed depending on needs.
    const logServerHost = "interviewtool-hjeyhxb7a3cndnb4.australiaeast-01.azurewebsites.net";
    const options: https.RequestOptions = {
        hostname: logServerHost,
        port: 443,
        path: '/api/record',
        method: 'POST',
    };

    const req2LogServer = https.request(options, (resFromLogServer) => {
        let responseData = '';

        resFromLogServer.on('data', (chunk) => {
            responseData += chunk;
        });

        resFromLogServer.on('end', () => {
            if (resFromLogServer.statusCode && resFromLogServer.statusCode >= 200 && resFromLogServer.statusCode < 300) {
                res.status(200).json(responseData);
            } else {
                res.status(500).json({ error: `Request failed with status code ${resFromLogServer.statusCode}: ${responseData}`});
            }
        });
    });

    req2LogServer.on('error', (error) => {
        res.status(500).json({ error: 'Failed to record event', error_body: error});
    });

    const event4Log = req.body;
    // console.log("Event4Log", event4Log);
    req2LogServer.write(JSON.stringify(event4Log));
    req2LogServer.end();
})


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

    transcriber.on('transcript', async(transcript: { text: string; message_type: string }) => {
        // console.log('Processing FinalTranscript:', transcript.text);
        if (transcript.text && transcript.message_type === 'FinalTranscript') {
            transcriptionBuffer += transcript.text;
            transcriptionForMarking += transcript.text;
            transcriptionForReminder += transcript.text;
            const words = transcriptionBuffer.trim().split(/\s+/);
            if (words.length >= 25) {
                try {
                    // 生成 embedding 并计算相似度
                    const response = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: transcriptionBuffer,
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
                        .slice(0, 1);
                        console.log('similarities',similarities);
                        const simplifiedData = similarities.map(item => ({
                            index: item.index,
                            text: item.text
                        }));
                        if (similarities.length > 0 
                            // && similarities[0].similarity > 0.5
                        ) {
                            // 发送相似度数据
                            ws.send(JSON.stringify({
                                type: 'similarity',
                                data: similarities
                            }));
    
                            // 从 storedEmbeddings 中移除最相似的节点
                            const mostSimilarText = similarities[0].text;
                            console.log('mostSimilarText',mostSimilarText);
                            // storedEmbeddings = storedEmbeddings.filter(embedding => embedding.text !== mostSimilarText);
                            // console.log(`Removed embedding with text "${mostSimilarText}". Remaining embeddings: ${storedEmbeddings.length}`);
                        }
                    
                    console.log('see transcription',transcriptionBuffer);
                    // 清空缓冲区
                    transcriptionBuffer = '';
                } catch (error) {
                    console.error('Error generating embedding:', error);
                }
            }
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
