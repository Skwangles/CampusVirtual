import React, { useEffect, useState } from 'react';
import './FloorList.css'; // Import your CSS file here

// Type definitions
interface FloorListProps {
  floors: string[];
    setManualFloorSelect: any;
}

const FloorList: React.FC<FloorListProps> = ({ floors, setManualFloorSelect }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<string>("");

  const handleFloorClick = (floor: string) => {
    setSelectedFloor(floor);
    // setTimeout(() => setSelectedFloor(""), 3000); // Hide dialog after 3 seconds
  };

  useEffect(() => {
    setManualFloorSelect(selectedFloor)
  }, [selectedFloor])

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
        </div>
      )}
    </div>
  );
};

export default FloorList;
