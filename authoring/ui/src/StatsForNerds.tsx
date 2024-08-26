import React, { useState } from 'react';
import './StatsForNerds.css'
// Type definitions
interface StatsForNerdsProps {
  selectedPoint: {id: string, x: number, y:number, type: number} | null
}

const StatsForNerds: React.FC<StatsForNerdsProps> = ({ selectedPoint: point }) => {
  console.debug("Point:", point)
  if (!point) return (<></>)

  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className='stats-container'>
      <button
        className="stat-drawer-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Hide Stats' : 'Stats'}
      </button>

      {isOpen && (
        <div className="stats">
          <ul>
            <li>Point ID: {point.id}</li>
          <li>X: {point.x * 100}%</li>
          <li>Y: {point.y * 100}%</li>
          <li>Type: {point.type}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default StatsForNerds;
