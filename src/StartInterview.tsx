import * as React from "react";
import {useEffect, useRef, useState} from "react";
import { RealtimeService } from 'assemblyai';
const StartInterview=()=>{
    const [transcribedText, setTranscribedText] = useState<string>('');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const rtRef = useRef<RealtimeService | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    interface Microphone {
        requestPermission: () => Promise<void>;
        startRecording: (onAudioCallback?: (buffer: Uint8Array) => void) => Promise<void>;
        stopRecording: () => void;
    }
    function mergeBuffers(lhs: Int16Array, rhs: Int16Array): Int16Array {
        const mergedBuffer = new Int16Array(lhs.length + rhs.length);
        mergedBuffer.set(lhs, 0);
        mergedBuffer.set(rhs, lhs.length);
        return mergedBuffer;
    }

    function createMicrophone(): Microphone {
        let stream: MediaStream | null = null;
        let audioContext: AudioContext | null = null;
        let audioWorkletNode: AudioWorkletNode | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        let audioBufferQueue: Int16Array = new Int16Array(0);

        return {
            async requestPermission(): Promise<void> {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            },

            async startRecording(onAudioCallback?: (buffer: Uint8Array) => void): Promise<void> {
                if (!stream) {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                }

                audioContext = new AudioContext({
                    sampleRate: 16_000,
                    latencyHint: 'balanced'
                });

                source = audioContext.createMediaStreamSource(stream);

                await audioContext.audioWorklet.addModule('audio-processor.js');
                audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

                source.connect(audioWorkletNode);
                audioWorkletNode.connect(audioContext.destination);

                audioWorkletNode.port.onmessage = (event: MessageEvent) => {
                    const currentBuffer = new Int16Array(event.data.audio_data);
                    audioBufferQueue = mergeBuffers(
                        audioBufferQueue,
                        currentBuffer
                    );
if(audioContext){
    const bufferDuration =
        (audioBufferQueue.length / audioContext.sampleRate) * 1000;

    // wait until we have 100ms of audio data
    if (bufferDuration >= 100) {
        const totalSamples = Math.floor(audioContext.sampleRate * 0.1);

        const finalBuffer = new Uint8Array(
            audioBufferQueue.subarray(0, totalSamples).buffer
        );

        audioBufferQueue = audioBufferQueue.subarray(totalSamples);
        if (onAudioCallback) onAudioCallback(finalBuffer);
    }
}

                };
            },

            stopRecording(): void {
                stream?.getTracks().forEach((track) => track.stop());
                audioContext?.close();
                audioBufferQueue = new Int16Array(0);

                // 清理引用
                stream = null;
                audioContext = null;
                audioWorkletNode = null;
                source = null;
            }
        };
    }
    const StartRecording= async() => {
        const microphone = createMicrophone();
        await microphone.requestPermission();
        try {
            // 获取临时token
            const response = await fetch('http://localhost:3001/token');
            const data = await response.json();

            if (data.error) {
                alert(data.error);
                return;
            }
            console.log(data);
            setIsRecording(true);
            // 创建 RealtimeService 实例
            const rt = new RealtimeService({ token: data.token });
            // rtRef.current = rt;
            const texts: { [key: number]: string } = {};
            // 处理转录文本
            rt.on('transcript', (message) => {
                console.log('start transcribing');
                texts[message.audio_start] = message.text;
                const keys = Object.keys(texts).map(Number);
                keys.sort((a, b) => a - b);

                let msg = '';
                for (const key of keys) {
                    if (texts[key]) {
                        msg += ` ${texts[key]}`;
                        console.log(msg);
                    }
                }
                setTranscribedText(msg);
            });

            // 处理错误
            rt.on('error', async (error) => {
                console.error('Transcription error:', error);
                await rt.close();
            });

            // 处理连接关闭
            rt.on('close', (event) => {
                console.log('Connection closed:', event);
                // rtRef.current = null;
            });

            // 连接服务
            await rt.connect();
            console.log('Connected to AssemblyAI');
            await microphone.startRecording((audioData) => {
                rt.sendAudio(audioData);
            });
            // 请求麦克风权限并开始录音
            // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // const mediaRecorder = new MediaRecorder(stream);
            // mediaRecorderRef.current = mediaRecorder;
            //
            // mediaRecorder.ondataavailable = (event) => {
            //     if (event.data.size > 0 && rtRef.current) {
            //         // 将录音数据转换为适合发送的格式
            //         event.data.arrayBuffer().then(buffer => {
            //             if (rtRef.current) {
            //                 rtRef.current.sendAudio(new Int16Array(buffer));
            //             }
            //         });
            //     }
            // };
            // mediaRecorder.start(1000);

        } catch (error) {
            console.error('Error starting transcription:', error);
        }
    };
    const stopTranscription = async () => {
        try {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
            }
            if (rtRef.current) {
                await rtRef.current.close();
            }
            setIsRecording(false);
        } catch (error) {
            console.error('Error stopping transcription:', error);
        }
    };

    // 组件卸载时清理资源
    // useEffect(() => {
    //     return () => {
    //         stopTranscription();
    //     };
    // }, []);
    return (
        <>
            <button style={{position: 'absolute', right: '3vw', top: '1vw', zIndex: 2}}
                    onClick={isRecording ? stopTranscription : StartRecording}>{isRecording ? 'Stop' : 'Start'}</button>
            {/*<h3 style={{position:'absolute',right:'10vw',top:'5vw'}}>转录文本:</h3>*/}
            <p>{transcribedText}</p></>

    )
};


export default StartInterview;

