import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import './index.css'
import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    useNodesState,
    MiniMap,
    type Edge,
    type Node,  // <- 这里导入了 Node 类型
    type NodeProps
} from '@xyflow/react';
import { openai } from './openai';
interface Props {
    onNodeCreate: (newNode: Node) => void;
}
const RealTimeTranscription = forwardRef((props:Props, ref) => {
    const { onNodeCreate } = props;
    const [transcription, setTranscription] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const containerRef = useRef(null);
    const wsRef=useRef<WebSocket|null>(null);
    const [keywords,setKeywords]=useState<string>('no keywords now');
    const lastProcessedRef = useRef<number>(0);
    const [recent,setRecent]=useState<string>('');
    const [recentCount, setRecentCount] = useState<number>(0);

    useEffect(() => {
        // 建立 WebSocket 连接
        wsRef.current= new WebSocket('ws://localhost:8080');
        wsRef.current.onopen = () => {
            console.log('WebSocket connected');
 
        };
        wsRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        wsRef.current.onmessage = (event) => {
            setTranscription((prev) => prev + event.data + '\n');
            console.log('instant data',`${event.data}`);
            //TODO: investigate why count keeps on being 0
            console.log('transcription',transcription);

                extractKeywords(`${event.data}`);
                // lastProcessedRef.current=recent.count;
        };
        return () => {
        
            if(wsRef.current && wsRef.current.readyState===1){
                wsRef.current.close();
            }
            
        };
    }, []);  
    useEffect(()=>{
        if(wsRef.current){
            if(isRecording){
            wsRef.current.send('start');
        }}
        
    },[isRecording])
    useImperativeHandle(ref, () => ({
        getTranscriptionContent: () => transcription,
    }));

    const handleClick = () => {
        setIsRecording(!isRecording);
        if (!isRecording) { // 当开始录音时创建节点
            const newNode:Node = {
                id: `circle-${Date.now()}`,
                type: 'circle',
                data: { label: 'New Recording' },
                position: { x: 100, y: 100 },
               
            };
            onNodeCreate(newNode);
        }
    };
    const getRecent = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        return {
            text:lines.slice(-10).join('\n'),
            count:lines.length
        }
        // return lines.join('\n');
    };
    const extractKeywords = async (text: string) => {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{
                    role: "system",
                    content: "You are a keyword extraction expert. Extract the most important keywords from the given text. Return only the keywords as a comma-separated list."
                }, {
                    role: "user",
                    content: text
                }],
                temperature: 0.3,
            });

            const keywordString = response.choices[0].message.content;
            if (keywordString) {
                setKeywords(keywordString);
                console.log(keywordString);
            }
        } catch (error) {
            console.error('Error extracting keywords:', error);
        }
    };
    return (
        <div ref={containerRef}>

           <div style={{position: 'absolute', left: '5vw', top: '20vw', zIndex: 6}}>
            {/*{getRecent(transcription).text}*/}
            {keywords}
            </div>
                <button style={{position: 'absolute', right: '5vw', top: '1vw', zIndex: 6}} onClick={handleClick}>{isRecording?'Stop':'Start'}</button>

        </div>
    );
});

export default RealTimeTranscription;