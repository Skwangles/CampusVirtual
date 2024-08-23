import React, { useState, useEffect, useCallback} from 'react';
import axios from 'axios';
import { Stage, Layer, Image as KonvaImage, Circle } from 'react-konva';

interface Node {
  id: string;
  x: number;
  y: number;
}

interface FloorplanEditorProps {
  floorplan: string;
}

const FloorplanEditor: React.FC<FloorplanEditorProps> = ({ floorplan }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const fetchFloorplanData = async () => {
      try {
        const response = await axios.get(`/api/floorplans/${floorplan}`);

        const img = new Image();
        img.src = response.data.image;
        img.onload = () => setImage(img);
        setNodes(response.data.nodes);
      } catch (error) {
        console.error('Error fetching floorplan data:', error);
      }
    };

    fetchFloorplanData();
  }, [floorplan]);

  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === id ? { ...node, x, y } : node
        )
      );
      axios.post(`/api/floorplans/${floorplan}/update`, { id, x, y });
    },
    [floorplan]
  );

  const handleDragMove = useCallback(
    (e: any) => {
      const id = e.target.name();
      const x = (e.target.x() / e.target.getStage().width()) * 100;
      const y = (e.target.y() / e.target.getStage().height()) * 100;
      handleDragEnd(id, x, y);
    },
    [handleDragEnd]
  );

  return (
    <Stage width={800} height={600}>
      <Layer>
        {image && (
          <KonvaImage
            image={image}
            width={800}
            height={600}
            offsetX={400}
            offsetY={300}
          />
        )}
        {nodes.map((node) => (
          <Circle
            key={node.id}
            x={node.x * 8}
            y={node.y * 6}
            radius={20}
            fill="red"
            name={node.id}
            draggable
            onDragMove={handleDragMove}
          />
        ))}
      </Layer>
    </Stage>
  );
};

export default FloorplanEditor;
