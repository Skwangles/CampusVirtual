import React, { useState } from 'react';
import './FloorList.css'; // Import your CSS file here

// Type definitions
interface FloorListProps {
  floors: string[];
}

const FloorList: React.FC<FloorListProps> = ({ floors }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);

  const handleFloorClick = (floor: string) => {
    setSelectedFloor(floor);
    setTimeout(() => setSelectedFloor(null), 3000); // Hide dialog after 3 seconds
  };

  return (
    <div>
      <button
        className="drawer-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Hide Floors' : 'Show Floors'}
      </button>

      {isOpen && (
        <div className="floor-list">
          <ul>
            {floors.map((floor, index) => (
              <li key={index} onClick={() => handleFloorClick(floor)}>
                {floor}
              </li>
            ))}
          </ul>

          {selectedFloor && (
            <div className="dialog">
              <p>You selected: {selectedFloor}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FloorList;
