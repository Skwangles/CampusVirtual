'use strict';

import { CameraRotationControls } from './RotationControls.js';
import * as THREE from 'three';

import CameraFrames from './CameraFrames.js';
import { PointCloud } from './PointCloud.js';
import { THUMB_SCALING, THUMB_HEIGHT, CANVAS_SIZE, GLOBAL_SCALE, BACKGROUND_COLOR } from './consts.js';
import { array2mat44 } from './utils.js';

let scene, camera, camera2, renderer, insetHeight, insetWidth;
let receiveTimestamp = 0; // used for fps calculation

let graphicStats; // visualize fps of graphic refresh
let trackStats; // visualize fps of tracking update
let clock = new THREE.Clock();

let cameraFrames = new CameraFrames();

let controls;
let currentFrameId = -1;

let pointUpdateFlag = false;
let pointCloud = new PointCloud();

let grid;


let previousSphere;


export async function init() {



    // create a scene, that holds all elements such as cameras and points.
    scene = new THREE.Scene();


    // create a stats for showing graphic update rate
    // place on the left-up corner
    graphicStats = new Stats();
    graphicStats.setMode(0); // 0: fps, 1: ms
    graphicStats.domElement.style.position = "absolute";
    graphicStats.domElement.style.left = "0px";
    graphicStats.domElement.style.top = "0px";
    document.getElementById("Stats-output").appendChild(graphicStats.domElement);

    // create a stats for showing current frame update rate
    // place bellow of graphicStats
    trackStats = new Stats();
    trackStats.setMode(0);
    trackStats.domElement.style.position = "absolute";
    trackStats.domElement.style.left = "0px";
    trackStats.domElement.style.top = "48px";
    document.getElementById("Stats-output").appendChild(trackStats.domElement);

    // create a camera
    camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(21.3, 27.7, 31);
    camera.lookAt(18.6, 25.3, 30.5)

    camera2 = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 1, 1000);

    camera2.position.set(0, 40, 0);
    camera2.lookAt(0, 0, 0);
    camera.add(camera2);

    scene.add(camera);
    const dirLight = new THREE.DirectionalLight(null, 2)
    dirLight.position.set(0, 20, 0)
    dirLight.lookAt(15, 30, 37)
    scene.add(dirLight)

    initThumbnail();
    initGui();



    // create a render and set the setSize
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setClearColor(new THREE.Color(BACKGROUND_COLOR));
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // create grid plane
    grid = new THREE.GridHelper(500, 50);
    // scene.add(grid);

    // Origin Lines
    const axesHelper = new THREE.AxesHelper(5);
    // scene.add(axesHelper);

    // add the output of the renderer to the html element
    // this line must be before initialization TrackBallControls (othrewise, dat.gui won't be work).
    document.getElementById("WebGL-output").appendChild(renderer.domElement);

    window.addEventListener('resize', onResize, false);

    controls = new CameraRotationControls(camera, renderer.domElement);

    // Add click event listener for keyframe navigation
    renderer.domElement.addEventListener('auxclick', onDocumentClick, false);

    onResize();

    // Setup
    const points = (await (await fetch("/points/")).json())
    const edges = (await (await fetch("/edges/")).json())

    console.log("Edges", edges.length)
    console.log("Points", points.length)
    receiveAPI(points, edges)

    // animation render function
    render();

}


function changeCurrentFrameById(id) {
    cameraFrames.updateCurrentFrame(cameraFrames.keyframePoses[cameraFrames.keyframeIndices[id]])
}

function initGui() {
    const gui = new dat.GUI();
    gui.add(camera.position, 'x', -500, 500).name("Pos x").step(0.1);
    gui.add(camera.position, 'y', -500, 500).name("Pos y").step(0.1);
    gui.add(camera.position, 'z', -500, 500).name("Pos z").step(0.1);
    gui.add(camera.rotation, 'x', 0, 2 * Math.PI).name("Rot x").step(0.01);
    gui.add(camera.rotation, 'y', 0, 2 * Math.PI).name("Rot y").step(0.01);
    gui.add(camera.rotation, 'z', 0, 2 * Math.PI).name("Rot z").step(0.01);
    let val = { id: 0 }
    gui.add(val, "id").name("Current_id").step(1).onFinishChange(() => {
        console.log("Changing!")
        changeCurrentFrameById(val.id)
    })
}


// render method that updates each stats, camera frames, view controller, and renderer.
function render() {

    requestAnimationFrame(render);

    graphicStats.update();

    pointCloud.updatePointInScene(scene);
    cameraFrames.updateFramesInScene(scene, currentFrameId);

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);

    renderer.clearDepth();

    renderer.setScissorTest(true);
    renderer.setScissor(window.innerWidth - insetWidth - 16, window.innerHeight - insetHeight - 16, insetWidth, insetHeight);
    renderer.setViewport(window.innerWidth - insetWidth - 16, window.innerHeight - insetHeight - 16, insetWidth, insetHeight);

    // render using requestAnimationFrame

    // render the Scene
    renderer.render(scene, camera2);
    renderer.setScissorTest(false);
}

// Handle mouse click for navigating to keyframes
function onDocumentClick(event) {
    event.preventDefault();
    console.log("click")

    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cameraFrames.keyframeObjects);
    if (intersects.length > 0) {
        console.log(intersects)

        let index = 0;
        while (index < intersects.length - 1 && (intersects[index].distance <= 4 || intersects[index].distance > 20)/* Prevent jumping absurdly long distances */) {
            index++;
        }
        let keyframeId = intersects[index].object.userData.id;
        let point = intersects[index].point;

        // TODO: Handle case the raycaster intersects with the 'current' keyframe
        teleportToClickedKeyFrame(keyframeId, point);
    }
}



function getYRotation(matrix) {
    // Ensure the matrix is 4x4
    if (matrix.length !== 4 || matrix[0].length !== 4 || matrix[1].length !== 4 || matrix[2].length !== 4 || matrix[3].length !== 4) {
        throw new Error("Invalid matrix size. Expected a 4x4 matrix.");
    }

    // Extract the relevant elements
    const m11 = matrix[0][0];
    const m31 = matrix[2][0];

    // Calculate the rotation angle around the Y-axis
    const rotationY = Math.atan2(m31, m11);

    return rotationY; // Rotation in radians
}




const sphereRadius = 50;
const sphereWidthDivisions = 60;
const sphereHeightDivisions = 40;

function teleportToClickedKeyFrame(keyframeId, point) {
    let index = cameraFrames.keyframeIndices[keyframeId];

    console.log("Clicked keyframe: ", keyframeId, "Index in array:", index,);

    cameraFrames.updateCurrentFrame(cameraFrames.keyframePoses[index]);

    // cameraFrames.setNeighbourVisibility(keyframeId);
    // cameraFrames.setGraphVisibility(true);
}


export function receiveAPI(keyframeRows, edgeRows = []) {

    let keyframes = [];
    let edges = [];
    let points = [];
    let referencePointIds = [];
    let currentFramePose = [];

    const obj = { keyframes: keyframeRows, edges: edgeRows }

    loadAPIData(obj, keyframes, edges, points, referencePointIds, currentFramePose);
    console.log(keyframes, edges.length)
    updateMapElements(keyframeRows.length + edgeRows.length, keyframes, edges, points, referencePointIds, currentFramePose);

}

function loadAPIData(obj, keyframes, edges, points, referencePointIds, currentFramePose) {
    for (let keyframeObj of obj.keyframes) {
        let keyframe = {};
        keyframe["id"] = keyframeObj.keyframe_id;
        if (keyframeObj.pose != undefined) {
            keyframe["camera_pose"] = [];
            console.log(keyframeObj.pose)
            array2mat44(keyframe["camera_pose"], keyframeObj.pose);
        }
        keyframes.push(keyframe);
    }
    for (let edgeObj of obj.edges) {
        edges.push([edgeObj.keyframe_id0, edgeObj.keyframe_id1])
    }
}


function updateMapElements(msgSize, keyframes, edges, points, referencePointIds, currentFramePose) {
    trackStats.update();

    if (cameraFrames.numValidKeyframe == 0 && keyframes.length == 0) {
        return;
    }

    for (let point of points) {
        let id = point["id"];
        if (point["point_pos"] == undefined) {
            pointCloud.removePoint(id);
        }
        else {
            let x = point["point_pos"][0] * GLOBAL_SCALE;
            let y = point["point_pos"][1] * GLOBAL_SCALE;
            let z = point["point_pos"][2] * GLOBAL_SCALE;
            let r = point["rgb"][0];
            let g = point["rgb"][1];
            let b = point["rgb"][2];
            pointCloud.updatePoint(id, x, y, z, r, g, b);
        }
    }
    for (let keyframe of keyframes) {
        let id = keyframe["id"];
        if (keyframe["camera_pose"] == undefined) {
            cameraFrames.removeKeyframe(id);
        }
        else {
            cameraFrames.updateKeyframe(id, keyframe["camera_pose"]);
        }
    }
    cameraFrames.setEdges(edges);

    let currentMillis = new Date().getTime();
    if (receiveTimestamp != 0) {
        let dt = currentMillis - receiveTimestamp;
        if (dt < 2) dt = 2;
        let fps = 1000.0 / dt;
        // adaptive update rate
        //viewControls.updateSmoothness(fps);
        console.log(("         " + parseInt(msgSize / 1000)).substr(-6) + " KB"
            + ("     " + (fps).toFixed(1)).substr(-7) + " fps, "
            + ("         " + pointCloud.nValidPoint).substr(-6) + " pts, "
            + ("         " + cameraFrames.numValidKeyframe).substr(-6) + " kfs");
    }
    receiveTimestamp = currentMillis;

    pointCloud.colorizeReferencePoints(referencePointIds);

}

function removeAllElements() {
    for (let id in pointCloud.vertexIds) {
        if (id < 0 || id == undefined) {
            continue;
        }
        pointCloud.removePoint(id);
    }
    for (let id in cameraFrames.keyframeIndices) {
        if (id < 0 || id == undefined) {
            continue;
        }
        cameraFrames.removeKeyframe(id);
    }
    cameraFrames.setEdges([]);
}


// window resize function
// The function is called in index.ejs
export function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    insetWidth = window.innerHeight / 4;
    insetHeight = window.innerHeight / 4;
    camera2.aspect = insetWidth / insetHeight;
    camera2.updateProjectionMatrix();
}

let thumbEnlarge = false; // if thumbnail is clicked, that is enlarged and this flag is set
// thumbnail image resolution
function initThumbnail() {
    let thumb = document.getElementById("thumb");
    thumb.style.width = THUMB_HEIGHT * 2 + 'px';
    thumb.style.height = THUMB_HEIGHT + 'px';
    thumb.style.transition = 'all 0.5s ease-in-out'; // enable animation when enlarge and shrinking
    thumb.style.zIndex = '10001'; // thumbnail is drawn over two stats
    thumb.setAttribute("width", CANVAS_SIZE[0]);
    thumb.setAttribute("height", CANVAS_SIZE[1]);
    thumb.addEventListener('click', onThumbClick);

}
function onThumbClick() {

    thumbEnlarge = !thumbEnlarge; // inverse flag
    if (!thumbEnlarge) {
        document.getElementById("thumb").style.transform = 'translate(0px, 0px) scale(1)';
    }
    else {
        let x = THUMB_HEIGHT * (THUMB_SCALING - 1);
        let y = THUMB_HEIGHT / 2 * (THUMB_SCALING - 1);
        document.getElementById("thumb").style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + THUMB_SCALING + ')';
    }

}



export default init;
