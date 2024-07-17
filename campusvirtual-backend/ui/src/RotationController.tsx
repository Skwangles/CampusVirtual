import { useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";

const CameraRotationControls = () => {
  const { camera, gl } = useThree();
  const controlsRef = useRef({
    isMouseDown: false,
    startX: 0,
    startY: 0,
    rotationSpeed: 0.002,
  });

  useEffect(() => {
    const handleMouseDown = (event) => {
      controlsRef.current.isMouseDown = true;
      controlsRef.current.startX = event.clientX;
      controlsRef.current.startY = event.clientY;
    };

    const handleMouseMove = (event) => {
      if (!controlsRef.current.isMouseDown) return;
      const currentX = event.clientX;
      const currentY = event.clientY;
      const deltaX = currentX - controlsRef.current.startX;
      // const deltaY = currentY - controlsRef.current.startY;
      controlsRef.current.startX = currentX;
      controlsRef.current.startY = currentY;

      camera.rotation.y -= deltaX * controlsRef.current.rotationSpeed;
      // camera.rotation.x -= deltaY * controlsRef.current.rotationSpeed;
    };

    const handleMouseUp = () => {
      controlsRef.current.isMouseDown = false;
    };

    const handleMouseLeave = () => {
      controlsRef.current.isMouseDown = false;
    };

    gl.domElement.addEventListener('mousedown', handleMouseDown);
    gl.domElement.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('mouseup', handleMouseUp);
    gl.domElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('mouseup', handleMouseUp);
      gl.domElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [camera, gl.domElement]);

  return null;
};

export default CameraRotationControls