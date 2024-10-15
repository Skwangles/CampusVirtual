import React, { useState } from 'react'
import './Instructions.css'
import { Info } from 'react-feather'
// Type definitions
interface InstructionsProps {
  point: { keyframe_id: number; location: string; ts: string }
}

const Instructions: React.FC<InstructionsProps> = ({ point }) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="stats-container flex flex-col items-center align-center justify-center">
      <button className="stat-drawer-toggle" onClick={() => setIsOpen(!isOpen)}>
        <Info /> {isOpen ? 'Hide' : ''}
      </button>

      {isOpen && (
        <div className="stats">
          General Usage
          <ul>
            <li>Drag on the screen to move where you are looking</li>
            <li>Click on the Red orbs to jump to a different position</li>
            <li>
              The current region/location you are in is show in the bottom left
            </li>
          </ul>
          Search
          <ul>
            <li>
              Search for a region/location in the search bar and jump to it
              directly, or have it highlight the path in blue and guide you!
            </li>
            <li>
              The end of a highlighted path is shown with a yellow rotating
              square!
            </li>
            <li>
              Clear a highlighted path using a button in the top right (only
              shows when a path is highlighted)
            </li>
          </ul>
          Map
          <ul>
            <li>Toggle the map with a button in the top left</li>
            <li>Hover over the map to increase its size</li>
            <li>
              Map Key: Person Icon = Your Current position, Door Icon= Move to
              next the region, Red= Regular viewing point, Blue = A highlighted
              path
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default Instructions
