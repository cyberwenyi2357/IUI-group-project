import React, { memo } from 'react';
import { useStore } from '@xyflow/react';
interface NodeProps {
    id: string;
    data: {
        keywords?: string;
    }
    onClick?: (nodeId: string) => void;
}

const NodeComponent: React.FC<NodeProps> = ({ id ,data,onClick}) => {
    const label = useStore((s) => {
        const node = s.nodeLookup.get(id);

        if (!node) {
            return null;
        }

    });
    const handleClick = () => {
        onClick?.(id);  // 调用父组件传递的处理函数
    };
    return (
        <>
            <div  className="wrapper gradient" onClick={handleClick} style={{ cursor: 'pointer' }}>
                <div className="inner">{data.keywords}</div>
            </div>
        </>
    );
};

export default memo(NodeComponent);
