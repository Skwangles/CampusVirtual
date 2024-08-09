import React, { useRef } from 'react';

import './Map.css';

interface PointOfInterest {   pose: any; position: [number, number, number]; rotation: [number, number, number]; id: string; ts: string }

interface MinimapProps {
  imageSrc: string;
  pointsOfInterest: PointOfInterest[];
}

const Map: React.FC<MinimapProps> = ({ imageSrc, pointsOfInterest }) => {
  const imgWidthRef = useRef<HTMLImageElement>(null);

  const min_x = Math.min(...pointsOfInterest.map(point => point.position[0]))
  const max_x = Math.max(...pointsOfInterest.map(point => point.position[0]))
  const min_z = Math.min(...pointsOfInterest.map(point => point.position[2]));
  const max_z = Math.max(...pointsOfInterest.map(point => point.position[2]));

  return (
    <div className="minimap-wrapper" style={{zIndex: 999}} ref={imgWidthRef}>
      <img src={imageSrc} alt="Minimap" className="minimap-image"/>
      {!imgWidthRef.current || pointsOfInterest.map(point => {
        const dimensions = imgWidthRef.current?.getBoundingClientRect();
        if(!dimensions) return (<></>);

        console.log(dimensions,(max_x - min_x) / (point.position[0]-min_x), (max_z - min_z) / (point.position[2]-min_z) )
        const left = dimensions!.width *  ((point.position[0]-min_x) / (max_x - min_x))
        const right = dimensions!.height * ((point.position[2]-min_z) / (max_z - min_z))
        console.log("Position:", left, right)
        return (
        <div
          key={point.id + Math.random()*100}
          className="minimap-point"
          style={{ left: `${left}px`, top: `${right}px` }}
          title={point.ts}
          onClick={() => alert(`Clicked on ${point.ts}`)}
        />
      )})}
    </div>
  );
};

export default Map;