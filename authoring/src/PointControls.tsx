// import { useEffect } from 'react';
// import { Canvas } from '@react-three/fiber';
// import * as THREE from 'three';
// import RotationController from './RotationController'
// @ts-ignore - required for Types
import React from 'react';
import {API_PREFIX} from './consts'
import axios from 'axios';

const PointControls = ({ id, reloadPoints }: {id: string | undefined, reloadPoints: any}) => {
  if (!id) return (<></>)


  return (
  <div style={{border: "solid 1px", width: "fit-content", height: "fit-content"}}>
    <h2>Point Info</h2>
  <img width={400} height={200} src={`${API_PREFIX}/api/image/${id}`}/>
  <button onClick={async () => {
    const result = await axios.delete(`/api/point/${id}/delete`);
    if (result.status == 200){
      window.alert("Sucessfully removed!")
      reloadPoints();
    }
    if (result.status == 409){
     window.alert("Could not delete point! [" + result.statusText.toString() + "]"); 
    }
    }}>Remove Point</button>
</div>)
};

export default PointControls;
