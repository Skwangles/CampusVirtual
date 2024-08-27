import React, {useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
// import { OrbitControls } from '@react-three/drei';
import { API_PREFIX, showList, showMap, COORDS_TO_METRES, addQuotationMarks} from './consts';
import * as THREE from 'three';
import axios from 'axios';
import CameraRotationControls from './RotationController';
import StatsForNerds from './StatsForNerds'
import Map from './Map';
import FloorList from './FloorList';


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
}



const Hotspot: React.FC<HotspotProps> = ({ position, onClick, rotation, image_identifier}) => {
  const sphereSize = 20 / COORDS_TO_METRES;
  const outlineSize = sphereSize * 1.09
  const dropHotspotsBelowEyeLevelOffset = 8 / COORDS_TO_METRES;
  // const [texture, setTexture] = useState(new THREE.Texture())

  // useEffect(() => {
  //   setTexture(new THREE.TextureLoader().load(`${API_PREFIX}/image/thumbnail/${image_identifier}`));
  // }, [image_identifier])

  
  position[1] -= COORDS_TO_METRES * dropHotspotsBelowEyeLevelOffset
  return (
    <>
    <mesh position={position} rotation={rotation} onClick={onClick} receiveShadow>
      <sphereGeometry args={[sphereSize, 20, 20]} />
      <meshStandardMaterial color={"#E1251B"} />
    </mesh>;
    <mesh position={position} rotation={rotation} onClick={onClick}>
    <sphereGeometry args={[outlineSize, 20, 20]} />
    <meshBasicMaterial color={"#FFFFFF"} side={THREE.BackSide}/>
    </mesh>
  </>);
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
      .loadAsync(`${API_PREFIX}/image/hires/${textureUrl}`)
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
  return [-position.x * COORDS_TO_METRES, -position.y * COORDS_TO_METRES, position.z * COORDS_TO_METRES];
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

const VirtualTourContent: React.FC<any> = ({ currentId, setCurrentId, currentPoint, setCurrentPoint, neighbours, setNeighbours, isRefined}) => {

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
      const pointResponse = await axios.get<PointData>(`${API_PREFIX}/point/${pointId}/true`);
      const pointData = pointResponse.data;

      const neighboursResponse = await axios.get<NeighbourData[]>(`${API_PREFIX}/point/${pointId}/neighbours/${Boolean(isRefined)}/8/6`);
      
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
  const defaultInitId = "272"
  let params = new URLSearchParams(window.location.search)
  const [currentId, setCurrentId] = useState<string>(() => {
    if (params.has("id")){
      return params.get("id") ?? defaultInitId;
    }
    return defaultInitId;
  });
  const [currentPoint, setCurrentPoint] = useState<PointData>({pose: [], ts:"", keyframe_id:300, location: "" });
  const [floorWideNeighbours, setFloorWideNeighbours] = useState<any[]>([]);
  const [locationGroup, setLocationGroup] = useState<string>("");
  const [isRefined, setIsRefined] = useState<boolean>(true);
  const [manualFloorSelected, setManualFloorSelect] = useState<string>("");

  const [allFloorNames, setAllFloorNames] = useState<string[]>([])

  const [camRotation, setCameraRotation] = useState<any>(() => {
    if (params.has("yaw") || params.has("pitch")){
      return { yaw: Number(params.get("yaw") ?? camRotation["yaw"] ?? 0), pitch: Number(params.get("pitch") ?? camRotation["pitch"] ?? 0)};
    }
    return { yaw: 0, pitch: 0}
  });

  useEffect(() => {
    // RUN ON FIRST LOAD
    axios.get<{location: string}[]>(API_PREFIX + "/floors").then(result => {
      console.log("Floors", result.data)
      setAllFloorNames(result.data.map(val => String(val.location)))
    })

  }, [])

  useEffect(() => {

    console.log("Manual Floor Selected", manualFloorSelected)
    if (manualFloorSelected == "") return
    let requestedFloor = manualFloorSelected
    if(addQuotationMarks){
      requestedFloor = "\"" + manualFloorSelected + "\"";
    }

    console.log("Fetching", requestedFloor)

    axios.get<{keyframe_id: number}>(API_PREFIX + "/floor/" + requestedFloor + "/point").then(value => {
      console.log(value.data)
      let result = value.data.keyframe_id
      if(isNaN(Number(result))) return;
      console.log("Setting ID to ", result)
      setCurrentId(Number(result).toString())
    }).catch((reason) => console.error("Floor could not be found: " + reason.toString()))
  }, [manualFloorSelected])


  useEffect(() =>{
    params.set("id", currentId)
    params.set("yaw", Number(camRotation["yaw"]).toFixed(4))
    params.set("pitch", Number(camRotation["pitch"]).toFixed(4))
    history.pushState({}, "", "?" + params.toString())
  }, [currentId])

  useEffect(() => {
    setLocationGroup(currentPoint.location)
  }, [currentPoint])

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
    <StatsForNerds point={currentPoint}/>
    <div style={{position: "fixed", top: 0, right: 0, zIndex: 9}}> Show Pruned: <input id="isrefined_chkbx" type="checkbox"  checked={isRefined} onChange={(event) =>{
      const checkbox = document.getElementById("isrefined_chkbx")
      //@ts-ignore
      setIsRefined(checkbox.checked)
    }}/></div>
    {showMap && (<Map floorName={locationGroup} setID={setCurrentId}/>)}
    {showList && allFloorNames.length > 0 && (<FloorList floors={allFloorNames} setManualFloorSelect={setManualFloorSelect}/>)}
    <div style={{ width: "100vw", height: "100vh" }}>
    <Canvas camera={{ position: [0, 0, 10], fov: 75}} frameloop='demand' shadows>
    <ambientLight
        intensity={0.6}
      />
      <directionalLight
        castShadow
      />
      <CameraRotationControls initCameraRotation={camRotation} setCameraRotation={setCameraRotation} />
      <VirtualTourContent currentId={currentId} setCurrentId={setCurrentId} currentPoint={currentPoint} setCurrentPoint={setCurrentPoint} setNeighbours={setFloorWideNeighbours} neighbours={floorWideNeighbours} isRefined={isRefined} />
    </Canvas>
    </div>
    </>
  );
};

export default VirtualTour;
