import { useState, useCallback, useEffect, useRef } from 'react';
import RealTimeTranscription from './RealTimeTranscription';
import './index.css'
import CircleNode from "./circleNode.tsx";

import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    useNodesState,
    MiniMap,
    type Edge,
    type Node,
    type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GroupNode } from "@xyflow/react/dist/esm/components/Nodes/GroupNode";
import { openai } from './openai.ts';


function EditableNode({ id, data }: NodeProps) {
    const [label, setLabel] = useState(data.label);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLabel(event.target.value);
    };

    return (
        <div style={{ padding: 10, border: '1px solid #000', backgroundColor: '#ffffff', borderRadius: 2 }}>
            <input
                type="text"
                value={label}
                onChange={handleChange}
                style={{ width: '100%', border: 'none', textAlign: 'center' }}
            />
        </div>
    );
}
function groupNode({ id, data }: NodeProps) {
    return (
        <div>{data.label}</div>
    )
}

const nodeTypes = {
    editable: EditableNode,
    circle: CircleNode,
    group: groupNode,
};

function App() {
    const initialNodes: Node[] = [
        // {
        //     id: '4',
        //     data: { label: 'Basic User Experience' },
        //     position: { x: 320, y: 200 },
        //     className: 'light',
        //     style: { backgroundColor: 'rgba(255, 0, 0, 0.2)', width: 300, height: 300 },
        //     type: 'group',
        // },
        // { id: '1', position: { x: 10, y: 20 }, data: { label: '1' }, type: 'editable' ,parentId:'4',extent:'parent'},
        // { id: '2', position: { x: 100, y: 200 }, data: { label: '2' }, type: 'circle',parentId:'4',extent:'parent' },
    ];
    const initialEdges: Edge[] = [];
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const realTimeTranscriptionRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const [scriptText, setScriptText] = useState('');
    const onNodeDragStop = useCallback((_, node) => {
        setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
        );
    }, [setNodes]);
    // Effect to update button position to the position of the last node in the list
    // const handleAddQuestion = () => {
    //     if (nodes.length > 0) {
    //         // Get the last node
    //         const lastNode = nodes[nodes.length - 1];
    //         // Calculate new node's id and position
    //         const newId = String(Number(lastNode.id) + 1); // New id as last node's id + 1
    //         const newPosition = { x: lastNode.position.x, y: lastNode.position.y + 60 }; // New position below the last node
    //         // Create the new node
    //         const newNode: Node = {
    //             id: newId,
    //             position: newPosition,
    //             data: { label: newId },
    //             type: 'editable',
    //         };

    //         // Add the new node to the current list of nodes
    //         setNodes((nds) => [...nds, newNode]);
    //     }
    // };
    const handleNodeCreate = (newNode: Node) => {
        setNodes((nodes) => [...nodes, newNode]);
    };
    const handleUpload = async () => {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{
                    role: "system", content: `Analyze the given text and extract question categories and specific questions.
            Return the result in the following JSON format:{
                [
                    {
                        "category": "Category1 Name",
                        "questions": ["Question Name1", "Question Name2", ...]
                    },
                    {
                        "category": "Category2 Name",
                        "questions": ["Question Name1", "Question Name2", ...]
                    },
                    ...
                ]
            }
            Make sure the output is valid JSON.`}, {
                    role: "user",
                    content: scriptText
                }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });
            setShowModal(false)
            const result = JSON.parse(response.choices[0].message.content || "{}");
            console.log('Parsed categories:', result);
            //创建节点数组
            const newNodes: Node[] = [];
            let yOffset = 100;
            result.categories.forEach((category: any, categoryIndex: number) => {
                const groupHeight = category.questions.length * 60 + 40;
                const groupNode: Node = {
                    id: `category-${categoryIndex}`,
                    type: 'group',
                    data: { label: category.category },
                    position: { x: 100, y: yOffset },
                    style: {
                        backgroundColor: 'rgba(192, 192, 192, 0.5)',
                        width: 300,
                        height: groupHeight,
                        padding: '20px'
                    }
                };
                newNodes.push(groupNode);
                category.questions.forEach((question: string, questionIndex: number) => {
                    const questionNode: Node = {
                        id: `question-${categoryIndex}-${questionIndex}`,
                        type: 'editable',
                        data: { label: question },
                        position: { x: 20, y: questionIndex * 80 + 50 }, // 在组内垂直排列
                        parentId: `category-${categoryIndex}`, // 设置父节点
                        extent: 'parent', // 限制在父节点内移动
                        draggable: true
                    };
                    newNodes.push(questionNode);
                });
                yOffset += groupHeight + 50;
                setNodes(newNodes);
            });
        } catch (error) {
            console.error('Error parsing text with GPT:', error);
            alert('Error processing the text. Please try again.');
            console.log('Uploaded script:', scriptText);
            setShowModal(false);
            setScriptText('');
        };
        
    }
    return (
        <div style={{ height: '95vh', width: '100vw' }}>
            <button style={{ position: 'absolute', left: '3vw', top: '1vw', zIndex: 2 }} onClick={() => setShowModal(true)}>Upload script</button>
            {showModal && (
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    width: '500px',
                }}>
                    <textarea
                        value={scriptText}
                        onChange={(e) => setScriptText(e.target.value)}
                        style={{
                            width: '100%',
                            height: '200px',
                            marginBottom: '10px',
                            padding: '8px',
                            resize: 'vertical'
                        }}
                        placeholder="Enter your script here..."
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            onClick={() => setShowModal(false)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#f0f0f0',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Upload
                        </button>
                    </div>
                </div>
            )}
            {/* <button style={{position:'absolute',left:'10vw',top:'1vw',zIndex:2}} onClick={handleAddQuestion}>Add question</button> */}
            <ReactFlowProvider>
                <ReactFlow
                    nodes={nodes}
                    edges={initialEdges}
                    onNodesChange={onNodesChange}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    className="react-flow-subflows-example"
                    minZoom={0.2}
                    maxZoom={4}
                    fitView
                >
                    <MiniMap zoomable pannable nodeClassName={'intersection-flow'} />
                    <RealTimeTranscription ref={realTimeTranscriptionRef} onNodeCreate={handleNodeCreate} />
                    <Background />
                    <Controls />
                </ReactFlow>
            </ReactFlowProvider>
        </div>
    );
}

export default App;