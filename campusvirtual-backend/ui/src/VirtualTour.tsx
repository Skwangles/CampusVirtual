import React, { useEffect, useState } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
// import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';
import CameraRotationControls from './RotationController';
const GLOBAL_SCALE = 50

interface HotspotProps {
  position: [number, number, number];
  rotation: [number, number, number];
  image_identifier: string;
  onClick: () => void;
}

interface HotspotObj {   pose: THREE.Matrix4; position: [number, number, number]; rotation: [number, number, number]; id: string; ts: string }

interface PointData {
  pose: number[];
  ts: string;
  keyframe_id: number;
  location: string;
}

interface NeighbourData {
  pose: number[];
  ts: string;
  keyframe_id: string;
  is_direct: boolean;
}



const Hotspot: React.FC<HotspotProps> = ({ position, onClick, rotation }) => {
  // const texture = useLoader(THREE.TextureLoader, "/image/lores/" + image_identifier);
  const dropHotspotsBelowEyeLevelOffset = 0.2;
  position[1] -= GLOBAL_SCALE * dropHotspotsBelowEyeLevelOffset
return (
  <mesh position={position} rotation={rotation} onClick={onClick} receiveShadow>
    <sphereGeometry args={[0.5, 10, 10]} />
    <meshStandardMaterial color={"blue"} opacity={0.95} transparent/> // wireframe wireframeLinewidth={0.5}
  </mesh>);
}

interface SphereWithHotspotsProps {
  position: THREE.Vector3;
  textureUrl: string;
  hotspots: HotspotObj[];
  onHotspotClick: (hotspot: HotspotObj) => void;
  rotation: [number, number, number]
}

const SphereWithHotspots: React.FC<SphereWithHotspotsProps> = ({ position, textureUrl, hotspots, onHotspotClick, rotation }) => {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  rotation[1] += Math.PI /2;
  return ( 
    <group>
      <mesh rotation={rotation} position={position} scale={[-1, 1, 1]}> 
        <sphereGeometry args={[100, 64, 64]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
      {hotspots.map((hotspot, index) => (
        <Hotspot key={index} position={hotspot.position} rotation={hotspot.rotation} image_identifier={Number(hotspot.ts).toFixed(5)} onClick={() => onHotspotClick(hotspot)} />
      ))}
    </group>
  );
};

const VirtualTourContent: React.FC<{ currentId:any, setCurrentId:any, currentPoint: any, setCurrentPoint: any }> = ({ currentId, setCurrentId, currentPoint, setCurrentPoint }) => {
  
  const [hotspots, setHotspots] = useState<HotspotObj[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(new THREE.Vector3())
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);  
  
  const { camera } = useThree();

  useEffect(() => {
    fetchPointData(currentId);
  }, [currentId]);

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(`/point/${pointId}`);
      const pointData = pointResponse.data;

      const neighboursResponse = await axios.get<NeighbourData[]>(`/point/${pointId}/neighbours/5`);
      const neighboursData = neighboursResponse.data;

      setCurrentPoint(pointData);
      setCurrentImage("/image/hires/" + Number(pointData.ts).toFixed(5));
      

      setHotspots(neighboursData.map(neighbour =>{


        const pos = calculatePositionFromMatrix(neighbour.pose)
        const m = new THREE.Matrix4()

        //@ts-ignore
        m.set(...neighbour.pose)

        return ({
        position: pos,
        rotation: [0, getYRotation(neighbour.pose), 0],
        pose: m,
        id: neighbour.keyframe_id,
        ts: neighbour.ts,
      })
    
    }));

      const newPosition = calculatePositionFromMatrix(pointData.pose);
      setCurrentPosition(new THREE.Vector3(...newPosition));
      camera.position.set(newPosition[0], newPosition[1], newPosition[2]);
      // setTarget(new THREE.Vector3(newPosition[0], newPosition[1], newPosition[2] + 0.001))

      const newRotation = -getYRotation(pointData.pose);  // Calculate rotation
      setRotation([0, newRotation, 0]);

      console.log(currentPoint, newRotation, newPosition)
    } catch (error) {
      console.error("Error fetching point data:", error);
    }
  };

  const calculatePositionFromMatrix = (matrix: number[]): [number, number, number] => {
    const m = new THREE.Matrix4();
    //@ts-ignore
    m.set(...matrix);
    m.invert();
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(m);
    return [-position.x * GLOBAL_SCALE, -position.y * GLOBAL_SCALE, position.z * GLOBAL_SCALE];
  };

  function getYRotation(matrix) {
    // Ensure the matrix is 4x4
    if (matrix.length !== 16) {
        throw new Error("Invalid matrix size. Expected a 4x4 matrix.");
    }

    // Extract the relevant elements
    const m11 = matrix[0];
    const m31 = matrix[8];

    // Calculate the rotation angle around the Y-axis
    const rotationY = Math.atan2(m31, m11);

    return rotationY; // Rotation in radians
}

  const handleHotspotClick = (hotspot: HotspotObj) => {
    setCurrentId(hotspot.id);
    // fetchPointData(hotspot.id);
  };

  return currentImage ? (
    <SphereWithHotspots position={currentPosition} textureUrl={currentImage} hotspots={hotspots} onHotspotClick={handleHotspotClick} rotation={rotation} />
  ) : null;
};

const VirtualTour: React.FC = () => {
  const [currentId, setCurrentId] = useState<string>("270");
  const [currentPoint, setCurrentPoint] = useState<PointData>({pose: [], ts:"", keyframe_id:300, location: "" });
  const [camRotation, setCameraRotation] = useState<number>(0);
  // New state for rotation
  
  let params = new URLSearchParams(window.location.search)


  useEffect(() => {
    if (params.has("id")){
      setCurrentId(params.get("id") ?? "0");
    }
    
    if (params.has("rot")){
      setCameraRotation(Number(params.get("rot")?? 0))
    }

  }, []);


  useEffect(() =>{
    params.set("id", currentId)
    params.set("rot", camRotation.toFixed(4))
    history.pushState({}, "", "?" + params.toString())
  }, [currentId])

  window.onpopstate = e =>{
    console.log(window.history.length)

    params = new URLSearchParams(window.location.search)
    if (params.has("id")){
      setCurrentId(params.get("id") ?? "0");
    }
    
    if (params.has("rot")){
      setCameraRotation(Number(params.get("rot")?? 0))
    }

  }

  return (
    <>
    <div style={{position: "fixed", bottom: 0, left: 0, background: "black", opacity: 0.6, zIndex: 99 }}>Location: {currentPoint?.location}</div>
    <div style={{ width: "100vw", height: "100vh" }}>
    <Canvas camera={{ position: [0, 0, 10], fov: 75}} shadows>
    <ambientLight
        intensity={0.6}
      />
      <directionalLight
        castShadow
      />
      <CameraRotationControls initialRot={camRotation} setCameraRotation={setCameraRotation} />
      <VirtualTourContent currentId={currentId} setCurrentId={setCurrentId} currentPoint={currentPoint} setCurrentPoint={setCurrentPoint} />
    </Canvas>
    </div>
    </>
  );
};

export default VirtualTour;
