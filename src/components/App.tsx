import { useState, useCallback, useEffect, useRef } from 'react';
import RealTimeTranscription from './RealTimeTranscription';
import CircleNode from "./CircleNode.tsx";
import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    useNodesState,
    MiniMap,
    NodeToolbar,
    type Edge,
    type Node,
    type NodeProps, useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { openai } from '../utils/openai.ts';
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
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const realTimeTranscriptionRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const [scriptText, setScriptText] = useState('');
    const [similarityIndex, setSimilarityIndex] = useState(0);
    const simIndexRef = useRef(similarityIndex);

    const [firstNodeId, setFirstNodeId] = useState<string | null>(null);
    const [currentParentId, setCurrentParentId] = useState<string>(' ');
    const [tagNodeCounter, setTagNodeCounter] = useState<number[]>([]);

    // 在App组件的开头添加新的状态
    const [storedSegmentNodes, setStoredSegmentNodes] = useState<Node[]>([]);
    let xOffset = 50;
    let nodeCounter = 0;
    // const { getIntersectingNodes } = useReactFlow();

    const nodeTypes = {
        editable: EditableNode,
        circle: (props: NodeProps) => (
            <CircleNode {...props} onClick={handleMarkNodeClick} />
        ),
        group: GroupNode,
        arrowRectangle: (props: any) => (
            <ArrowRectangleNode
              {...props}
              onClick={handleArrowRectangleNodeClick}
            />
        ),
        reminderCircle: (props: NodeProps) => (
            <ReminderCircleNode {...props} onClick={handleReminderNodeClick} />
        ),
        'node-with-toolbar':NodeWithToolbar
    };
    function NodeWithToolbar({ data, id }) {
        const handleAbandon = () => {
            console.log('Abandoning node:', id);
            setNodes((nodes) => nodes.filter((node) => node.id !== id));
        };
        return (
          <>
            <NodeToolbar
              isVisible={data.forceToolbarVisible || undefined}
              position={data.toolbarPosition}
            >
              <button onClick={handleAbandon}>abandon</button>
              <button>regenerate</button>
            </NodeToolbar>
            <div>{data?.label}</div>
          </>
        );
      }
    const handleFirstNodeUpdate = () => {
        setTimeout(() => {
            setNodes((nodes) => nodes.map(node => {
                if (node.id === "0") {
                    return {
                        ...node,
                        style: {
                            ...node.style,
                            backgroundColor: 'rgb(255, 255, 100)'
                        }
                    };
                }
                return node;
            }));
        }, 3000);
    }

    useEffect(() => {
        console.log('tagNodeCounter updated:', tagNodeCounter);
        // 创建 EventSource 连接
        const eventSource = new EventSource('http://localhost:8070/handle-answer-click');
    
        // 处理分段摘要
        eventSource.addEventListener('segments', (event) => {
            const segments = JSON.parse(event.data);
            console.log('received segments from backend:', segments.data);

            setNodes((prevNodes) => {
                const mostSimilarNode = prevNodes.find(node =>
                    node.type === 'editable' &&
                    node.style?.backgroundColor &&
                    node.style.backgroundColor !== 'white'
                );

                console.log('mostSimilarNode:', mostSimilarNode);
                if(!mostSimilarNode) return prevNodes;
                
                const currentCount = tagNodeCounter[Number(mostSimilarNode.id)] || 0;
                console.log('currentCount:', currentCount);
                const newNode = {
                    id: `${mostSimilarNode.id}-${currentCount}`,
                    type: 'arrowRectangle',
                    data: { label: segments.keyword},
                    position: {
                        x: mostSimilarNode.position.x + (currentCount-1)*80,
                        y: mostSimilarNode.position.y + 50
                    },
                    parentId: mostSimilarNode.parentId
                };
                return [...prevNodes, newNode];
            });
        });
    
        // 处理跟进问题
        eventSource.addEventListener('followUp', (event) => {
            const { followUpQuestion } = JSON.parse(event.data);
            console.log('Received follow-up question:', followUpQuestion);
            // 解析 JSON 字符串
            // 在这里处理跟进问题
            // 比如设置到某个状态中
            setNodes(prevNodes => {
                const newNodes = [...prevNodes];
                const lastNode = newNodes[newNodes.length - 1];
                if (lastNode) {
                    lastNode.data = {
                        ...lastNode.data,
                        followUp: followUpQuestion,
                    };
                }
                console.log('last node:', lastNode);
                return newNodes;
            });
            eventSource.close();
        });
    
        // 错误处理
        eventSource.addEventListener('error', (event) => {
            console.error('Error:', event);
            eventSource.close();
        });
    
        // 清理函数
        return () => {
            eventSource.close();
        };
        
    }, [JSON.stringify(tagNodeCounter)]);

    const handleMarkNodeClick = async (nodeId: string) => {
        console.log('clicked circle node',nodeId);
        const clickedNode = nodes.find(node => node.id === nodeId);
        if (!clickedNode || clickedNode.type !== 'circle')
            return ;
        // TODO: 2. once you recorded the highlighted node as status, no need to find it everytime.
        

        // TODO: 3. once you recorded the tag nodes counter inside the highlighted node, we can remove the tagNodeCounter status, and avoid the useEffect() then.
        setTagNodeCounter(prev => {
            const newCounter = [...prev]; // Create a new array
            newCounter[Number(simIndexRef.current)] = (prev[Number(simIndexRef.current)] || 0) + 1;
            return newCounter; 
        });
        console.log(JSON.stringify(tagNodeCounter));
    }
    const handleArrowRectangleNodeClick = async (followUp: string, event: React.MouseEvent, nodeData: Node) => {
        console.log('clicked arrow rectangle node', nodeData.id);
        console.log('clicked arrow rectangle node',followUp);
        const clickedNode = nodes.find(node => node.id === nodeData.id);
        if (!clickedNode) return;
        const newNodePosition = {
            x: clickedNode.position.x,
            y: clickedNode.position.y + 30
        };
        const newNode: Node = {
            id: `followup-${Date.now()}`,
            type: 'node-with-toolbar',
            data: { label: followUp },
            position: newNodePosition,
            parentId: clickedNode.parentId, // 保持相同的 parent
            style: {
                backgroundColor: 'white',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc'
            },
            connectable:false
        };
        setNodes((currentNodes) => {
            // 找出所有可能重叠的节点
            const overlappingNodes = currentNodes.filter(node => {
                // 跳过当前点击的节点
                if (node.id === clickedNode.id) return false;
                
                // 检查节点是否在同一个父节点下
                if (node.parentId !== clickedNode.parentId) return false;
    
                // 检查节点是否与新节点位置重叠
                const nodeY = node.position.y;
                
                return nodeY >= newNode.position.y && 
                       nodeY < newNode.position.y + (newNode.style?.height as number);
            });
    
            // 如果有重叠的节点，将它们向下移动
            if (overlappingNodes.length > 0) {
                const shiftAmount = (newNode.style?.height as number) + 10; // 额外添加10px间距
                
                return currentNodes.map(node => {
                    if (overlappingNodes.find(n => n.id === node.id)) {
                        return {
                            ...node,
                            position: {
                                ...node.position,
                                y: node.position.y + shiftAmount
                            }
                        };
                    }
                    return node;
                }).concat(newNode);
            }
    
            // 如果没有重叠，直接添加新节点
            return [...currentNodes, newNode];
        });
    };
    const handleReminderNodeClick = async (nodeId: string) => {
        const clickedNode = nodes.find(node => node.id === nodeId);
        if (!clickedNode || clickedNode.type !== 'reminderCircle') return;
        const parentId = clickedNode.parentId;
        try {
            // 调用新的后端接口来生成 talking points
            const response = await fetch('http://localhost:8070/generate-reminder-talking-points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    parentId
                }),
            });
    
            if (!response.ok) {
                throw new Error('Failed to generate talking points');
            }
            const segments = await response.json();
        
            // 找到父节点以获取位置信息
            const parentNode = nodes.find(node => node.id === parentId);
            
            // 创建新节点
            const newNodes = segments.map((segment: { keyword: string }, index: number) => ({
                id: `segment-${Date.now()}-${index}`,
                type: 'arrowRectangle',
                data: { label: segment.keyword, color: '#FFA500' },
                position: {
                    x: parentNode?.position?.x ?? 0 + (parentNode?.style?.width as number)+80,
                    y: Number(parentNode?.position?.y ?? 0) + (index * 50)
                },
                parentId: parentId,
            }));
    
            // 存储新创建的节点
            setStoredSegmentNodes(newNodes);
            // 立即显示节点
        setNodes(prevNodes => [...prevNodes, ...newNodes]);
    } catch (error) {
        console.error('Error generating talking points:', error);
    }
}
            // 存储其他segments到数组中
            // const previousSegments = segments.slice(0, -1).map((seg: { text: string }) => seg.text);
            // console.log('Previous segments:', previousSegments);

    const onNodeDragStop = useCallback((_: any, node: any) => {
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

            const newNodes: Node[] = [];
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
            const totalGroups = result.categories.length;
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


    useEffect(() => {
        simIndexRef.current = similarityIndex;
        setNodes((prevNodes) => {
            const mostSimilarNode = prevNodes.find(node => node.id === String(similarityIndex));
            if (!mostSimilarNode) return prevNodes;

            const circleNodes = prevNodes.filter(node => node.type === 'circle'|| node.type === 'reminderCircle');
            if (circleNodes.length === 0) return prevNodes;

            // 获取所有 circle nodes 的 id
            const circleNodeIds = new Set(circleNodes.map(node => node.id));
            console.log('most similar node parentId:', mostSimilarNode.parentId);
            if (mostSimilarNode.parentId !== currentParentId) {
                setCurrentParentId(mostSimilarNode.parentId ?? 'Group-0');
                console.log('stage changed');
                // Send update to backend only when parentId changes
                //
                fetch('http://localhost:8070/update-parent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        parentId: mostSimilarNode.parentId
                    }),
                }).catch(error => {
                    console.error('Error sending parent ID to backend:', error);
                });
            }
    
            // Update circle nodes parentId
            return prevNodes.map(node => 
                circleNodeIds.has(node.id)
                    ? { ...node, parentId: mostSimilarNode.parentId }
                    : node
            );
        });
    }, [similarityIndex]);
    const handleSimilarityUpdate = (similarityData: Array<{index: number, similarity: number}>) => {
        setSimilarityIndex(similarityData[0].index);
        // TODO: 1. record the highlighted node here in this function, record the number of tageNodes inside the highlighted node.
        // 这里可以用这些索引更新节点状态
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
                    edges={edges}
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