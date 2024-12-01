import {NodeProps} from "@xyflow/react";

export default function GroupNode({ id, data }: NodeProps) {
    return (
        <div>{data.label}</div>
    )
}