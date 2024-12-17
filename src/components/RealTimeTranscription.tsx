import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import '../style/index.css'

import {
    type Node,  // <- 这里导入了 Node 类型
} from '@xyflow/react';

interface Props {
    onNodeCreate: (newNode: Node) => void;
    firstNodeId: string | null;
    onFirstNodeUpdate: () => void;
    onSimilarityUpdate: (data: Array<{index: number, similarity: number}>) => void;
}

const RealTimeTranscription = forwardRef((props:Props, ref) => {
    const { onNodeCreate, firstNodeId } = props;
    const [transcriptionForTopic, setTranscriptionForTopic] = useState('');
    const [transcriptionForSegment, setTranscriptionForSegment] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const containerRef = useRef(null);
    const wsRef=useRef<WebSocket|null>(null);
    const [borderColor, setBorderColor] = useState("transparent"); 
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

            try {
                const data = JSON.parse(event.data);
                
                // 检查是否是 similarity 类型的消息
                if (data.type === 'similarity') {
                    // 提取索引并传递给父组件
                    const indices = data.data.map((sim: {
                        index: number,
                        similarity: number
                    }) => ({
                        index: sim.index,
                        similarity: sim.similarity
                    }));
                    props.onSimilarityUpdate(indices);
                } 
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        return () => {
            if(wsRef.current && wsRef.current.readyState===1){
                wsRef.current.close();
            }
        };
    }, []);

    useEffect(()=>{
        let intervalId: NodeJS.Timeout;
        if(wsRef.current){
            if(isRecording){
            wsRef.current.send('start');
        }}
        if(isRecording){
            let toggle = true;
            intervalId = setInterval(() => {
                setBorderColor(toggle ? "#F08080" : "transparent"); // 橙红色和蓝色之间切换
                toggle = !toggle;
              }, 800); // 每 500 毫秒切换一次颜色
        }
        return () => {
            clearInterval(intervalId);
          };
    },[isRecording])
    useImperativeHandle(ref, () => ({
        getTranscriptionContent: () => transcriptionForTopic,
    }));

    const handleClick = () => {
        setIsRecording((prev) => !prev);
        if (!isRecording && firstNodeId) {
            props.onFirstNodeUpdate();
            const markNode:Node = {
                id: `circle-${nodeCounter}`,
                type: 'circle',
                data: { keywords: 'Mark' },
                position: { x: 230, y: 20 },
               parentId:firstNodeId
            };
            const reminderNode: Node = {
                id: `reminder-${nodeCounter}`,
                type: 'reminderCircle',
                data: { keywords: 'Missed?' },
                position: { x: 300, y: 20 }, // Positioned below the circle node
                parentId: firstNodeId
            };
            onNodeCreate(markNode);
            onNodeCreate(reminderNode);
            setNodeCounter(prev => prev + 1);
        }
    };

    //实时检测topic
    // useEffect(() => {
    //     const words = transcriptionForTopic.trim().split(/\s+/);
    //     if (words.length >= 25) {
    //         fetch('http://localhost:8070/embedding', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({ text: transcriptionForTopic })
    //         }).then(response => response.json())
    //         .then(data => {
    //             // 提取索引并传递给父组件
    //             const indices = data.similarities.map((sim: {
    //                 index: number,
    //                 similarity: number
    //             }) =>  ({
    //                 index: sim.index,
    //                 similarity: sim.similarity
    //             }));
    //             props.onSimilarityUpdate(indices);
    //         })
    //         .catch(error => console.error('Error:', error));
    //         // extractKeywords(transcription).then(keyword=>{
    //         //     if(keyword){
    //         //     setKeywords(keyword);
    //         //     onNodeUpdate(keyword);
    //         //     }
                
    //         // }); 
    //         console.log('transcription updated:', transcriptionForTopic);
    //         setTranscriptionForTopic('');  // 重置 transcription
    //     }
    // }, [transcriptionForTopic]);


    return (
        <div ref={containerRef}>

           <div style={{position: 'absolute', left: '5vw', top: '20vw', zIndex: 6}}>
            </div>
                <button className={'recording-button'} style={{position: 'absolute', right: '5vw', top: '1vw', zIndex: 6,border: `5px solid ${borderColor}`}}  onClick={handleClick}>{isRecording?'Stop':'Start'}</button>

        </div>
    );
});

export default RealTimeTranscription;