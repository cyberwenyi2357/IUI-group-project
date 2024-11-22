import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import './index.css'
import { extractKeywords, getEmbedding } from './openaiUtils';
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
    firstNodeId: string | null;
    onNodeUpdate: (keywords:string) => void;
    onSimilarityUpdate: (data: Array<{index: number, similarity: number}>) => void;
}
const RealTimeTranscription = forwardRef((props:Props, ref) => {
    const { onNodeCreate, firstNodeId,onNodeUpdate } = props;
    const [transcription, setTranscription] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const containerRef = useRef(null);
    const wsRef=useRef<WebSocket|null>(null);
    const [keywords,setKeywords]=useState<string>('no keywords now');
    const [nodeCounter, setNodeCounter] = useState(1);
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
        if (!isRecording && firstNodeId) { // 当开始录音时创建circleNode
            const newNode:Node = {
                id: `circle-${nodeCounter}`,
                type: 'circle',
                data: { keywords: keywords },
                position: { x: 100, y: 100 },
               parentId:firstNodeId
            };
            onNodeCreate(newNode);
            setNodeCounter(prev => prev + 1);
        }
    };

    
    useEffect(() => {
        console.log('transcription updated:', transcription);
        const words = transcription.trim().split(/\s+/);
        if (words.length >= 30) {
            extractKeywords(transcription).then(keyword=>{
                if(keyword){
                setKeywords(keyword);
                onNodeUpdate(keyword);
                }
                fetch('http://localhost:8070/embedding', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: transcription })
                }).then(response => response.json())
                .then(data => {
                    // 提取索引并传递给父组件
                    const indices = data.similarities.map((sim: {
                        index: number,
                        similarity: number
                    }) =>  ({
                        index: sim.index,
                        similarity: sim.similarity
                    }));
                    props.onSimilarityUpdate(indices);
                })
                .catch(error => console.error('Error:', error));
            }); 
            setTranscription('');  // 重置 transcription
        }
    }, [transcription]);

    return (
        <div ref={containerRef}>

           <div style={{position: 'absolute', left: '5vw', top: '20vw', zIndex: 6}}>
            </div>
                <button style={{position: 'absolute', right: '5vw', top: '1vw', zIndex: 6}} onClick={handleClick}>{isRecording?'Stop':'Start'}</button>

        </div>
    );
});

export default RealTimeTranscription;