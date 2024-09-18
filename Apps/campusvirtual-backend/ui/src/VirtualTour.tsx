import React, { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  HOTSPOT_COLOUR,
  HOTSPOT_HIGHLIGHTED,
  HOTSPOT_OUTLINE,
  SHOW_NAV_SEARCH,
} from './consts'
// import { OrbitControls } from '@react-three/drei';
import { API_PREFIX, showMap, COORDS_TO_METRES, PROJECT_NAME } from './consts'
import * as THREE from 'three'
import axios from 'axios'
import CameraRotationControls from './RotationController'
import Instructions from './Instructions'
import Map from './Map'
import SearchBar from './SearchBar'
import { toast, ToastContainer, Bounce } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'

interface HotspotProps {
  position: [number, number, number]
  rotation: [number, number, number]
  image_identifier: string
  onClick: () => void
  isHighlighted: boolean
}

interface HotspotObj {
  pose: THREE.Matrix4
  position: [number, number, number]
  rotation: [number, number, number]
  id: string
  ts: string
}

interface PointData {
  pose: number[]
  ts: string
  keyframe_id: number
  location: string
}

interface NeighbourData {
  pose: number[]
  ts: string
  keyframe_id: string
}

const Hotspot: React.FC<HotspotProps> = ({
  position,
  onClick,
  rotation,
  image_identifier,
  isHighlighted,
}) => {
  const sphereSize = 20 / COORDS_TO_METRES
  const outlineSize = sphereSize * 1.09
  const dropHotspotsBelowEyeLevelOffset = 8 / COORDS_TO_METRES

  position[1] -= COORDS_TO_METRES * dropHotspotsBelowEyeLevelOffset
  return (
    <>
      <mesh
        position={position}
        rotation={rotation}
        onClick={onClick}
        receiveShadow
      >
        <sphereGeometry args={[sphereSize, 20, 20]} />
        <meshStandardMaterial
          color={isHighlighted ? HOTSPOT_HIGHLIGHTED : HOTSPOT_COLOUR}
        />
      </mesh>
      ;
      <mesh position={position} rotation={rotation} onClick={onClick}>
        <sphereGeometry args={[outlineSize, 20, 20]} />
        <meshBasicMaterial color={HOTSPOT_OUTLINE} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

interface SphereWithHotspotsProps {
  position: THREE.Vector3
  textureUrl: string
  hotspots: HotspotObj[]
  onHotspotClick: (hotspot: HotspotObj) => void
  rotation: [number, number, number]
  highlightedOrbs: number[]
}

const SphereWithHotspots: React.FC<SphereWithHotspotsProps> = ({
  position,
  textureUrl,
  hotspots,
  onHotspotClick,
  rotation,
  highlightedOrbs,
}) => {
  const [currentTexture, setCurrentTexture] = useState(new THREE.Texture())

  useEffect(() => {
    let hasHigherResAlreadyLoaded = false
    const textureUrlCopy = textureUrl

    // Load low-res and hi-res at same time, but ignore one if already completed.
    new THREE.TextureLoader()
      .loadAsync(`${API_PREFIX}/image/lores/${textureUrl}`)
      .then((texture) => {
        console.log('Logged Texture - lowres:', textureUrlCopy)
        if (!hasHigherResAlreadyLoaded && textureUrl === textureUrlCopy) {
          setCurrentTexture(texture)
        }
      })

    new THREE.TextureLoader()
      .loadAsync(`${API_PREFIX}/image/hires/${textureUrl}`)
      .then((texture) => {
        console.log('Logged Texture - hires:', textureUrlCopy)
        if (textureUrlCopy === textureUrl) {
          hasHigherResAlreadyLoaded = true
          setCurrentTexture(texture)
        }
      })
      .catch((err) => console.log(err))
  }, [textureUrl])

  rotation[1] += Math.PI / 2

  return (
    <group>
      <mesh rotation={rotation} position={position} scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 64, 64]} />
        <meshBasicMaterial map={currentTexture} side={THREE.BackSide} />
      </mesh>
      {hotspots.map((hotspot, index) => (
        <Hotspot
          key={index}
          position={hotspot.position}
          rotation={hotspot.rotation}
          image_identifier={Number(hotspot.ts).toFixed(5)}
          onClick={() => onHotspotClick(hotspot)}
          isHighlighted={highlightedOrbs.includes(Number(hotspot.id))}
        />
      ))}
    </group>
  )
}

const calculatePositionFromMatrix = (
  matrix: number[]
): [number, number, number] => {
  const m = new THREE.Matrix4()
  //@ts-expect-error It is in the right format
  m.set(...matrix)
  m.invert()
  const position = new THREE.Vector3()
  position.setFromMatrixPosition(m)
  return [
    -position.x * COORDS_TO_METRES,
    -position.y * COORDS_TO_METRES,
    position.z * COORDS_TO_METRES,
  ]
}

function getYRotation(matrix) {
  // Ensure the matrix is 4x4
  if (matrix.length !== 16) {
    throw new Error('Invalid matrix size. Expected a 4x4 matrix.')
  }

  // Extract the relevant elements
  const m11 = matrix[0]
  const m31 = matrix[8]

  // Calculate the rotation angle around the Y-axis
  const rotationY = Math.atan2(m31, m11)

  return -rotationY // Rotation in radians
}

const VirtualTourContent: React.FC<any> = ({
  currentId,
  setCurrentId,
  currentPoint,
  setCurrentPoint,
  neighbours,
  setNeighbours,
  isRefined,
  highlightedPath,
}) => {
  const [hotspots, setHotspots] = useState<HotspotObj[]>([])
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(
    new THREE.Vector3()
  )
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0])

  const { camera } = useThree()

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(
        `${API_PREFIX}/point/${pointId}/true`
      )
      const pointData = pointResponse.data

      const neighboursResponse = await axios.get<NeighbourData[]>(
        `${API_PREFIX}/point/${pointId}/neighbours/${Boolean(isRefined)}/8/6`
      )

      const neighboursData = neighboursResponse.data

      setCurrentPoint(pointData)
      setCurrentImage(Number(pointData.ts).toFixed(5))

      setHotspots(
        neighboursData.map((neighbour) => {
          const pos = calculatePositionFromMatrix(neighbour.pose)
          const m = new THREE.Matrix4()

          //@ts-expect-error - neighbour.pose is in the right format
          m.set(...neighbour.pose)

          return {
            position: pos,
            rotation: [0, getYRotation(neighbour.pose), 0],
            pose: m,
            id: neighbour.keyframe_id,
            ts: neighbour.ts,
          }
        })
      )

      const newPosition = calculatePositionFromMatrix(pointData.pose)
      setCurrentPosition(new THREE.Vector3(...newPosition))
      camera.position.set(newPosition[0], newPosition[1], newPosition[2])

      const newRotation = getYRotation(pointData.pose)
      setRotation([0, newRotation, 0])
    } catch (error) {
      console.error('Error fetching point data:', error)
    }
  }

  useEffect(() => {
    fetchPointData(currentId)
  }, [currentId])

  const handleHotspotClick = (hotspot: HotspotObj) => {
    setCurrentId(hotspot.id)
  }

  return currentImage ? (
    <SphereWithHotspots
      position={currentPosition}
      textureUrl={currentImage}
      hotspots={hotspots}
      onHotspotClick={handleHotspotClick}
      rotation={rotation}
      highlightedOrbs={highlightedPath}
    />
  ) : (
    <></>
  )
}

const VirtualTour: React.FC = () => {
  let params = new URLSearchParams(window.location.search)

  const [currentId, setCurrentId] = useState<string>(() => {
    if (params.has('id')) {
      return params.get('id') ?? '-1'
    }
    return '-1'
  })
  const [currentPoint, setCurrentPoint] = useState<PointData>({
    pose: [],
    ts: '',
    keyframe_id: 300,
    location: '',
  })
  const [floorWideNeighbours, setFloorWideNeighbours] = useState<any[]>([])
  const [locationGroup, setLocationGroup] = useState<string>('')
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])

  const [allFloorNames, setAllFloorNames] = useState<string[]>([])

  const [camRotation, setCameraRotation] = useState<any>(() => {
    if (params.has('yaw') || params.has('pitch')) {
      return {
        yaw: Number(params.get('yaw') ?? camRotation['yaw'] ?? 0),
        pitch: Number(params.get('pitch') ?? camRotation['pitch'] ?? 0),
      }
    }
    return { yaw: 0, pitch: 0 }
  })

  const changeFloor = (requestedFloor: string) => {
    console.log('Fetching', requestedFloor)

    axios
      .get<{ keyframe_id: number }>(
        API_PREFIX + '/floor/' + requestedFloor + '/point'
      )
      .then((value) => {
        console.log(value.data)
        const result = value.data.keyframe_id
        if (isNaN(Number(result))) return
        console.log('Setting ID to ', result)
        setCurrentId(Number(result).toString())
      })
      .catch((reason) =>
        console.error('Floor could not be found: ' + reason.toString())
      )
  }

  useEffect(() => {
    // RUN ON FIRST LOAD
    axios.get<{ location: string }[]>(API_PREFIX + '/floors').then((result) => {
      console.log('Floors', result.data)
      setAllFloorNames(result.data.map((val) => String(val.location)))
    })

    if (currentId == '-1' || (params.has('id') && params.get('id') != '-1')) {
      changeFloor('G.G')
    }
  }, [])

  useEffect(() => {
    document.title = locationGroup
      ? PROJECT_NAME + ' - ' + locationGroup
      : PROJECT_NAME
    params.set('id', currentId)
    history.pushState({}, '', '?' + params.toString())
  }, [
    currentId,
    locationGroup /* DO NOT INCLUDE 'params' otherwise any yaw/pitch change will trigger it */,
  ])

  useEffect(() => {
    params.set('yaw', Number(camRotation['yaw']).toFixed(4))
    params.set('pitch', Number(camRotation['pitch']).toFixed(4))
    history.replaceState({}, '', '?' + params.toString())
  }, [camRotation])

  useEffect(() => {
    setLocationGroup(currentPoint.location)
  }, [currentPoint])

  window.onpopstate = (e) => {
    params = new URLSearchParams(window.location.search)
    if (params.has('id')) {
      setCurrentId(params.get('id') ?? '0')
    }

    if (params.has('yaw') || params.has('pitch')) {
      setCameraRotation({
        yaw: Number(params.get('yaw') ?? camRotation['yaw'] ?? 0),
        pitch: Number(params.get('pitch') ?? camRotation['pitch'] ?? 0),
      })
    }
  }

  const calculateHighlightedPath = async (selectedLocation: string) => {
    try {
      const response = await axios.get(
        `/point/${currentId}/path/${selectedLocation}`
      )
      console.log('API Response:', response.data)
      if (!response.data || !response.data.path) {
        toast.error('Something went wrong calculating a path!')
      } else {
        setHighlightedPath(response.data?.path)
        toast.success(
          `Path to Floor: ${selectedLocation} is now highlighted, follow the blue dots...`
        )
      }
    } catch (error) {
      console.error('API Error:', error)
      toast.error('Something went wrong fetching the path, try again later!')
    }
  }

  useEffect(() => {
    if (
      highlightedPath.length > 0 &&
      highlightedPath.includes(Number(currentId))
    ) {
      setHighlightedPath(
        highlightedPath.slice(highlightedPath.indexOf(Number(currentId)))
      )
    }
  }, [currentId])

  return (
    <>
      <div
        style={{
          background: '#101010F0',
          position: 'fixed',
          left: 0,
          bottom: 0,
          zIndex: 999,
          fontSize: '2rem',
          padding: '5px',
          borderRadius: '10px',
        }}
      >
        Location: {currentPoint.location}
      </div>
      <Instructions point={currentPoint} />
      {showMap && (
        <Map
          floorName={locationGroup}
          setID={setCurrentId}
          currentId={currentId}
          highlightedPath={highlightedPath}
        />
      )}
      {SHOW_NAV_SEARCH && allFloorNames.length > 0 && (
        <>
          <SearchBar
            data={allFloorNames}
            highlightCallback={calculateHighlightedPath}
            jumpToCallback={changeFloor}
          />
          {highlightedPath.length > 0 && (
            <button
              style={{
                top: 0,
                right: 0,
                position: 'fixed',
                zIndex: 999,
                background: '#4d4c4c',
                color: 'white',
              }}
              onClick={() => setHighlightedPath([])}
            >
              Clear Highlight
            </button>
          )}
        </>
      )}

      <div style={{ width: '100vw', height: '100vh' }}>
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }} shadows>
          <ambientLight intensity={0.6} />
          <directionalLight castShadow />
          <CameraRotationControls
            initCameraRotation={camRotation}
            setCameraRotation={setCameraRotation}
          />
          <VirtualTourContent
            currentId={currentId}
            setCurrentId={setCurrentId}
            currentPoint={currentPoint}
            setCurrentPoint={setCurrentPoint}
            setNeighbours={setFloorWideNeighbours}
            neighbours={floorWideNeighbours}
            isRefined={true}
            highlightedPath={highlightedPath}
          />
        </Canvas>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </>
  )
}

export default VirtualTour
