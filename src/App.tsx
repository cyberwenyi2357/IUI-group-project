import {useState, useCallback, useEffect} from 'react';
import startInterview from "./startInterview.tsx";
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

import './index.css'
import StartInterview from "./startInterview.tsx";
let microphone;
let rt;
function EditableNode({ id, data }: NodeProps) {
    const [label, setLabel] = useState(data.label);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLabel(event.target.value);
    };

    return (
        <div style={{ padding: 10, border: '1px solid #000',backgroundColor: '#ffffff', borderRadius: 2 }}>
            <input
                type="text"
                value={label}
                onChange={handleChange}
                style={{ width: '100%', border: 'none', textAlign: 'center' }}
            />
        </div>
    );
}


const nodeTypes = { editable: EditableNode };

function App() {
    const initialNodes: Node[] = [
        { id: '1', position: { x: 10, y: 20 }, data: { label: '1' }, type: 'editable' },
        // { id: '2', position: { x: 100, y: 200 }, data: { label: '2' }, type: 'editable' }
    ];
    const initialEdges: Edge[] = [];
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);


    const onNodeDragStop = useCallback((_, node) => {
        setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
        );
    }, [setNodes]);
// Effect to update button position to the position of the last node in the list
    const handleAddQuestion = () => {
        if (nodes.length > 0) {
            // Get the last node
            const lastNode = nodes[nodes.length - 1];

            // Calculate new node's id and position
            const newId = String(Number(lastNode.id) + 1); // New id as last node's id + 1
            const newPosition = { x: lastNode.position.x, y: lastNode.position.y + 60 }; // New position below the last node

            // Create the new node
            const newNode: Node = {
                id: newId,
                position: newPosition,
                data: { label: newId },
                type: 'editable',
            };

            // Add the new node to the current list of nodes
            setNodes((nds) => [...nds, newNode]);
        }
    };

    return (
        <div style={{ height: '95vh', width: '100vw'}}>
<StartInterview/>
            <button style={{position:'absolute',left:'3vw',top:'1vw',zIndex:2}} onClick={handleAddQuestion}>Add question</button>
            <ReactFlowProvider>
                <ReactFlow
                    nodes={nodes}
                    edges={initialEdges}
                    onNodesChange={onNodesChange}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    className="intersection-flow"
                    minZoom={0.2}
                    maxZoom={4}
                    fitView
                >
                    <MiniMap zoomable pannable nodeClassName={'intersection-flow'} />
                    <Background />
                    <Controls />
                </ReactFlow>
            </ReactFlowProvider>
        </div>
    );
}

export default App;