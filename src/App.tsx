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
    useReactFlow,
    MiniMap,
    type Edge,
    type Node,
    type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { openai } from './openai.ts';


interface Category {
    category: string;
    questions: string[];
}

interface Result {
    categories: Category[];
}


function EditableNode({ id, data }: NodeProps) {
    const [label, setLabel] = useState(data.label);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLabel(event.target.value);
    };

    return (
        <div style={{ padding: 10, border: '1px solid #000', borderRadius: 2 }}>
            <textarea
                value={label as string}
                onChange={handleChange}
                style={{
                    width: '100%',
                    border: 'none',
                    textAlign: 'center',
                    resize: 'none',
                    overflow: 'hidden',
                    minHeight: '20px',
                    backgroundColor: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: '1.5',
                }}
                rows={1}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                }}
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

    ];
    const initialEdges: Edge[] = [];
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const realTimeTranscriptionRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const [scriptText, setScriptText] = useState('');
    const [questionScript,setQuestionScript]=useState<Result | null>(null);
    const [firstNodeId, setFirstNodeId] = useState<string | null>(null);
    const newNodes: Node[] = [];
    let xOffset = 50;
    let nodeCounter = 0; 
    // const { getIntersectingNodes } = useReactFlow();
    const onNodeDragStop = useCallback((_, node) => {
        setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
        );
    }, [setNodes]);
    // const onNodeDragStop = useCallback((_, draggedNode) => {
    //     setNodes((nodes) => {
    //         // 首先更新被拖拽节点的位置
    //         const updatedNodes = nodes.map(node => 
    //             node.id === draggedNode.id 
    //                 ? { ...node, position: draggedNode.position }
    //                 : node
    //         );
            
    //         // 然后使用 updateNodePositions 调整所有节点的位置
    //         return updateNodePositions(updatedNodes);
    //     });
    // }, [setNodes, updateNodePositions]); 
    // const onNodeDrag = useCallback((_, draggedNode: Node) => {
    //     setNodes((nodes) => {
    //         const updatedNodes = [...nodes];
    //         // 获取与拖动节点相交的所有节点
    //         const intersectingNodes = getIntersectingNodes(draggedNode).filter(
    //             node => (node.type === 'editable' || node.type === 'circle') && node.id !== draggedNode.id
    //         );
            
    //         // 如果有相交的节点，计算并应用推力
    //         intersectingNodes.forEach(node => {
    //             // 计算推力
    //             const dx = node.position.x - draggedNode.position.x;
    //             const dy = node.position.y - draggedNode.position.y;
    //             const distance = Math.sqrt(dx * dx + dy * dy);
                
    //             // 设置最小距离和推力强度
    //             const minDistance = 100;
    //             const repulsionStrength = 20;
                
    //             if (distance < minDistance) {
    //                 const force = (minDistance - distance) / minDistance * repulsionStrength;
    //                 const nodeIndex = updatedNodes.findIndex(n => n.id === node.id);
                    
    //                 if (nodeIndex !== -1) {
    //                     const newPosition = {
    //                         x: node.position.x + (dx / distance) * force,
    //                         y: node.position.y + (dy / distance) * force
    //                     };
    //                     updatedNodes[nodeIndex] = {
    //                         ...node,
    //                         position: newPosition
    //                     };
    //                 }
    //             }
                
    //         });
    //         return updatedNodes;
    //     }, [setNodes,getIntersectingNodes]);
    // }
    const handleNodeCreate = (newNode: Node) => {
        setNodes((nodes) => [...nodes, newNode]);
    };
    const createGroupNode = (category: string, questionsLength: number, currentCounter: number, xPos: number): Node => {
        const groupHeight = questionsLength * 60 + 40;
        return {
            id: `Group-${currentCounter}`,
            type: 'group',
            data: { label: category },
            position: { x: xPos, y: 100 },
            style: {
                backgroundColor: 'rgba(192, 192, 192, 0.5)',
                width: 300,
                height: groupHeight,
                padding: '20px'
            }
        };
    };
    const createQuestionNode = (question: string, currentCounter: number, parentId: string, questionCounter: number): Node => {
        const width = Math.max(question.length * 8, 80); // minimum width of 100px
        return {
            id: `${currentCounter}`,
            type: 'editable',
            data: { label: question },
            position: { x: 20, y: questionCounter * 70 + 50 },
            parentId: parentId,
            extent: 'parent',
            draggable: true,
            style: {
                backgroundColor: 'rgba(255, 255, 255, 1)',
                overflow: 'visible',
                whiteSpace: 'pre-wrap', 
                height: 'auto',  
            }
        };
    };

    const handleUpload = async () => {
        const combinedTexts: string[] = [];
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{
                    role: "system", content: `Analyze the given text and extract question categories and specific questions.If you find there are some introduction sentences at the start of each question category, you can add it to the category name.
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
            setQuestionScript(result);
            
            result.categories.forEach((category: any) => {
                let questionCounterForEachGroup=0;
                const groupNode = createGroupNode(
                    category.category,
                    category.questions.length,
                    nodeCounter,
                    xOffset
                );
                newNodes.push(groupNode);
                const currentGroupId = nodeCounter;
                if (nodeCounter === 0) {
                    setFirstNodeId(groupNode.id);
                }
                category.questions.forEach((question: string) => {
                    
                    const combinedText = `${category.category}: ${question}`;
                    combinedTexts.push(combinedText);
                    const questionNode = createQuestionNode(
                        question,
                        nodeCounter,
                        `Group-${currentGroupId}`,
                        questionCounterForEachGroup
                    );
                    newNodes.push(questionNode);
                    nodeCounter++;
                    questionCounterForEachGroup++;
                });
                
                xOffset += 300;
                setNodes(newNodes);
            });
        } catch (error) {
            console.error('Error parsing text with GPT:', error);
            alert('Error processing the text. Please try again.');
            console.log('Uploaded script:', scriptText);
            setShowModal(false);
            setScriptText('');
        };
        fetch('http://localhost:8070/initial-embedding-for-questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(combinedTexts),
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Successfully generated embeddings for all texts`);
            } 
        }).catch(error => {
            console.error('Error sending texts for embedding:', error);
        });
    }
    const handleAnswerNodeUpdate = (keywords:string) => {
        setNodes((nodes) =>
            {
                // 找到最后一个 circle 类型的节点
                const lastCircleNode = [...nodes].reverse().find(node => node.type === 'circle');
                if (!lastCircleNode) return nodes;  // 如果没找到，返回原始数组
                const width = keywords.length * 6;
                // 更新找到的节点的数据
                return nodes.map(node => 
                    node.id === lastCircleNode.id
                        ? { ...node, data: { ...node.data, keywords: keywords },
                        style: {
                            ...node.style,
                            width: `${width}px`
                        } 
                    }
                        : node
                );
            }
        );
    }
    const handleSimilarityUpdate = (similarityData: Array<{index: number, similarity: number}>) => {
        console.log('Similarity data:', similarityData);
        // 这里可以用这些索引来更新节点状态
        // 例如：高亮显示相似的节点
        setNodes(nodes => nodes.map(node =>{
            // 只更新 type 为 'question' 的节点
            if (node.type === 'editable') {
                // 检查这个节点是否是相似度最高的两个节点之一
                const matchingData = similarityData.find(data => data.index === Number(node.id));
                if (matchingData) {
                    // 使用 rgba 模型，根据相似度设置透明度
                    const opacity = Math.pow(matchingData.similarity, 2);  // 使用平方来增加差异
                    return {
                        ...node,
                        style: {
                            ...node.style,
                            backgroundColor: `rgba(255, 255, ${(1-opacity)*255}, 1)`  // 黄色，透明度根据相似度变化
                        }
                    };
                } else {
                    // 不是相似度最高的两个节点，设置为白色
                    return {
                        ...node,
                        style: {
                            ...node.style,
                            backgroundColor: 'white'
                        }
                    };
                }
            }
            // 其他类型的节点保持不变
            return node;
        } ));
    };
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
            <ReactFlowProvider>
                <ReactFlow
                    nodes={nodes}
                    edges={initialEdges}
                    onNodesChange={onNodesChange}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    // className="react-flow-subflows-example"
                    // onNodeDrag={onNodeDrag}
                    minZoom={0.2}
                    maxZoom={4}
                    fitView
                >
                    <MiniMap zoomable pannable nodeClassName={'intersection-flow'} />
                    <RealTimeTranscription ref={realTimeTranscriptionRef} onNodeCreate={handleNodeCreate} firstNodeId={firstNodeId} onNodeUpdate={handleAnswerNodeUpdate} onSimilarityUpdate={handleSimilarityUpdate}/>
                    <Background />
                    <Controls />
                </ReactFlow>
            </ReactFlowProvider>
        </div>
    );
}

export default App;