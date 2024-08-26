import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import RotationController from './RotationController'

const EquirectangularViewer = ({ id }: any) => {
  // The scene component that renders the 360 image
  console.debug("Equirectangular:", id)
  return (<>
  {id && id !== '' && (
    <Canvas
    camera={{ position: [0, 0, 10], fov: 75}} frameloop='demand'
    >
      {/* <RotationController /> */}
      <EquirectangularSphere textureUrl={id} />
    </Canvas>)} </>);
};

// A separate component to handle the equirectangular sphere
const EquirectangularSphere = ({ textureUrl }: {textureUrl: string}) => {
  console.log("LOad")
  const [currentTexture, setCurrentTexture] = useState(new THREE.Texture())
  console.log("Loading")
  useEffect(() => {
    setCurrentTexture(new THREE.TextureLoader().load(`/api/image/${textureUrl}`))
  }, [textureUrl])

  return (
    <mesh scale={[-1, 1, 1]}>
          <sphereGeometry args={[500, 64, 64]} />
          <meshBasicMaterial map={currentTexture} side={THREE.BackSide} />
      </mesh>
  );
};

export default EquirectangularViewer;
