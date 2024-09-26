import React, { useEffect, useState } from 'react'
import { Stage, Image as KonvaImage, Line, Circle, Layer } from 'react-konva'
import { API_PREFIX, HIDE_EDGES, MAX_MAP_HEIGHT_PERCENT } from './consts'
import './Map.css'
import useImage from 'use-image'
import axios from 'axios'
interface Node {
  id: string
  x: number
  y: number
  type: number
}

interface Edge {
  id0: string
  id1: string
}

interface MinimapProps {
  floorName: string
  setID: any
  currentId: string
  highlightedPath: number[]
}

const Map: React.FC<MinimapProps> = ({
  floorName,
  setID,
  currentId,
  highlightedPath: highlightedPoints,
}) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hasImage, setHasImage] = useState<boolean>(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageWidth, setStageWidth] = useState<number>(800)
  const [stageHeight, setStageHeight] = useState<number>(800)
  const [closeDrawer, setCloseDrawer] = useState<boolean>(false)
  const [doorImg] = useImage('Door.svg')
  const [personImg] = useImage('black-person.png')

  useEffect(() => {
    const fetchFloorplanData = async () => {
      try {
        const response = await axios.get<{
          has_image: boolean
          image: string
          edges: Array<{ keyframe_id0: number; keyframe_id1: number }>
          nodes: Array<{
            x: number
            y: number
            keyframe_id: number
            type: number
          }>
        }>(`${API_PREFIX}/api/floorplans/${floorName}`)
        const img = new Image()
        img.src = `${API_PREFIX}/api/floorplans/${floorName}/image`
        console.log('Has image', response.data)
        setHasImage(String(response.data.has_image) == 'true')
        img.onload = () => {
          setImage(img)
          const aspectRatio = img.width / img.height
          const maxHeight = MAX_MAP_HEIGHT_PERCENT * window.innerHeight
          const width = maxHeight * aspectRatio
          setStageWidth(width)
          setStageHeight(maxHeight)
        }
        setEdges(
          response.data.edges.map((edge) => ({
            id0: String(edge.keyframe_id0),
            id1: String(edge.keyframe_id1),
          }))
        )
        setNodes(
          response.data.nodes.map((node) => ({
            id: String(node.keyframe_id),
            ...node,
          }))
        )
      } catch (error) {
        console.error('Error fetching floorplan data:', error)
      }
    }

    fetchFloorplanData()
  }, [floorName])

  const getNodeCoords = (id: string) => {
    const node = nodes.find((node) => node.id === id)
    if (!node) throw Error("Couldn't find node: " + id)
    return { x: node.x * stageWidth, y: node.y * stageHeight }
  }

  const handleMouseUp = (e: any) => {
    const id = e.target.name()
    if (isNaN(Number(id))) return
    setID(id)
  }

  return (
    <div
      style={{
        zIndex: 999,
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        left: 0,
        top: 0,
      }}
    >
      <button
        style={{ zIndex: 999, padding: '5px', margin: '5px' }}
        onClick={() => {
          setCloseDrawer(!closeDrawer)
        }}
      >
        Toggle Map
      </button>
      <div style={{ backgroundColor: 'lightgray' }} className="minimap-wrapper">
        {closeDrawer && hasImage && (
          <Stage width={stageWidth} height={stageHeight}>
            <Layer>
              {image && (
                <>
                  <KonvaImage
                    image={image}
                    width={stageWidth}
                    height={stageHeight}
                  />

                  {edges.map((edge, index) => {
                    const { x: x1, y: y1 } = getNodeCoords(edge.id0)
                    const { x: x2, y: y2 } = getNodeCoords(edge.id1)
                    if (HIDE_EDGES) {
                      return <></>
                    }
                    return (
                      <Line
                        key={index}
                        points={[x1, y1, x2, y2]}
                        stroke="black"
                        strokeWidth={2}
                        lineCap="round"
                        lineJoin="round"
                      />
                    )
                  })}
                  {nodes.map((node) => {
                    if (String(node.id) === String(currentId)) {
                      const iconWidth = 30
                      const iconHeight = 30
                      return (
                        <KonvaImage
                          image={personImg}
                          width={iconWidth}
                          height={iconHeight}
                          key={node.id}
                          x={node.x * stageWidth - iconWidth / 2}
                          y={node.y * stageHeight - iconHeight / 2}
                          name={node.id}
                          onMouseUp={handleMouseUp}
                          onTouchEnd={handleMouseUp}
                        />
                      )
                    }

                    if (node.type >= 50) {
                      const iconWidth = 15
                      const iconHeight = 20
                      return (
                        <KonvaImage
                          image={doorImg}
                          width={iconWidth}
                          height={iconHeight}
                          key={node.id}
                          x={node.x * stageWidth - iconWidth / 2}
                          y={node.y * stageHeight - iconHeight / 2}
                          name={node.id}
                          onMouseUp={handleMouseUp}
                          onTouchEnd={handleMouseUp}
                        />
                      )
                    } else {
                      return (
                        <Circle
                          key={node.id}
                          x={node.x * stageWidth}
                          y={node.y * stageHeight}
                          radius={5}
                          fill={
                            String(node.id) === String(currentId)
                              ? 'yellow'
                              : highlightedPoints.includes(Number(node.id))
                              ? 'blue'
                              : 'red'
                          }
                          name={node.id}
                          onMouseUp={handleMouseUp}
                          onTouchEnd={handleMouseUp}
                        />
                      )
                    }
                  })}
                </>
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  )
}

export default Map
