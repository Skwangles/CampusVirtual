import React, { useState, useEffect, useRef, useReducer } from 'react'
import axios from 'axios'
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva'
import FileUpload from './FileUpload'
import PointControls from './PointControls'
import { API_PREFIX } from './consts'
import { findPathWithDijkstra } from './pathfinding'

interface Node {
  id: string
  x: number
  y: number
  type: number
  label: string
}

interface Edge {
  id0: string
  id1: string
}

interface FloorplanEditorProps {
  floorplan: string
}

const FloorplanEditor: React.FC<FloorplanEditorProps> = ({ floorplan }) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hasImage, setHasImage] = useState<boolean>(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageWidth, setStageWidth] = useState<number>(800)
  const [stageHeight, setStageHeight] = useState<number>(800)
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set())
  const [lastSelectedPoint, setLastSelectedPoint] = useState<Node | null>(null)
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = useRef<any>(null)

  const [dragStartPos, setDragStartPos] = useState<{
    x: number
    y: number
  } | null>(null)

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
          label: string
        }>
      }>(`${API_PREFIX}/api/floorplans/${floorplan}`)
      console.log(response.data)
      const img = new Image()
      img.src = `${API_PREFIX}/api/floorplans/${floorplan}/image`
      setHasImage(Boolean(response.data.has_image))
      img.onload = () => {
        setImage(img)
        setStageWidth(img.width)
        setStageHeight(img.height)
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

  useEffect(() => {
    setSelectedPoints(new Set())
    fetchFloorplanData()
  }, [floorplan])

  const handleDragStart = (e: any) => {
    const { x, y } = e.target.position()
    setDragStartPos({ x, y })
  }

  const handleDragMove = (e: any) => {
    console.log(dragStartPos)
    if (!dragStartPos) return

    const { x: x, y: y } = e.target.position()
    const dx = x - dragStartPos.x
    const dy = y - dragStartPos.y

    const width = e.target.getStage().width()
    const height = e.target.getStage().height()

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (selectedPoints.has(node.id) && node.id != e.target.name()) {
          const newX = clamp(node.x + dx / width, 0, 1)
          const newY = clamp(node.y + dy / height, 0, 1)
          return { ...node, x: newX, y: newY }
        } else if (node.id == e.target.name()) {
          return { ...node, x: x / width, y: y / height }
        }
        return node
      })
    )

    setDragStartPos({ x, y })
  }

  const handleMouseDown = (e: any) => {
    const id = e.target.name()
    const foundNode = nodes.find((node) => String(node.id) === String(id))
    const isCtrlPressed = e.evt.ctrlKey
    const isShiftPressed = e.evt.shiftKey

    if (isCtrlPressed) {
      setSelectedPoints((prev) => {
        const newSelected = prev
        if (newSelected.has(id)) {
          newSelected.delete(id)
        } else {
          newSelected.add(id)
        }
        return newSelected
      })
    } else if (isShiftPressed && lastSelectedPoint) {
      const method = 1 // Change to vary dijkstra method - only 1 currently implemented

      const selectedIds = findPathWithDijkstra(
        nodes,
        edges,
        lastSelectedPoint.id,
        id,
        method,
        true
      )
      setSelectedPoints((prev) => {
        for (const id of selectedIds) {
          prev.add(id)
        }
        return prev
      })
    } else {
      if (selectedPoints.size <= 1) {
        setSelectedPoints(new Set([id]))
      } else {
        setSelectedPoints((prev) => prev.add(id))
      }
    }

    setLastSelectedPoint(foundNode || null)
  }

  const moveX = (scale: number) => {
    const newNodes = nodes.map((node) => {
      node.x = node.x + scale
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
  }

  const moveY = (scale: number) => {
    const newNodes = nodes.map((node) => {
      node.y = node.y + scale
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
  }
  const rescaleX = (scale: number, originX: number = 0.5) => {
    const newNodes = nodes.map((node) => {
      node.x = (node.x - originX) * scale + originX
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
  }

  const rescaleY = (scale: number, originY: number = 0.5) => {
    const newNodes = nodes.map((node) => {
      node.y = (node.y - originY) * scale + originY
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
  }

  const rescalePoints = (
    scale: number,
    originX: number = 0.5,
    originY: number = 0.5
  ) => {
    const newNodes = nodes.map((node) => {
      node.x = (node.x - originX) * scale + originX
      node.y = (node.y - originY) * scale + originY
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
  }

  const handleMouseUp = (e: any) => {
    const x = e.target.x() / e.target.getStage().width()
    const y = e.target.y() / e.target.getStage().height()

    console.log('Finish pos:', x, y)
    setDragStartPos(null)

    for (const node of nodes.filter((node) => selectedPoints.has(node.id))) {
      axios.post(`${API_PREFIX}/api/floorplans/${floorplan}/update`, {
        id: node.id,
        x: node.x,
        y: node.y,
      })
    }
  }

  const updateAllPoints = (nodes: Node[]) => {
    axios
      .post(`${API_PREFIX}/api/floorplans/${floorplan}/updatemultiple`, {
        points: nodes,
      })
      .catch((e) => {
        console.error('Error occurred updating!', e)
      })
    console.log('Updated!')
  }

  const padCordAwayFromEdge = (val: number) => {
    const padding = 0.01
    return clamp(val, 0 + padding, 1 - padding)
  }

  const clamp = (value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value))
  }

  const getNodeCoords = (id: string) => {
    const node = nodes.find((node) => node.id === id)
    if (!node) throw Error("Couldn't find node: " + id)
    return {
      x: padCordAwayFromEdge(node.x) * stageWidth,
      y: padCordAwayFromEdge(node.y) * stageHeight,
    }
  }

  const flipPointsVertically = (onlySelected = false) => {
    const newNodes = nodes.map((node) => {
      if (onlySelected && !selectedPoints.has(node.id)) return node
      node.y = padCordAwayFromEdge(1 - node.y)
      return node
    })

    setNodes(newNodes)
    updateAllPoints(newNodes)
    forceUpdate()
  }

  const flipPointsHorizontally = (onlySelected = false) => {
    const newNodes = nodes.map((node) => {
      if (onlySelected && !selectedPoints.has(node.id)) return node
      node.x = padCordAwayFromEdge(1 - node.x)
      return node
    })

    setNodes(newNodes)
    updateAllPoints(newNodes)
    forceUpdate()
  }
  const rotatePoints = (onlySelected = false) => {
    const newNodes = nodes.map((node) => {
      if (onlySelected && !selectedPoints.has(node.id)) return node
      const x = node.x
      const y = node.y
      node.x = padCordAwayFromEdge(y)
      node.y = padCordAwayFromEdge(1 - x)
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
    forceUpdate()
  }

  const rotatePointsByAngle = (
    angle: number,
    oX: number,
    oY: number,
    onlySelected = false
  ) => {
    const newNodes = nodes.map((node) => {
      if (onlySelected && !selectedPoints.has(node.id)) return node

      const radians = angle * (Math.PI / 180) // Convert angle to radians
      const cosTheta = Math.cos(radians)
      const sinTheta = Math.sin(radians)

      const x = node.x - oX
      const y = node.y - oY

      node.x = padCordAwayFromEdge(x * cosTheta - y * sinTheta + oX)
      node.y = padCordAwayFromEdge(x * sinTheta + y * cosTheta + oY)
      return node
    })
    setNodes(newNodes)
    updateAllPoints(newNodes)
    forceUpdate()
  }

  return (
    <>
      <div>
        <FileUpload currentFloor={floorplan} isImageSelected={hasImage} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <button onClick={() => rotatePoints()}>
              Rotate All Points 90 Degrees
            </button>
            <button
              className="bg-blue-600"
              onClick={() => rotatePointsByAngle(5, 0.5, 0.5)}
            >
              Rotate All CW 10 Degrees
            </button>
            <button
              className="bg-blue-600"
              onClick={() => rotatePointsByAngle(-5, 0.5, 0.5)}
            >
              Rotate All CCW 10 Degrees
            </button>

            <button
              className="bg-orange-600"
              onClick={() => flipPointsHorizontally()}
            >
              Flip All Points Horizontally
            </button>
            <button
              className="bg-orange-600"
              onClick={() => flipPointsVertically()}
            >
              Flip All Points Vertically
            </button>

            <button className="bg-green-600" onClick={() => rescalePoints(1.1)}>
              Scale Up
            </button>
            <button className="bg-red-600" onClick={() => rescalePoints(0.9)}>
              Scale Down
            </button>

            <button className="bg-green-600" onClick={() => rescaleX(1.1)}>
              Scale X UP
            </button>
            <button className="bg-red-600" onClick={() => rescaleX(0.9)}>
              Scale X Down
            </button>

            <button className="bg-green-600" onClick={() => rescaleY(1.1)}>
              Scale Y UP
            </button>
            <button className="bg-red-600" onClick={() => rescaleY(0.9)}>
              Scale Y Down
            </button>

            <button onClick={() => moveX(-0.01)}>Move Left</button>
            <button onClick={() => moveX(0.01)}>Move Right</button>

            <button onClick={() => moveY(-0.01)}>Move Up</button>
            <button onClick={() => moveY(0.01)}>Move Down</button>
          </div>
          <div>
            <button onClick={() => rotatePoints(true)}>
              Rotate Selected (Green) Points 90 Degrees
            </button>
            <button onClick={() => flipPointsVertically(true)}>
              Flip Selected Points Vertically
            </button>
            <button onClick={() => flipPointsHorizontally(true)}>
              Flip Selected Points Horizontally
            </button>
          </div>
        </div>
        <div
          style={{
            border: 'solid 1px',
            borderRadius: '5px',
            width: 'fit-content',
          }}
        >
          {hasImage && (
            <Stage
              width={stageWidth}
              height={stageHeight}
              ref={layer}
              // draggable
              // onDragMove={handleDragMove}
              // onDragEnd={handleDragEnd}
            >
              <Layer>
                {image && nodes && (
                  <>
                    <KonvaImage
                      image={image}
                      width={stageWidth}
                      height={stageHeight}
                      onMouseDown={() => setSelectedPoints(new Set())}
                    />
                    {edges.map((edge, index) => {
                      const { x: x1, y: y1 } = getNodeCoords(edge.id0)
                      const { x: x2, y: y2 } = getNodeCoords(edge.id1)
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
                    {nodes &&
                      nodes.map((node) => (
                        <Circle
                          key={node.id}
                          x={padCordAwayFromEdge(node.x) * stageWidth}
                          y={padCordAwayFromEdge(node.y) * stageHeight}
                          radius={5}
                          fill={
                            selectedPoints.has(node.id)
                              ? 'green'
                              : node.type < 50
                              ? 'red'
                              : 'blue'
                          }
                          name={node.id}
                          draggable
                          onMouseDown={handleMouseDown}
                          onTouchStart={handleMouseDown}
                          onMouseUp={handleMouseUp}
                          onTouchEnd={handleMouseUp}
                          onDragStart={handleDragStart}
                          onDragMove={handleDragMove}
                          // onDragEnd={handleDragEnd}
                        />
                      ))}
                  </>
                )}
              </Layer>
            </Stage>
          )}
        </div>
      </div>
      <div>
        <PointControls
          id={lastSelectedPoint?.id}
          point={lastSelectedPoint}
          reloadPoints={() => {
            console.log('Reloading points')
            fetchFloorplanData()
          }}
        />
      </div>
    </>
  )
}

export default FloorplanEditor
