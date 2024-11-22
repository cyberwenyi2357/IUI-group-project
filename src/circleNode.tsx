import React, { memo } from 'react';
import { Handle, useStore, Position } from '@xyflow/react';

interface NodeProps {
    id: string;
    data: {
        keywords?: string;
    }
}

const NodeComponent: React.FC<NodeProps> = ({ id ,data}) => {
    const label = useStore((s) => {
        const node = s.nodeLookup.get(id);

        if (!node) {
            return null;
        }

    });

    return (
        <>
            <div  className="wrapper gradient">
                <div className="inner">{data.keywords}</div>
            </div>
        </>
    );
};

export default memo(NodeComponent);
