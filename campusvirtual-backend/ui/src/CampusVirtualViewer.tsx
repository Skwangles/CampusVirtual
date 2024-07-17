// import * as THREE from 'three'
// import { Suspense, useState } from 'react'
// import { Canvas, useLoader } from '@react-three/fiber'
// import { Preload, OrbitControls, Sphere } from '@react-three/drei'

// THREE.Cache.enabled = true

// // function getYRotation(matrix) {
// //   // Ensure the matrix is 4x4
// //   if (matrix.length !== 4 || matrix[0].length !== 4 || matrix[1].length !== 4 || matrix[2].length !== 4 || matrix[3].length !== 4) {
// //       throw new Error("Invalid matrix size. Expected a 4x4 matrix.");
// //   }

// //   // Extract the relevant elements
// //   const m11 = matrix[0][0];
// //   const m31 = matrix[2][0];

// //   // Calculate the rotation angle around the Y-axis
// //   const rotationY = Math.atan2(m31, m11);

// //   return rotationY; // Rotation in radians
// // }

// function Dome({ neighbours, texture, onNeighbourClick }) {
//   const meshes = []

//   for (let i = 0; i < neighbours.length; i++) {
//     const neighbour = neighbours[i]
//     const pose = new THREE.Matrix4() //...neighbour.pose
//     const translation = new THREE.Vector3()
//     const rotation = new THREE.Quaternion()
//     const scale = new THREE.Vector3()
//     pose.decompose(translation, rotation, scale)
//     const position = new THREE.Vector3(
//       translation.x,
//       translation.y,
//       translation.z
//     )
//     return <Sphere position={position} onClick={() => onNeighbourClick(neighbour.id)} />
//   }

//   return (
//     <group>
//       <mesh>
//         <sphereGeometry args={[500, 60, 40]} />
//         <meshBasicMaterial map={texture} side={THREE.BackSide} />
//       </mesh>
//       {meshes}
//     </group>
//   )
// }

// function Portals() {
//   const [id, setID] = useState(1)
//   const [points, setPoints] = useState(
//     async () =>
//       (await (await fetch('/point/' + id + '/neighbours/1')).json()).neighbours
//   )

//   return (
//     <Dome
//       onNeighbourClick={async (id) => {
//         setID(id)
//         // const pointInfo = await (await fetch('/point/' + id)).json()
//         const neighbourInfo = await (
//           await fetch('/point/' + id + '/neighbours/1')
//         ).json()
//         setPoints(neighbourInfo.neighbours)
//       }}
//       neighbours={points}
//       texture={useLoader(THREE.TextureLoader, '/image/' + id)}
//     />
//   )
// }

// export default function App() {
//   return (
//     <Canvas frameloop="demand" camera={{ position: [0, 0, 0.1] }}>
//       <OrbitControls
//         enableZoom={false}
//         enablePan={false}
//         enableDamping
//         dampingFactor={0.2}
//         autoRotate={false}
//         rotateSpeed={-0.5}
//       />
//       <Suspense fallback={null}>
//         <Preload all />
//         <Portals />
//       </Suspense>
//     </Canvas>
//   )
// }
