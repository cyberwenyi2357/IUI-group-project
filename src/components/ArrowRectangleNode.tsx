import React from 'react';

interface ArrowRectangleNodeProps {
  data: {
    label: string;
    followUp?: string;
    color?: string;
  };
  id: string;
  position: {
    x: number;
    y: number;
  };
  parentId?: string;
  onClick?: (followUp: string, event: React.MouseEvent, nodeData: any) => void;
}
const ArrowRectangleNode = ({ data, onClick, id, position, parentId }: ArrowRectangleNodeProps) => {
  const color = data.color || '#007bff';
  const rectangleColor = color === '#007bff' ? '#ffffff' : 'black'; 
  const handleClick = (event: React.MouseEvent) => {
    if (data.followUp && onClick) {
      onClick(data.followUp, event, {
        id,
        position,
        parentId
      });
    }
  };
  return (
    <div className="arrow-rectangle-node" onClick={handleClick}>
      {/* 输出箭头 + 矩形 */}
      <div className="arrow" style={{ borderRightColor: color }}></div>
      <div className="rectangle" style={{ backgroundColor: color, color: rectangleColor }}>
        <p>{data.label}</p>
      </div>
     
    </div>
  );
};

export default ArrowRectangleNode;