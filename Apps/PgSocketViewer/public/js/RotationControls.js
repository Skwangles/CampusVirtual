import * as THREE from 'three'

export class CameraRotationControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.isMouseDown = false;
    this.startX = 0;
    this.startY = 0;
    this.rotationSpeed = 0.002;
    this.euler = new THREE.Euler(0, 0, 0, "YXZ")
    this.init();
  }

  init() {
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
  }

  onMouseDown(event) {
    this.isMouseDown = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
  }

  onMouseMove(event) {
    if (!this.isMouseDown) return;
    const currentX = event.clientX;
    const currentY = event.clientY;
    const deltaX = currentX - this.startX;
    const deltaY = currentY - this.startY;
    this.startX = currentX;
    this.startY = currentY;
    
    this.euler.y += deltaX * this.rotationSpeed;
      this.euler.x += deltaY * this.rotationSpeed;

      // Limit Pitch to avoid flipping
     this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI /2, this.euler.x))

    this.camera.rotation.copy(this.euler)
    // this.camera.rotation.x -= deltaY * this.rotationSpeed;
  }

  onMouseUp() {
    this.isMouseDown = false;
  }

  onMouseLeave() {
    this.isMouseDown = false;
  }

  getRotation() {
    return { x: this.camera.rotation.x, y: this.camera.rotation.y, z: this.camera.rotation.z };
  }
}
