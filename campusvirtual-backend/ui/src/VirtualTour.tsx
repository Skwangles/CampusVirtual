import React, { useEffect, useState } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
// import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';
import CameraRotationControls from './RotationController';

interface HotspotProps {
  position: [number, number, number];
  onClick: () => void;
}

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

const Hotspot: React.FC<HotspotProps> = ({ position, onClick }) => (
  <mesh position={position} onClick={onClick}>
    <sphereGeometry args={[0.01, 10, 10]} />
    <meshBasicMaterial color="red" />
  </mesh>
);

interface SphereWithHotspotsProps {
  textureUrl: string;
  hotspots: { position: [number, number, number]; id: string; ts: string }[];
  onHotspotClick: (hotspot: { position: [number, number, number]; id: string; ts: string }) => void;
  rotation: [number, number, number]
}

const SphereWithHotspots: React.FC<SphereWithHotspotsProps> = ({ textureUrl, hotspots, onHotspotClick, rotation }) => {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  
  return (
    <group>
      <mesh rotation={rotation}>
        <sphereGeometry args={[100, 64, 64]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
      {hotspots.map((hotspot, index) => (
        <Hotspot key={index} position={hotspot.position} onClick={() => onHotspotClick(hotspot)} />
      ))}
    </group>
  );
};

const VirtualTourContent: React.FC<{ initialPointId: string, setTarget: any }> = ({ initialPointId, setTarget }) => {
  const [currentPoint, setCurrentPoint] = useState<PointData | null>(null);
  const [hotspots, setHotspots] = useState<{ position: [number, number, number]; id: string; ts: string }[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  

  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);  // New state for rotation
  const { camera } = useThree();

  useEffect(() => {
    fetchPointData(initialPointId);
  }, [initialPointId]);

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(`/point/${pointId}`);
      const pointData = pointResponse.data;

      const neighboursResponse = await axios.get<NeighbourData[]>(`/point/${pointId}/neighbours`);
      const neighboursData = neighboursResponse.data;

      setCurrentPoint(pointData);
      setCurrentImage("/image/" + pointData.ts);
      

      setHotspots(neighboursData.map(neighbour => ({
        position: calculatePositionFromMatrix(neighbour.pose),
        id: neighbour.keyframe_id,
        ts: neighbour.ts,
      })));

      const newPosition = calculatePositionFromMatrix(pointData.pose);
      camera.position.set(newPosition[0], newPosition[1], newPosition[2]);
      setTarget(new THREE.Vector3(newPosition[0], newPosition[1], newPosition[2] + 0.001))

      const newRotation = calculateRotationFromMatrix(pointData.pose);  // Calculate rotation
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
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(m);
    return [position.x, position.y, position.z];
  };

  const calculateRotationFromMatrix = (matrix: number[]): [number, number, number] => {
    const m = new THREE.Matrix4();
    //@ts-ignore
    m.set(...matrix);
    const rotation = new THREE.Euler().setFromRotationMatrix(m);
    rotation.y += Math.PI / 2;  // Adjust rotation
    return [rotation.x, rotation.y, rotation.z];
  };

  const handleHotspotClick = (hotspot: { position: [number, number, number]; id: string; ts: string }) => {
    fetchPointData(hotspot.id);
  };

  return currentImage ? (
    <SphereWithHotspots textureUrl={currentImage} hotspots={hotspots} onHotspotClick={handleHotspotClick} rotation={rotation} />
  ) : null;
};

const VirtualTour: React.FC = () => {
  const [_, setTarget] = useState<THREE.Vector3>(new THREE.Vector3());
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
    <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
      <gridHelper args={[200, 50]} />
      {/* <ambientLight intensity={0.5} /> */}
      <CameraRotationControls />
      <VirtualTourContent initialPointId="2" setTarget={setTarget}/>
    </Canvas>
    </div>
  );
};

export default VirtualTour;
