// import React, { useRef, useEffect } from 'react'
// import * as THREE from 'three'
// import { useThree } from '@react-three/fiber'

// import {
//   CURRENT_FRAME_COLOR,
//   KEYFRAME_COLOR,
//   EDGE_COLOR,
//   GLOBAL_SCALE,
// } from './consts' // Adjust path as necessary

// import { inv } from './utils' // Adjust path as necessary

// const CameraFrames = () => {
//   const { scene } = useThree()
//   const edgesRef = useRef()
//   const currentFrameRef = useRef()
//   const keyframeObjectsRef = useRef({})
//   const keyframeIndicesRef = useRef({})
//   const keyframePosesRef = useRef({})
//   const addedKeyframeIndicesRef = useRef([])
//   const removedPoolRef = useRef([])
//   const removedPoolSizeRef = useRef(0)

//   // Define your materials
//   const CURRENT_FRAME_MATERIAL = new THREE.LineBasicMaterial({
//     color: CURRENT_FRAME_COLOR,
//   })
//   const KEYFRAME_MATERIAL = new THREE.LineBasicMaterial({
//     color: KEYFRAME_COLOR,
//     linewidth: 2,
//   })
//   const EDGE_MATERIAL = new THREE.LineBasicMaterial({ color: EDGE_COLOR })

//   // Initial setup logic (similar to constructor)
//   useEffect(() => {
//     // Example: create initial objects like currentFrame and edges
//     const lineaGeometry = makeWireframe([1, 0, 0, 0], 1) // Example pose and size
//     currentFrameRef.current = new THREE.LineSegments(
//       lineaGeometry,
//       CURRENT_FRAME_MATERIAL
//     )
//     scene.add(currentFrameRef.current)

//     const lineaGeometryEdges = new THREE.Geometry()
//     edgesRef.current = new THREE.LineSegments(lineaGeometryEdges, EDGE_MATERIAL)
//     edgesRef.current.userData.keyframes = {} // Initialize user data
//     scene.add(edgesRef.current)

//     // Clean-up logic (like componentWillUnmount)
//     return () => {
//       // Clean up any resources (geometry, materials, etc.)
//       scene.remove(currentFrameRef.current)
//       currentFrameRef.current.geometry.dispose()
//       currentFrameRef.current.material.dispose()

//       scene.remove(edgesRef.current)
//       edgesRef.current.geometry.dispose()
//       edgesRef.current.material.dispose()
//     }
//   }, [scene]) // Ensure dependencies are properly handled

//   // Example function, convert this and other functions from the original class as needed
//   const makeWireframe = (pose_, size) => {
//     let lineGeo = new THREE.Geometry()
//     // Implement the wireframe creation logic here
//     return lineGeo
//   }

//   // Example usage of updating frames in the scene
//   const updateFramesInScene = (currentFrameId = -1) => {
//     // Implement your update logic here, referencing refs as necessary
//     // Example:
//     if (currentFrameId !== -1) {
//       scene.add(edgesRef.current)
//     }
//   }

//   // Render method (return JSX for the component)
//   return null // Placeholder, implement your rendering logic
// }

// export default CameraFrames
