import React, { useState } from 'react';
import './StatsForNerds.css'
// Type definitions
interface StatsForNerdsProps {
  point: {keyframe_id: number, location: string, ts: string}
}

const StatsForNerds: React.FC<StatsForNerdsProps> = ({ point }) => {
  const [isOpen, setIsOpen] = useState(true);
  console.log(point)
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
            <li>Point ID: {point.keyframe_id}</li>
          <li>Location: {point.location}</li>
          <li>Image Identifier: {Number(point.ts).toFixed(5)}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default StatsForNerds;
