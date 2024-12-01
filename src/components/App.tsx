import { useState, useCallback, useEffect, useRef } from 'react';
import RealTimeTranscription from './RealTimeTranscription';
import '../style/index.css'
import CircleNode from "./CircleNode.tsx";

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
import { openai } from '../utils/openai.ts';
import { extractKeywords } from '../utils/openaiUtils.ts';
import ArrowRectangleNode from './ArrowRectangleNode.tsx';
import ReminderCircleNode from './ReminderCircleNode.tsx';

import EditableNode from "./EditableNode";
import GroupNode from "./GroupNode";


interface Category {
    category: string;
    questions: string[];
}

interface Result {
    categories: Category[];
}

function App() {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const realTimeTranscriptionRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const [scriptText, setScriptText] = useState('');
    const [similarityIndex, setSimilarityIndex] = useState(0);
    const [questionScript,setQuestionScript]=useState<Result | null>(null);
    const [firstNodeId, setFirstNodeId] = useState<string | null>(null);
    const newNodes: Node[] = [];
    const [tagNodeCounter, setTagNodeCounter] = useState<number[]>([]);
    let xOffset = 50;
    let nodeCounter = 0;
    // const { getIntersectingNodes } = useReactFlow();

    const nodeTypes = {
        editable: EditableNode,
        circle: (props: NodeProps) => (
            <CircleNode {...props} onClick={handleMarkNodeClick} />
        ),
        group: GroupNode,
        arrowRectangle: ArrowRectangleNode,
        reminderCircle: (props: NodeProps) => (
            <ReminderCircleNode {...props} onClick={handleReminderNodeClick} />
        ),
    };
    const handleFirstNodeUpdate = () => {
        setNodes((nodes) => nodes.map(node => {
            if (node.id === "0") {
                return {
                    ...node,
                    style: {
                        ...node.style,
                        backgroundColor: 'rgb(255, 255, 30)'
                    }
                };
            }
            return node;
        }));
    }

    useEffect(() => {
        console.log('tagNodeCounter updated:', tagNodeCounter);
        fetch('http://localhost:8070/handle-answer-click', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(response => response.json())
        .then(data => {
            console.log('received segments from backend:', data);
            setNodes((prevNodes) => {
                const mostSimilarNode = prevNodes.find(node => 
                    node.type === 'editable' && 
                    node.style?.backgroundColor && 
                    node.style.backgroundColor !== 'white'
                );
                if (!mostSimilarNode) return prevNodes;
                const currentCount=tagNodeCounter[Number(mostSimilarNode.id)] || 0;
                const newNode={
                    id:Date.now().toString(),
                    type:'arrowRectangle',
                    data:{label:data.text},
                    position:{x:mostSimilarNode.position.x+currentCount*80,y:mostSimilarNode.position.y+50},
                    parentId:mostSimilarNode.id
                };
                return [...prevNodes,newNode];
            });
        });
    }, [tagNodeCounter]);

    const handleMarkNodeClick = useCallback(async (nodeId: string) => {
        console.log('clicked circle node',nodeId);
        const clickedNode = nodes.find(node => node.id === nodeId);
        if (!clickedNode || clickedNode.type !== 'circle') return nodes;
        const mostSimilarNode = nodes.find(node => 
            node.type === 'editable' && 
            node.style?.backgroundColor && 
            node.style.backgroundColor !== 'white'
        );
        console.log('Current nodes:', nodes.map(node => ({
            id: node.id,
        })));
        
        if (!mostSimilarNode){ console.log('no most similar node'); 
            return nodes;} 
        const currentCount=tagNodeCounter[Number(mostSimilarNode.id)] || 0;
        tagNodeCounter.forEach((count, index) => {
            if (count !== undefined) {
                console.log(`Index: ${index}, Count: ${count}`);
            }
        });
        console.log('currentCount',currentCount);
        setTagNodeCounter(prev =>{
            prev[Number(mostSimilarNode.id)] = (prev[Number(mostSimilarNode.id)])? 
            prev[Number(mostSimilarNode.id)]+1: 1;
            return prev;
        });
            // Your commented code can go here if needed
        
    }, []);
           const handleReminderNodeClick = useCallback(async (nodeId: string) => {

           },[]);
            // 存储其他segments到数组中
            // const previousSegments = segments.slice(0, -1).map((seg: { text: string }) => seg.text);
            // console.log('Previous segments:', previousSegments);

    const onNodeDragStop = useCallback((_, node) => {
        setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
        );
    }, [setNodes]);
    const handleNodeCreate = (newNode: Node) => {
        setNodes((nodes) => [...nodes, newNode]);
    };
    const createGroupNode = (category: string, questionsLength: number, currentCounter: number, xPos: number): Node => {
        const groupHeight = questionsLength * 100 + 40;
        return {
            id: `Group-${currentCounter}`,
            type: 'group',
            data: { label: category },
            position: { x: xPos, y: 100 },
            style: {
                backgroundColor: 'rgba(192, 192, 192, 0.5)',
                width: 370,
                height: groupHeight,
                padding: '20px'
            }
        };
    };
    const createQuestionNode = (question: string, currentCounter: number, parentId: string, questionCounter: number): Node => {
        const width = Math.min(question.length * 9, 340); // minimum width of 100px
        return {
            id: `${currentCounter}`,
            type: 'editable',
            data: { label: question },
            position: { x: 20, y: questionCounter * 95 + 50 },
            parentId: parentId,
            extent: 'parent',
            draggable: true,
            style: {
                backgroundColor: 'rgba(255, 255, 255, 1)',
                overflow: 'visible',
                whiteSpace: 'pre-wrap', 
                height: 'auto',  
                width: width,
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
        setSimilarityIndex(similarityData[0].index);
        console.log('similarityIndex updated',similarityIndex);
        // 这里可以用这些索引来更新节点状态
        // 例如：高亮显示相似的节点
        setNodes(nodes => nodes.map(node =>{
            // 只更新 type 为 'question' 的节点
            if (node.type === 'editable') {
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
                    <RealTimeTranscription ref={realTimeTranscriptionRef} onNodeCreate={handleNodeCreate} firstNodeId={firstNodeId}  onSimilarityUpdate={handleSimilarityUpdate} onFirstNodeUpdate={handleFirstNodeUpdate}/>
                    <Background />
                    <Controls />
                </ReactFlow>
            </ReactFlowProvider>
        </div>
    );
}

export default App;