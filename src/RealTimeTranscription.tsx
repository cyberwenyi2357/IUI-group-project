import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import './index.css'
const RealTimeTranscription = forwardRef((props, ref) => {

    const [transcription, setTranscription] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
     
        // 建立 WebSocket 连接
        wsRef.current = new WebSocket('ws://localhost:8080');
        wsRef.current.onopen = () => {
            console.log('WebSocket connected');
            
        };

        wsRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        wsRef.current.onmessage = (event) => {
            setTranscription((prev) => prev + event.data + '\n');
        };
        return () => {
            wsRef.current?.close();
        };

    }, []);

    const startRecording = async () => {
        try {
            // 请求麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            //创建 MediaRecorder
            mediaRecorderRef.current = new MediaRecorder(stream);
            wsRef.current?.send('start');
            // // 每收集到数据就发送给服务器
            // mediaRecorderRef.current.ondataavailable = (event) => {
            //     if (event.data.size > 0 && wsRef.current) {
            //         wsRef.current.send(event.data);

            //     }
            // };

            // 设置每 250ms 收集一次数据
            // mediaRecorderRef.current.start(2500);
            console.log('start recording');
        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            
            console.log('stop recording');
        }
    };
    useEffect(() => {
        if (isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }, [isRecording]);


    useImperativeHandle(ref, () => ({
        getTranscriptionContent: () => transcription,
    }));

    const getRecent = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        return lines.slice(-10).join('\n');
        // return lines.join('\n');
    };

    return (
        <div>

           <div>{getRecent(transcription)}</div>
                <button style={{position: 'absolute', right: '5vw', top: '1vw', zIndex: 6}} onClick={()=>{setIsRecording(!isRecording)}}>{isRecording?'Stop':'Start'}</button>

        </div>
    );
});

export default RealTimeTranscription;