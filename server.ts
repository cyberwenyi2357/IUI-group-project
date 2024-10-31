
import { WebSocketServer } from 'ws';
import recorder  from 'node-record-lpcm16';
import { AssemblyAI } from 'assemblyai';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
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
        }
    });

    ws.on('message', (message: string) => {
        if (message === 'start') {
            console.log('Starting recording');
            transcriber.connect().then(() => {
                const recording = recorder({
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
            
        }
    });
});

console.log('WebSocket server started on ws://localhost:8080');