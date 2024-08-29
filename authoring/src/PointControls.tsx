// import { useEffect } from 'react';
// import { Canvas } from '@react-three/fiber';
// import * as THREE from 'three';
// import RotationController from './RotationController'
// @ts-ignore - required for Types
import React, { useState } from 'react';
import {API_PREFIX} from './consts'
import axios from 'axios';

const PointControls = ({ id, point, reloadPoints }: {id: string | undefined, point: {id: string, x: number, y:number, type: number} | null, reloadPoints: any}) => {
  if (!id || !point) return (<></>)

    const [connectId, setConnectId] = useState<string>("")

  return (
  <div style={{margin: "5px", borderRadius:"5px", border: "solid 1px", width: "fit-content", height: "fit-content", display: 'flex', flexDirection:'column'}}>
    <h2>Point Info</h2>
    <ul>
            <li>Point ID: {point.id}</li>
          <li>X: {point.x * 100}%</li>
          <li>Y: {point.y * 100}%</li>
          <li>Type: {point.type}</li>
    </ul>
  <img width={400} height={200} src={`${API_PREFIX}/api/image/${id}`}/>
  <button style={{margin: "5px"}} onClick={async () => {
    const result = await axios.delete(`/api/point/${id}/delete`);
    if (result.status == 200){
      window.alert("Sucessfully removed!")
      reloadPoints();
    }
    else if (result.status == 409){
     window.alert(`Could not delete point! [${result.statusText.toString()}]`); 
    }
    else {
      window.alert(`Unknown error: ${result.statusText}`)
    }
    }}>Delete Point</button>

    <div> 
      <button style={{margin: "5px"}} onClick={async ()=>{
        const id2 = Number(connectId);
        console.log("Connecting to:", id2)
        if (!id2 || isNaN(id2)) return;

        const result = await axios.post(`${API_PREFIX}/api/point/${id}/connect/${id2}`)
        if (result.status == 201){
          window.alert(`Successfully connected ID: ${id} to ID 2: ${id2}`)
          reloadPoints();
        }
        else if (result.status == 409){
          window.alert(`Could not connect points! [${result.statusText}]`)
        }
        else {
          window.alert(`Unknown error: ${result.statusText}`)
        }
        
      }}>Connect To</button>
      <input type='text' id="connect-point-id" placeholder='e.g. 271' onChange={(e) => setConnectId(e.target.value)}/>
    </div>
</div>)
};

export default PointControls;
