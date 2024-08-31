import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva';
import FileUpload from './FileUpload';
import PointControls from './PointControls';
import { API_PREFIX } from './consts';
import { findPathWithDijkstra } from './pathfinding';

interface Node {
  id: string;
  x: number;
  y: number;
  type: number;
}

interface Edge {
  id0: string;
  id1: string;
}

interface FloorplanEditorProps {
  floorplan: string;
}

const FloorplanEditor: React.FC<FloorplanEditorProps> = ({ floorplan }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hasImage, setHasImage] = useState<boolean>(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(800);
  const [stageHeight, setStageHeight] = useState<number>(800);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [lastSelectedPoint, setLastSelectedPoint] = useState<Node | null>(null);

  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number}| null>(null)


  const fetchFloorplanData = async () => {
    try {
      const response = await axios.get<{
        has_image: boolean;
        image: string;
        edges: Array<{ keyframe_id0: number; keyframe_id1: number }>;
        nodes: Array<{ x: number; y: number; keyframe_id: number; type: number }>;
      }>(`${API_PREFIX}/api/floorplans/${floorplan}`);
      console.log(response.data);
      const img = new Image();
      img.src = `${API_PREFIX}/api/floorplans/${floorplan}/image`;
      setHasImage(Boolean(response.data.has_image));
      img.onload = () => {
        setImage(img);
        setStageWidth(img.width);
        setStageHeight(img.height);
      };
      setEdges(
        response.data.edges.map((edge) => ({
          id0: String(edge.keyframe_id0),
          id1: String(edge.keyframe_id1),
        }))
      );
      setNodes(
        response.data.nodes.map((node) => ({
          id: String(node.keyframe_id),
          ...node,
        }))
      );
    } catch (error) {
      console.error('Error fetching floorplan data:', error);
    }
  };

  useEffect(() => {
    setSelectedPoints(new Set())
    fetchFloorplanData();
  }, [floorplan]);

  const handleDragStart = (e: any) => {
    const { x, y } = e.target.position();
    setDragStartPos({ x, y });
  };


  const handleDragMove = (e: any) => {
    console.log(dragStartPos)
    if (!dragStartPos) return;


    const { x: x, y: y } = e.target.position();
    const dx = x - dragStartPos.x;
    const dy = y - dragStartPos.y;

    const width = e.target.getStage().width();
    const height = e.target.getStage().height();

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (selectedPoints.has(node.id) && node.id != e.target.name()) {
          const newX = clamp(node.x + (dx / width), 0, 1);
          const newY = clamp(node.y + (dy / height), 0, 1);
          return { ...node, x: newX, y: newY };
        }
        else if (node.id == e.target.name()){
          return {...node, x: x / width, y: y / height}
        }
        return node;
      })
    );

    setDragStartPos({x, y})
  };

  const handleMouseDown = (e: any) => {
    const id = e.target.name();
    const foundNode = nodes.find((node) => String(node.id) === String(id));
    const isCtrlPressed = e.evt.ctrlKey;
    const isShiftPressed = e.evt.shiftKey;

    if (isCtrlPressed) {
      setSelectedPoints((prev) => {
        const newSelected = prev;
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return newSelected;
      });
    } else if (isShiftPressed && lastSelectedPoint) {
      const method = 1; // Change to vary dijkstra method - only 1 currently implemented 

      const selectedIds = findPathWithDijkstra(nodes, edges, lastSelectedPoint.id, id, method, true);
      setSelectedPoints(prev => {
        for (const id of selectedIds){
          prev.add(id)
        }
        return prev
      });
    } else {
      if (selectedPoints.size <= 1){
      setSelectedPoints(new Set([id]));
      }
      else{
        setSelectedPoints(prev => prev.add(id))
      }
    }
  
    setLastSelectedPoint(foundNode || null);
  };
  

  const handleMouseUp = (e: any) => {
    const x = e.target.x() / e.target.getStage().width();
    const y = e.target.y() / e.target.getStage().height();

    console.log("Finish pos:", x, y) 
    setDragStartPos(null)
    for (const node of nodes.filter(node => selectedPoints.has(node.id))){
        axios.post(`${API_PREFIX}/api/floorplans/${floorplan}/update`, { id: node.id, x: node.x, y: node.y });
    }
  };

  const padCordAwayFromEdge = (val: number) => {
    const padding = 0.01;
    return clamp(val, 0 + padding, 1 - padding)
  };

  const clamp = (value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  };

  const getNodeCoords = (id: string) => {
    const node = nodes.find((node) => node.id === id);
    if (!node) throw Error("Couldn't find node: " + id);
    return {
      x: padCordAwayFromEdge(node.x) * stageWidth,
      y: padCordAwayFromEdge(node.y) * stageHeight,
    };
  };

  return (
    <>
      <div>
        <FileUpload currentFloor={floorplan} isImageSelected={hasImage} />
        <div style={{ border: 'solid 1px', borderRadius: '5px' }}>
          {hasImage && (
            <Stage
              width={stageWidth}
              height={stageHeight}
              // draggable
              // onDragMove={handleDragMove}
              // onDragEnd={handleDragEnd}
            >
              <Layer>
                {image && (
                  <>
                    <KonvaImage image={image} width={stageWidth} height={stageHeight} onMouseDown={() => setSelectedPoints(new Set())} />
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
                        fill={selectedPoints.has(node.id) ? 'green' : node.type < 50 ? 'red' : 'blue'}
                        name={node.id}
                        draggable
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onTouchEnd={handleMouseUp}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        // onDragEnd={handleDragEnd}
                      />
                    ))}
                  </>
                )}
              </Layer>
            </Stage>
          )}
        </div>
      </div>
      <div>
        <PointControls
          id={lastSelectedPoint?.id}
          point={lastSelectedPoint}
          reloadPoints={() => {
            console.log('Reloading points');
            fetchFloorplanData();
          }}
        />
      </div>
    </>
  );
};

export default FloorplanEditor;
