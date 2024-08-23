import React from 'react';

interface FloorplanListProps {
  floorplans: string[];
  onSelect: (name: string) => void;
}

const FloorplanList: React.FC<FloorplanListProps> = ({ floorplans, onSelect }) => {
  return (
    <div>
      <h2>Floorplans</h2>
      <ul>
        {floorplans.map((floorplan) => (
          <li key={floorplan} onClick={() => onSelect(floorplan)}>
            {floorplan}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FloorplanList;
