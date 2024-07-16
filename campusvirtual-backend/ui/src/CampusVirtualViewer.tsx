import * as THREE from 'three'
import { Suspense, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Preload, OrbitControls, Sphere } from '@react-three/drei'

THREE.Cache.enabled = true

function Dome({ name, neighbours, texture, onClick }) {
  const meshes = []

  for (let i = 0; i < neighbours.length; i++) {
    const neighbour = neighbours[i]
    const pose = new THREE.Matrix4(...neighbour.pose)
    const translation = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    pose.decompose(translation, rotation, scale)
    const position = new THREE.Vector3(
      translation.x,
      translation.y,
      translation.z
    )
    return <Sphere position={position} onClick={() => onClick(neighbour.id)} />
  }

  return (
    <group>
      <mesh>
        <sphereGeometry args={[500, 60, 40]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
      {meshes}
      <mesh position={position} onClick={() => onClick}>
        <sphereGeometry args={[1.25, 32, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  )
}

function Portals() {
  const [id, setID] = useState(1)
  const [point, setPoint] = useState(
    async () => await (await fetch('/point/' + id)).json()
  )
  const [points, setPoints] = useState(
    async () =>
      (await (await fetch('/point/' + id + '/neighbours/1')).json()).neighbours
  )

  return (
    <Dome
      onClick={async (id) => {
        setID(id)
        const pointInfo = await (await fetch('/point/' + id)).json()
        const neighbourInfo = await (
          await fetch('/point/' + id + '/neighbours/1')
        ).json()
        setPoint(pointInfo)
        setPoints(neighbourInfo.neighbours)
      }}
      neighbours={points}
      texture={useLoader(THREE.TextureLoader, '/image/' + id)}
    />
  )
}

export default function App() {
  return (
    <Canvas frameloop="demand" camera={{ position: [0, 0, 0.1] }}>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.2}
        autoRotate={false}
        rotateSpeed={-0.5}
      />
      <Suspense fallback={null}>
        <Preload all />
        <Portals />
      </Suspense>
    </Canvas>
  )
}
