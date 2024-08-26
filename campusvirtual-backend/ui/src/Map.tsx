import React, { useEffect, useState } from 'react';
import {Stage, Image as KonvaImage, Line, Circle, Layer} from 'react-konva'
import {API_PREFIX} from './consts'
import './Map.css';
import axios from 'axios';
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


interface MinimapProps {
  floorName: string,
  setID: any
}

const Map: React.FC<MinimapProps> = ({ floorName, setID }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(800);
  const [stageHeight, setStageHeight] = useState< number>(800);


  
  useEffect(() => {
    const fetchFloorplanData = async () => {
      try {
        const response = await axios.get<{image: string, edges: Array<{keyframe_id0: number, keyframe_id1: number}>, nodes: Array<{x: number, y: number, keyframe_id: number, type: number}>}>(`${API_PREFIX}/api/floorplans/${floorName}`);
        console.log(response.data)
        const img = new Image();
        img.src = response.data.image;
        setImagePath(response.data.image)
        img.onload = () => {
          setImage(img);
          setStageWidth(img.width/2)
          setStageHeight(img.height/2)
        }
        setEdges(response.data.edges.map(edge => ({id0: String(edge.keyframe_id0), id1: String(edge.keyframe_id1)})))
        setNodes(response.data.nodes.map(node => ({id: String(node.keyframe_id), ...node})));
      } catch (error) {
        console.error('Error fetching floorplan data:', error);
      }
    };

    fetchFloorplanData();
  }, [floorName]);


  const getNodeCoords = (id: string) => {
    const node = nodes.find(node => node.id === id);
    if (!node) throw Error("Couldn't find node: " + id)
    return {x: node.x * stageWidth, y: node.y * stageHeight} 
  }
  

  const handleMouseUp = (e: any) =>{
    const id = e.target.name();
    if (isNaN(Number(id))) return;
    setID(id);
  }

return (
  <div style={{zIndex: 999, position: 'fixed', left: 0, top: 0, backgroundColor: "lightgray"}}>
  {imagePath && imagePath != '' && (
    <Stage width={stageWidth} height={stageHeight}>
      <Layer>
        {image && (<>
          <KonvaImage
            image={image}
            width={stageWidth}
            height={stageHeight}
          />
        
        {edges.map((edge, index) => {
           const { x: x1, y: y1 } = getNodeCoords(edge.id0);
           const { x: x2, y: y2 } = getNodeCoords(edge.id1);
 
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
            fill={node.type < 50 ?  "red" : "blue"}
            name={node.id}
            onMouseUp={handleMouseUp}
          />
        ))}
        </>)}
      </Layer>
    </Stage>)}
  </div>
)
};

export default Map;