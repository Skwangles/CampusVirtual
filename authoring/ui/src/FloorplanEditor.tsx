import React, { useState, useEffect, useCallback} from 'react';
import axios from 'axios';
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva';

interface Node {
  id: string
  x: number;
  y: number;
  type: number
}

interface Edge{
  id0: string,
  id1: string
}

interface FloorplanEditorProps {
  floorplan: string;
}

const FloorplanEditor: React.FC<FloorplanEditorProps> = ({ floorplan }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(800);
  const [stageHeight, setStageHeight] = useState< number>(800);


  useEffect(() => {
    const fetchFloorplanData = async () => {
      try {
        const response = await axios.get<{image: string, edges: Array<{keyframe_id0: number, keyframe_id1: number}>, nodes: Array<{x: number, y: number, keyframe_id: number, type: number}>}>(`/api/floorplans/${floorplan}`);

        const img = new Image();
        img.src = response.data.image;
        img.onload = () => {
          setImage(img);
          setStageWidth(img.width)
          setStageHeight(img.height)
        }
        setEdges(response.data.edges.map(edge => ({id0: String(edge.keyframe_id0), id1: String(edge.keyframe_id1)})))
        setNodes(response.data.nodes.map(node => ({id: String(node.keyframe_id), ...node})));
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
      const x = (e.target.x() / e.target.getStage().width());
      const y = (e.target.y() / e.target.getStage().height());
      handleDragEnd(id, x, y);
    },
    [handleDragEnd]
  );

  const getNodeCoords = (id: string) => {
    const node = nodes.find(node => node.id === id);
    return node ? {x: node.x * stageWidth, y: node.y * stageHeight} : {x: -1, y:-1}
  }

  return (
    <>

    <div style={{border: "solid 1px"}}>
    <Stage width={stageWidth} height={stageHeight}>
      <Layer>
        {image && (
          <KonvaImage
            image={image}
            width={stageWidth}
            height={stageHeight}
          />
        )}
        {edges.map((edge, index) => {
           const { x: x1, y: y1 } = getNodeCoords(edge.id0);
           const { x: x2, y: y2 } = getNodeCoords(edge.id1);
           console.log(x1, y1, x2, y2)
 
           return (
             <Line
               key={index}
               points={[x1, y1, x2, y2]}
               stroke="black"
               strokeWidth={2}
               lineCap="round"
               lineJoin="round"
             />
           );
        })}
        {nodes.map((node) => (
          <Circle
            key={node.id}
            x={node.x * stageWidth}
            y={node.y * stageHeight}
            radius={5}
            fill="red"
            name={node.id}
            draggable
            onDragMove={handleDragMove}
          />
        ))}
      </Layer>
    </Stage>
    </div>
    </>
  );
};

export default FloorplanEditor;
