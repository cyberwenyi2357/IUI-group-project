import {NodeProps} from "@xyflow/react";

export default function GroupNode({ id, data }: NodeProps) {
    return (
        <div style={{ fontWeight: 'bold' }}>{String(data.label)}</div>
    )
}