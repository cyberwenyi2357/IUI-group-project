import React, { memo } from 'react';


interface NodeProps {
    id: string;
    data: {
        keywords?: string;
    }
    onClick?: (nodeId: string) => void;
}

const ReminderCircleNode: React.FC<NodeProps> = ({ id, data, onClick }) => {
    const handleClick = () => {
        onClick?.(id);
    };
    
    return (
        <>
            <div className="wrapper gradient" onClick={handleClick} style={{ cursor: 'pointer' }}>
                <div className="inner">{data.keywords}</div>
            </div>
        </>
    );
};

export default memo(ReminderCircleNode);