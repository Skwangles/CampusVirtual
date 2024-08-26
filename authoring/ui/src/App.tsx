import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FloorplanList from './FloorplanList';
import FloorplanEditor from './FloorplanEditor';
import { API_PREFIX } from './consts';

const App: React.FC = () => {
  const [floorplans, setFloorplans] = useState<string[]>([]);
  const [selectedFloorplan, setSelectedFloorplan] = useState<string | null>(null);

  useEffect(() => {
    const fetchFloorplans = async () => {
      try {
        const response = await axios.get(`${API_PREFIX}/api/floorplans`);
        setFloorplans(response.data);
      } catch (error) {
        console.error('Error fetching floorplans:', error);
      }
    };

    fetchFloorplans();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: "space-between"}}>
      <FloorplanList floorplans={floorplans} onSelect={setSelectedFloorplan} />
      {selectedFloorplan && <FloorplanEditor floorplan={selectedFloorplan} />}
    </div>
  );
};

export default App;
