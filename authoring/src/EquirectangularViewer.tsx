// import { useEffect } from 'react';
// import { Canvas } from '@react-three/fiber';
// import * as THREE from 'three';
// import RotationController from './RotationController'
// @ts-ignore - required for Types
import React from 'react';
import {API_PREFIX} from './consts'

const EquirectangularViewer = ({ id }: any) => {
  if (!id) return (<></>)

    // TODO: Make this actually 360

    console.log("Showing IMAGE")
  // The scene component that renders the 360 image
  // const [currentTexture, setCurrentTexture] = useState(new THREE.Texture())
  
  // useEffect(() => {
  //   setCurrentTexture(new THREE.TextureLoader().load(`/api/image/${id}`))
  // }, [id])

  return (
  <div style={{border: "solid 1px", width: "20vw", height: "100vh"}}>
  <img width={400} height={200} src={`${API_PREFIX}/api/image/${id}`}></img>
</div>)
  // return (<>
  // {id && id !== '' && (
  //   <div style={{width: "50px", height: "50px"}}>
  //   <Canvas
  //   camera={{ position: [0, 0, 10], fov: 75}} frameloop='demand'
  //   >
  //     <RotationController />
  //     <mesh scale={[-1, 1, 1]}>
  //         <sphereGeometry args={[500, 64, 64]} />
  //         <meshBasicMaterial color={"red"} side={THREE.BackSide} />
  //     </mesh>
  //   </Canvas></div>
  //   )} 
  //   </>);
};

export default EquirectangularViewer;
