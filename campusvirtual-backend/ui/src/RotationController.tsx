import { useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import { Euler } from "three";

const CameraRotationControls = ({ initCameraRotation, setCameraRotation }) => {
  const { camera, gl } = useThree();

  const controlsRef = useRef({
    isMouseDown: false,
    startX: 0,
    startY: 0,
    rotationSpeed: 0.002,
    initialPitch: initCameraRotation["pitch"],
    initialYaw: initCameraRotation["yaw"],
    euler: new Euler(initCameraRotation["pitch"] ?? 0, initCameraRotation["yaw"] ?? 0, 0, "YXZ"), // Initialize Euler with initial rotation
  });

  useEffect(() => {
    // Set initial rotation using Euler
    camera.rotation.copy(controlsRef.current.euler);
  }, [camera]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      controlsRef.current.isMouseDown = true;
      controlsRef.current.startX = event.clientX;
      controlsRef.current.startY = event.clientY;
    };

    const handleMouseUp = () => {
      controlsRef.current.isMouseDown = false;
    };

    const handleMouseLeave = () => {
      controlsRef.current.isMouseDown = false;
    };

    const handleTouchStart = (event) => {
      controlsRef.current.isMouseDown = true;
      controlsRef.current.startX = event.touches[0].clientX;
      controlsRef.current.startY = event.touches[0].clientY;
    };

    const handleMouseMove = (event) => {
      if (!controlsRef.current.isMouseDown) return;

      const currentX = event.clientX;
      const currentY = event.clientY;
      const deltaX = currentX - controlsRef.current.startX;
      const deltaY = currentY - controlsRef.current.startY;

      controlsRef.current.startX = currentX;
      controlsRef.current.startY = currentY;

      // Update Euler rotation
      controlsRef.current.euler.y += deltaX * controlsRef.current.rotationSpeed;
      controlsRef.current.euler.x += deltaY * controlsRef.current.rotationSpeed;

      // Limit pitch to avoid flipping
      controlsRef.current.euler.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, controlsRef.current.euler.x)
      );

      camera.rotation.copy(controlsRef.current.euler);
      setCameraRotation({
        yaw: controlsRef.current.euler.y,
        pitch: controlsRef.current.euler.x,
      });
    };

    const handleTouchMove = (event) => {
      if (!controlsRef.current.isMouseDown || event.touches.length !== 1)
        return;

      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      const deltaX = currentX - controlsRef.current.startX;
      const deltaY = currentY - controlsRef.current.startY;

      controlsRef.current.startX = currentX;
      controlsRef.current.startY = currentY;

      // Update Euler rotation
      controlsRef.current.euler.y += deltaX * controlsRef.current.rotationSpeed;
      controlsRef.current.euler.x += deltaY * controlsRef.current.rotationSpeed;

      // Limit pitch to avoid flipping
      controlsRef.current.euler.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, controlsRef.current.euler.x)
      );

      camera.rotation.copy(controlsRef.current.euler);
      setCameraRotation({
        yaw: controlsRef.current.euler.y,
        pitch: controlsRef.current.euler.x,
      });
    };

    const handleTouchEnd = () => {
      controlsRef.current.isMouseDown = false;
    };

    gl.domElement.addEventListener("mousedown", handleMouseDown);
    gl.domElement.addEventListener("mousemove", handleMouseMove);
    gl.domElement.addEventListener("mouseup", handleMouseUp);
    gl.domElement.addEventListener("mouseleave", handleMouseLeave);

    gl.domElement.addEventListener("touchstart", handleTouchStart);
    gl.domElement.addEventListener("touchmove", handleTouchMove);
    gl.domElement.addEventListener("touchend", handleTouchEnd);
    gl.domElement.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      gl.domElement.removeEventListener("mousedown", handleMouseDown);
      gl.domElement.removeEventListener("mousemove", handleMouseMove);
      gl.domElement.removeEventListener("mouseup", handleMouseUp);
      gl.domElement.removeEventListener("mouseleave", handleMouseLeave);

      gl.domElement.removeEventListener("touchstart", handleTouchStart);
      gl.domElement.removeEventListener("touchmove", handleTouchMove);
      gl.domElement.removeEventListener("touchend", handleTouchEnd);
      gl.domElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [camera, gl.domElement]);

  return null;
};

export default CameraRotationControls;