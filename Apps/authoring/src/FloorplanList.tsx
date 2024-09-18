import React from 'react';

interface FloorplanListProps {
  floorplans: string[];
  onSelect: (name: string) => void;
}

const FloorplanList: React.FC<FloorplanListProps> = ({ floorplans, onSelect }) => {
  floorplans = floorplans.sort()
  return (
    <div style={{border: "solid 2px", height: "100vh", marginRight: "10px", padding: "2px", borderRadius: "5px"}}>
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
