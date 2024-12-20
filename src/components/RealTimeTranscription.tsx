import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

import {
    type Node,  // <- 这里导入了 Node 类型
} from '@xyflow/react';

import {sendEvent} from "../utils/logUtils";


interface Props {
    onNodeCreate: (newNode: Node) => void;
    firstNodeId: string | null;
    onFirstNodeUpdate: () => void;
    isRecording: boolean;
    setIsRecording: (isRecording: boolean) => void;
    // onSimilarityUpdate: (data: Array<{index: number, similarity: number}>) => void;
}

const RealTimeTranscription = forwardRef((props:Props, ref) => {
    const { onNodeCreate, firstNodeId, isRecording, setIsRecording } = props;
    const [transcriptionForTopic, setTranscriptionForTopic] = useState('');
    // const [isRecording, setIsRecording] = useState(false);

    const wsRef=useRef<WebSocket|null>(null);
    const [nodeCounter, setNodeCounter] = useState(1);

    

    useImperativeHandle(ref, () => ({
        getTranscriptionContent: () => transcriptionForTopic,
    }));

    const handleClick = () => {
        sendEvent({
            "name": "ClickOnStart/Stop",
            "time": new Date().toISOString(),
        });

        setIsRecording(!isRecording)
        if (!isRecording && firstNodeId) {
            props.onFirstNodeUpdate();
            const markNode:Node = {
                id: `circle-${nodeCounter}`,
                type: 'circle',
                data: { keywords: 'Mark' },
                position: { x: 100, y: 35 },
                
            };
            const reminderNode: Node = {
                id: `reminder-${nodeCounter}`,
                type: 'reminderCircle',
                data: { keywords: 'Missed?' },
                position: { x:  170, y: 35 }, // Positioned below the circle node
                
            };
            onNodeCreate(markNode);
            onNodeCreate(reminderNode);
            setNodeCounter(prev => prev + 1);
        }
    };


    return (
        <>
            {
                isRecording ? (<button className={"recording-button-blinking"} onClick={handleClick}>Stop</button>)
                            : (<button className={"recording-button"} onClick={handleClick}>Start</button>)
            }
        </>
    );
});

export default RealTimeTranscription;