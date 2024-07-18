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
  onClick: () => void;
}

interface HotspotObj {   pose: THREE.Matrix4; position: [number, number, number]; rotation: [number, number, number]; id: string; ts: string }

interface PointData {
  pose: number[];
  ts: string,
  keyframe_id: number
}

interface NeighbourData {
  pose: number[];
  ts: string;
  keyframe_id: string;
  is_direct: boolean;
}

const Hotspot: React.FC<HotspotProps> = ({ position, onClick, rotation }) => (
  <mesh position={position} rotation={rotation} onClick={onClick}>
    <sphereGeometry args={[0.5, 10, 10]} />
    <meshBasicMaterial wireframe wireframeLinewidth={0.5} color={"blue"} />
  </mesh>
);

interface SphereWithHotspotsProps {
  position: THREE.Vector3;
  textureUrl: string;
  hotspots: HotspotObj[];
  onHotspotClick: (hotspot: HotspotObj) => void;
  rotation: [number, number, number]
}

const SphereWithHotspots: React.FC<SphereWithHotspotsProps> = ({ position, textureUrl, hotspots, onHotspotClick, rotation }) => {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  // texture.flipY = true;
  
  return ( 
    <group>
      <mesh rotation={rotation} position={position}> // scale={[-1, 1, 1]}
        <sphereGeometry args={[100, 64, 64]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
      {hotspots.map((hotspot, index) => (
        <Hotspot key={index} position={hotspot.position} rotation={hotspot.rotation} onClick={() => onHotspotClick(hotspot)} />
      ))}
    </group>
  );
};

const VirtualTourContent: React.FC<{ initialPointId: string }> = ({ initialPointId }) => {
  const [currentPoint, setCurrentPoint] = useState<PointData | null>(null);
  const [hotspots, setHotspots] = useState<HotspotObj[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(new THREE.Vector3())
  

  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);  // New state for rotation
  const { camera } = useThree();

  useEffect(() => {
    fetchPointData(initialPointId);
  }, [initialPointId]);

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(`/point/${pointId}`);
      const pointData = pointResponse.data;

      const neighboursResponse = await axios.get<NeighbourData[]>(`/point/${pointId}/neighbours/5`);
      const neighboursData = neighboursResponse.data;

      setCurrentPoint(pointData);
      setCurrentImage("/image/" + pointData.ts);
      

      setHotspots(neighboursData.map(neighbour =>{


        const pos = calculatePositionFromMatrix(neighbour.pose)
        const scaled_pos: [number, number, number] = [pos[0], pos[1], pos[2]]

        const m = new THREE.Matrix4()

        //@ts-ignore
        m.set(...neighbour.pose)

        return ({
        position: scaled_pos,
        rotation: calculateYRotationFromMatrix(neighbour.pose),
        pose: m,
        id: neighbour.keyframe_id,
        ts: neighbour.ts,
      })
    
    }));

      const newPosition = calculatePositionFromMatrix(pointData.pose);
      setCurrentPosition(new THREE.Vector3(...newPosition));
      camera.position.set(newPosition[0], newPosition[1], newPosition[2]);
      // setTarget(new THREE.Vector3(newPosition[0], newPosition[1], newPosition[2] + 0.001))

      const newRotation = calculateYRotationFromMatrix(pointData.pose);  // Calculate rotation
      setRotation(newRotation);

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
    return [position.x * GLOBAL_SCALE, -position.y * GLOBAL_SCALE, position.z * GLOBAL_SCALE];
  };

  const calculateYRotationFromMatrix = (matrix: number[]): [number, number, number] => {
    const m = new THREE.Matrix4();
    //@ts-ignore
    m.set(...matrix);

    const rotation = new THREE.Euler().setFromRotationMatrix(m);
    return [0, rotation.y, 0];
  };

  const handleHotspotClick = (hotspot: HotspotObj) => {
    fetchPointData(hotspot.id);
  };

  return currentImage ? (
    <SphereWithHotspots position={currentPosition} textureUrl={currentImage} hotspots={hotspots} onHotspotClick={handleHotspotClick} rotation={rotation} />
  ) : null;
};

const VirtualTour: React.FC = () => {
  return (
    <div style={{ left:"0px", top: "0px", width: "100vw", height: "100vh" }}>
    <Canvas camera={{ position: [0, 0, 10], fov: 110 }}>
      <gridHelper args={[200, 50]} />
      <ambientLight intensity={0.5} />
      <CameraRotationControls />
      <VirtualTourContent initialPointId="1"/>
    </Canvas>
    </div>
  );
};

export default VirtualTour;
