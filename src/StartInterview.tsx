import * as React from "react";
import {useEffect, useRef, useState} from "react";
import { RealtimeService } from 'assemblyai';
import RecordRTC, { StereoAudioRecorder } from "recordrtc";
import {blob} from "node:stream/consumers";
const ASSEMBLY_AI_ENDPOINT = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000";
const INITIAL_SOCKET_RETRY_DELAY = 50;
let socketRetryDelay = INITIAL_SOCKET_RETRY_DELAY;

const StartInterview=()=>{
    const [transcribedText, setTranscribedText] = useState<string>('');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const socketRef = useRef<WebSocket | null>(null);
    const recorderRef = useRef<RecordRTC | null>(null);
    const [socketShouldBeOpen, setSocketShouldBeOpen] = useState(false);
    const processAudioData = (blob:Blob) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64data = reader.result;
            if (socketRef.current?.readyState === WebSocket.OPEN && base64data) {
                // Check that socket is open
                    if (typeof base64data === "string") {
                        socketRef.current.send(
                            JSON.stringify({
                                audio_data: base64data.split("base64,")[1],
                            })
                        );
                    }
                }
            reader.readAsDataURL(blob);
            }
        };
    const onMessage = (message) => {
        const texts: { [key: number]: string } = {};
        console.log('start transcribing');
        texts[message.audio_start] = message.text;
        console.log('message',message.text);
        const keys = Object.keys(texts).map(Number);
        keys.sort((a, b) => a - b);
        let msg = '';
        for (const key of keys) {
            if (texts[key]) {
                msg += ` ${texts[key]}`;
                console.log('transcribed text',msg);
                setTranscribedText(msg);
            }else{
                //console.log('did not see transcribed text');
            }
        }
    }

    const setupWebSocket =(token, onMessage) =>{
        //pass in the generated token and set up websocket with it
        setSocketShouldBeOpen(true);
        const ws=new WebSocket(`${ASSEMBLY_AI_ENDPOINT}&token=${token}`);
        ws.onopen = () => {
            startAudioRecording(processAudioData);
        };
        ws.onmessage = onMessage;
        ws.onerror=(event)=>{
            console.error(event);
            if(ws){
                ws.close();
            }

        };
        ws.onclose=(event)=>{
            // console.log(event);
            // ws=null;
        }
socketRef.current=ws;
    }
    const startAudioRecording = (onDataAvailable: (blob: Blob) => void) => {
            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((stream) => {
                    recorderRef.current = new RecordRTC(stream, {
                        type: "audio",
                        mimeType: "audio/webm;codecs=pcm",
                        recorderType: StereoAudioRecorder,
                        timeSlice: 250,
                        desiredSampRate: 16000,
                        numberOfAudioChannels: 1,
                        bufferSize: 4096,
                        audioBitsPerSecond: 128000,
                        ondataavailable: onDataAvailable,
                    });

                    recorderRef.current.startRecording();
                })
                .catch((err) => console.error(err));
        }
    const stopAudioRecording =()=>{
        setSocketShouldBeOpen(false);
        socketRetryDelay = INITIAL_SOCKET_RETRY_DELAY;
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ terminate_session: true }));
            socketRef.current.close();
        }

        if (recorderRef.current) {
            recorderRef.current.pauseRecording();
        }
    };

    const onClickStartInterview= async ()=>{

        try {
            // 获取临时token
            const response = await fetch('http://localhost:3001/token');
            const data = await response.json();
            if (data.error) {
                alert(data.error);
                return;
            }
            console.log('token fetched:',data);
            if(data){
                setupWebSocket(data.token,onMessage);
            }
            setIsRecording(true);
        }catch (error) {
            console.error('Error starting transcription:', error);
        }
    }
    return (
        <>
            <button style={{position: 'absolute', right: '3vw', top: '1vw', zIndex: 2}}
                    onClick={isRecording?stopAudioRecording:onClickStartInterview}>{isRecording ? 'Stop' : 'Start'}</button>
            <h3 style={{position:'absolute',right:'10vw',top:'5vw'}}>转录文本:</h3>
            <p>{transcribedText}</p></>

    )
    };


export default StartInterview;

