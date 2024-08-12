import React, {useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
// import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';
import CameraRotationControls from './RotationController';
import Map from './Map';

const GLOBAL_SCALE = 40
const showMap = false;
const API_PREFIX = ""; // Use to specify API server different to frontend e.g. localhost:3001

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



const Hotspot: React.FC<HotspotProps> = ({ position, onClick, rotation, image_identifier}) => {
  // const [texture, setTexture] = useState(new THREE.Texture())

  // useEffect(() => {
  //   setTexture(new THREE.TextureLoader().load(`${API_PREFIX}/image/thumbnail/${image_identifier}`));
  // }, [image_identifier])

  const dropHotspotsBelowEyeLevelOffset = 0.3;
  position[1] -= GLOBAL_SCALE * dropHotspotsBelowEyeLevelOffset
  return (
    <mesh position={position} rotation={rotation} onClick={onClick} receiveShadow>
      <sphereGeometry args={[0.5, 10, 10]} />
      <meshStandardMaterial color={"#E1251B"} /*map={texture}*//> // wireframe wireframeLinewidth={0.5}
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
  const [currentTexture, setCurrentTexture] = useState(new THREE.Texture())

  useEffect(() => {
    setCurrentTexture(new THREE.TextureLoader().load(`${API_PREFIX}/image/lores/${textureUrl}`))
  
    new THREE.TextureLoader()
      .loadAsync(`${API_PREFIX}/image/hires/${textureUrl}`, (progress) => {console.log("Progress", progress)})
      .then((texture) => setCurrentTexture(texture))
      .catch((err) => console.log(err));
  }, [textureUrl])

  rotation[1] += Math.PI / 2;

  return (
    <group>
      <mesh rotation={rotation} position={position} scale={[-1, 1, 1]}>
          <sphereGeometry args={[500, 64, 64]} />
          <meshBasicMaterial map={currentTexture} side={THREE.BackSide} />
      </mesh>
      {hotspots.map((hotspot, index) => (
        <Hotspot key={index} position={hotspot.position} rotation={hotspot.rotation} image_identifier={Number(hotspot.ts).toFixed(5)} onClick={() => onHotspotClick(hotspot)} />
      ))}
    </group>
  );
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

  return -rotationY; // Rotation in radians
}

const VirtualTourContent: React.FC<{ currentId:any, setCurrentId:any, currentPoint: any, setCurrentPoint: any, neighbours: any, setNeighbours: any }> = ({ currentId, setCurrentId, currentPoint, setCurrentPoint, neighbours, setNeighbours}) => {

  const [hotspots, setHotspots] = useState<HotspotObj[]>([])
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(new THREE.Vector3())
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);  
  
  const { camera } = useThree();

  useEffect(() => {
    fetchPointData(currentId);
  }, [currentId]);

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(`${API_PREFIX}/point/${pointId}`);
      const pointData = pointResponse.data;

      const neighboursResponse = await axios.get<NeighbourData[]>(`${API_PREFIX}/point/${pointId}/neighbours/8/2`);
      
      const neighboursData = neighboursResponse.data;

      setCurrentPoint(pointData);
      setCurrentImage(Number(pointData.ts).toFixed(5));
      

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

      const newRotation = getYRotation(pointData.pose); 
      setRotation([0, newRotation, 0]);

      console.log(currentPoint, newRotation, newPosition)
    } catch (error) {
      console.error("Error fetching point data:", error);
    }
  };

 

  const handleHotspotClick = (hotspot: HotspotObj) => {
    setCurrentId(hotspot.id);
  };

  return currentImage ? (
    <SphereWithHotspots position={currentPosition} textureUrl={currentImage} hotspots={hotspots} onHotspotClick={handleHotspotClick} rotation={rotation} />
  ) : null;
};

const VirtualTour: React.FC = () => {
  const defaultInitId = "270"
  let params = new URLSearchParams(window.location.search)
  const [currentId, setCurrentId] = useState<string>(() => {
    if (params.has("id")){
      return params.get("id") ?? defaultInitId;
    }
    return defaultInitId;
  });
  const [currentPoint, setCurrentPoint] = useState<PointData>({pose: [], ts:"", keyframe_id:300, location: "" });
  const [neighbours, setNeighbours] = useState<any[]>([]);
  const [locationGroup, setLocationGroup] = useState<string>("");

  const [camRotation, setCameraRotation] = useState<any>(() => {
    if (params.has("yaw") || params.has("pitch")){
      return { yaw: Number(params.get("yaw") ?? camRotation["yaw"] ?? 0), pitch: Number(params.get("pitch") ?? camRotation["pitch"] ?? 0)};
    }
    return { yaw: 0, pitch: 0}
  });

  useEffect(() =>{
    params.set("id", currentId)
    params.set("yaw", Number(camRotation["yaw"]).toFixed(4))
    params.set("pitch", Number(camRotation["pitch"]).toFixed(4))
    history.pushState({}, "", "?" + params.toString())
  }, [currentId])

  useEffect(() => {
    setLocationGroup(currentPoint.location)
  }, [currentPoint])

  useEffect(() => {
	const update = async () => {
		 const response = await axios.get<NeighbourData[]>(API_PREFIX + "/floor/" + location);
		 const data = response.data.map(val => ({position: calculatePositionFromMatrix(val.pose), name: val.keyframe_id}));
		 setNeighbours(data);
	}

	update();
  }, [locationGroup])

  window.onpopstate = e =>{

    params = new URLSearchParams(window.location.search)
    if (params.has("id")){
      setCurrentId(params.get("id") ?? "0");
    }
    
    if (params.has("yaw") || params.has("pitch")){
      setCameraRotation({ yaw: Number(params.get("yaw") ?? camRotation["yaw"] ?? 0), pitch: Number(params.get("pitch") ?? camRotation["pitch"] ?? 0)})
    }

  }

  return (
    <>
    <div style={{position: "fixed", bottom: 0, left: 0, background: "black", opacity: 0.6, zIndex: 99 }}>Location: {currentPoint?.location}</div>
    {showMap && (<Map imageSrc='test.jpg' pointsOfInterest={neighbours}/>)}
    <div style={{ width: "100vw", height: "100vh" }}>
    <Canvas camera={{ position: [0, 0, 10], fov: 75}} frameloop='demand' shadows>
    <ambientLight
        intensity={0.6}
      />
      <directionalLight
        castShadow
      />
      <CameraRotationControls initCameraRotation={camRotation} setCameraRotation={setCameraRotation} />
      <VirtualTourContent currentId={currentId} setCurrentId={setCurrentId} currentPoint={currentPoint} setCurrentPoint={setCurrentPoint} setNeighbours={setNeighbours} neighbours={neighbours} />
    </Canvas>
    </div>
    </>
  );
};

export default VirtualTour;
