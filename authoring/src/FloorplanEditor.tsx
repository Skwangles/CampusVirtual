import React, { useState, useEffect} from 'react';
import axios from 'axios';
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva';
import FileUpload from './FileUpload'
import PointControls from './PointControls'
import { API_PREFIX } from './consts';
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
  const [hasImage, setHasImage] = useState<boolean>(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(800);
  const [stageHeight, setStageHeight] = useState< number>(800);
  const [selectedPoint, setSelectedPoint] = useState<Node|null>(null); 

  const fetchFloorplanData = async () => {
    try {
      const response = await axios.get<{has_image: boolean, image: string, edges: Array<{keyframe_id0: number, keyframe_id1: number}>, nodes: Array<{x: number, y: number, keyframe_id: number, type: number}>}>(`${API_PREFIX}/api/floorplans/${floorplan}`);
      console.log(response.data)
      const img = new Image();
      img.src = `${API_PREFIX}/api/floorplans/${floorplan}/image`;
      setHasImage(Boolean(response.data.has_image == true))
      img.onload = () => {
        setImage(img);
        setStageWidth(img.width)
        setStageHeight(img.height)
      }
      setEdges(response.data.edges.map((edge) => ({id0: String(edge.keyframe_id0), id1: String(edge.keyframe_id1)})))
      setNodes(response.data.nodes.map((node) => ({id: String(node.keyframe_id), ...node})));
    } catch (error) {
      console.error('Error fetching floorplan data:', error);
    }
  };


  useEffect(() => {
    fetchFloorplanData();
  }, [floorplan]);

  const handleDragEnd = (id: string, x: number, y: number) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === id ? { ...node, x, y } : node
        )
      );
      
    }


  const handleDragMove = (e: any) => {
      const id = e.target.name();
      
      const x = (e.target.x() / e.target.getStage().width());
      const y = (e.target.y() / e.target.getStage().height());
      handleDragEnd(id, x, y);
  }

  const handleMouseDown = (e: any) =>{
      const id = e.target.name();
      const foundNode = nodes.find(node => String(node.id) === String(id))
      if (foundNode){
        setSelectedPoint(foundNode);
      }

  }

  const handleMouseUp = (e: any) =>{
    const id = e.target.name();
    const x = (e.target.x() / e.target.getStage().width());
    const y = (e.target.y() / e.target.getStage().height());
    axios.post(`${API_PREFIX}/api/floorplans/${floorplan}/update`, { id, x, y  });
  }

  const padCordAwayFromEdge = (val:number) => {
    const padding = 0.01
      return Math.max(0 + padding, Math.min(1 - padding, val))
  }

  const getNodeCoords = (id: string) => {
    const node = nodes.find(node => node.id === id);
    if (!node) throw Error("Couldn't find node: " + id)
    return {x: padCordAwayFromEdge(node.x) * stageWidth, y: padCordAwayFromEdge(node.y) * stageHeight} 
  }

  return (
    <>
    <div >

    <FileUpload currentFloor={floorplan} isImageSelected={hasImage} />
    <div style={{border: "solid 1px", borderRadius: "5px"}}>
    
        {hasImage && (
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
            x={padCordAwayFromEdge(node.x) * stageWidth}
            y={padCordAwayFromEdge(node.y) * stageHeight}
            radius={5}
            fill={node.type < 50 ?  "red" : "blue"}
            name={node.id}
            draggable
            
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}

            onDragMove={handleDragMove}
            onTouchMove={handleDragMove}
          />
        ))}
        </>)}
      </Layer>
    </Stage>)}
    
    </div>
    </div>
    <div>
    <PointControls id={selectedPoint?.id} point={selectedPoint} reloadPoints={()=>{ console.log("Reloading points"); fetchFloorplanData();}} />
</div>
    </>
  );
};

export default FloorplanEditor;
