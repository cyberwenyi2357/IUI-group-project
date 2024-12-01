import React from 'react';
import { Handle,Position } from '@xyflow/react';
import '../style/arrowRectangleNode.css'; // 用于样式

const ArrowRectangleNode = ({ data }) => {
  return (
    <div className="arrow-rectangle-node">
      {/* 输出箭头 + 矩形 */}
      <div className="arrow"></div>
      <div className="rectangle">
        <p>{data.label}</p>
      </div>

      {/* Handles 用于连接其他节点 */}
     
    </div>
  );
};

export default ArrowRectangleNode;