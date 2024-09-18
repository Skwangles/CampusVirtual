import * as THREE from 'three';

import { CURRENT_FRAME_COLOR, KEYFRAME_COLOR, EDGE_COLOR, BACKGROUND_COLOR, REFERENCE_POINT_COLOR, GLOBAL_SCALE } from './consts.js';
import { property } from './context.js';
import { inv } from './utils.js';

export default class CameraFrames {

    constructor() {

        /* Camera componet */
        this.CURRENT_FRAME_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x0000FF })
        this.KEYFRAME_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xFF0000 })
        this.EDGE_MATERIAL = new THREE.LineBasicMaterial({ color: EDGE_COLOR });

        this.keyframeIndices = [];
        this.keyframeObjects = [];
        this.keyframePoses = [];
        this.addedKeyframeIndices = [];
        this.removedPool = [];
        this.removedPoolSize = 0;

        this.debug_see_all = true;

        this.totalFrameCount = 0;
        this.numValidKeyframe = 0;

        this.POOL_KEYFRAME_POSE = [[1, 0, 0, 0], [0, 1, 0, -100000], [0, 0, 1, 0]];

        this.currentFrameWireSize = property.CurrentFrameSize
        this.keyframeWireSize = property.KeyframeSize

        let wireFrame = this.makeWireframe(this.POOL_KEYFRAME_POSE, this.currentFrameWireSize, this.CURRENT_FRAME_MATERIAL);
        this.currentFrame = wireFrame
        this.flagCurrentFrameInScene = false;
        this.currentFramePose = this.POOL_KEYFRAME_POSE;



        let lineaGeometry = new THREE.Geometry();
        this.edges = new THREE.LineSegments(lineaGeometry, this.EDGE_MATERIAL);
        this.edges.userData = { keyframes: {} };
        this.flagEdgesInScene = false;
    }


    cleanGraph() {
        let remove = [];
        // Find straggler keyframes
        for (let id in this.keyframeIndices) {
            if (this.edges.userData.keyframes[id].length < 2) {
                remove.push(id);
            }
        }

        // Remove straggler keyframes after finding to avoid modifying the object while iterating
        for (let id of remove) {
            this.removeKeyframe(id);

            for (let edge of this.edges.userData.keyframes[id]) {
                let neighbourId = edge.to;
                this.edges.userData.keyframes[neighbourId] = this.edges.userData.keyframes[neighbourId].filter(e => e.to !== id);

            }
            delete this.edges.userData.keyframes[id];
        }
    }


    // private methods

    addKeyframe(id, pose) {

        if (this.removedPoolSize > 0) {
            let index = this.removedPool.pop();
            this.removedPoolSize--;

            this.keyframeIndices[id] = index;
            this.changeKeyframePos(index, pose);
        }
        else {
            let wireFrame = this.makeWireframe(pose, this.keyframeWireSize);

            let keyframeObject = wireFrame

            this.keyframeIndices[id] = this.totalFrameCount;
            this.addedKeyframeIndices.push(this.totalFrameCount);

            keyframeObject.userData = { id: id };

            this.keyframeObjects[this.totalFrameCount] = keyframeObject;
            this.keyframePoses[this.totalFrameCount] = pose;

            this.totalFrameCount++;
        }

        this.numValidKeyframe++;
    }

    removeKeyframe(id) {

        let index = this.keyframeIndices[id];

        if (this.keyframeIndices[id] < 0 || index === undefined)
            return;

        this.changeKeyframePos(index, this.POOL_KEYFRAME_POSE);

        this.keyframeIndices[id] = -1;
        this.removedPool.push(index);
        this.removedPoolSize++;

        this.numValidKeyframe--;
    }

    changeKeyframePos(index, pose) {

        let orb = this.makeWireframe(pose, this.keyframeWireSize);

        this.keyframeObjects[index] = orb;
        this.keyframePoses[index] = pose;
    }


    positionFromPose(pose_) {
        const pose = inv(pose_);
        let Ox = pose[0][3] * GLOBAL_SCALE; let Oy = -pose[1][3] * GLOBAL_SCALE; let Oz = pose[2][3] * GLOBAL_SCALE;
        return [Ox, Oy, Oz]
    }

    makeWireframe(pose_, size, material = this.KEYFRAME_MATERIAL) {
        const [Ox, Oy, Oz] = this.positionFromPose(pose_)

        const geometry = new THREE.SphereGeometry(size * GLOBAL_SCALE);
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(Ox, Oy, Oz);
        return sphere;
    }



    // public methods

    updateKeyframe(id, pose) {
        let index = this.keyframeIndices[id];

        if (index < 0 || index === undefined) {
            this.addKeyframe(id, pose);
        }
        else {
            this.changeKeyframePos(index, pose);
        }
    }

    updateCurrentFrame(pose) {
        // this.flagCurrentFrameInScene = false;
        // let orb = this.makeWireframe(pose, this.currentFrameWireSize, this.CURRENT_FRAME_MATERIAL);
        this.currentFrame.position.set(...this.positionFromPose(pose));
        this.currentFramePose = pose;
    }


    setKeyframeSize(val) {
        this.keyframeWireSize = val;
        for (let index of this.keyframeIndices) {
            if (index < 0 || index == undefined) {
                continue;
            }
            this.changeKeyframePos(index, this.keyframePoses[index]);
        }
    }

    setCurrentFrameSize(val) {
        this.currentFrameWireSize = val;
        this.currentFrame = this.makeWireframe(this.currentFramePose, val, this.CURRENT_FRAME_MATERIAL);
    }

    setCurrentFrameVisibility(visibility) {
        this.currentFrame.visible = visibility;
    }

    setNeighbourVisibility(id) {

        // console.log(this.keyframeObjects)
        for (let index in this.addedKeyframeIndices) {
            this.keyframeObjects[index].visible = false;
        }

        // Hide the current frame to avoid Raycaster issues
        this.keyframeObjects[this.keyframeIndices[id]].visible = false;

        this.setKeyframeEdgesVisibility(id);
    }

    updateFramesInScene(scene, currentFrameId = -1) {

        if (!this.flagEdgesInScene) {
            this.flagEdgesInScene = true;

            scene.add(this.edges);
            console.log("Edges added")
        }

        if (currentFrameId !== -1 && !this.debug_see_all) {
            for (let edge of this.edges.userData.keyframes[currentFrameId]) {
                let neighbourId = edge.to;
                this.keyframeObjects[this.keyframeIndices[neighbourId]].visible = true;
                scene.add(this.keyframeObjects[this.keyframeIndices[neighbourId]]);
            }
        }
        else {
            for (let index in this.addedKeyframeIndices) {
                this.keyframeObjects[index].visible = true;
                scene.add(this.keyframeObjects[index]);
            }
        }

        if (!this.flagCurrentFrameInScene) {
            console.log("Current flag is being added")
            this.flagCurrentFrameInScene = true;
            scene.add(this.currentFrame);
        }
    }

    setEdges(edges) {
        let lineGeometry = new THREE.Geometry();
        this.edges.userData.keyframes = {}; // Reset edges by keyframe ID

        for (let edge of edges) {
            const keyframeID0 = edge[0];
            const keyframeID1 = edge[1];
            let id0 = this.keyframeIndices[keyframeID0];
            let id1 = this.keyframeIndices[keyframeID1];
            if (id0 === undefined || id1 === undefined) {
                continue;
            }
            let pose0 = inv(this.keyframePoses[id0]);
            let pose1 = inv(this.keyframePoses[id1]);

            let x1 = pose0[0][3] * GLOBAL_SCALE; let y1 = -pose0[1][3] * GLOBAL_SCALE; let z1 = pose0[2][3] * GLOBAL_SCALE;
            let x2 = pose1[0][3] * GLOBAL_SCALE; let y2 = -pose1[1][3] * GLOBAL_SCALE; let z2 = pose1[2][3] * GLOBAL_SCALE;

            lineGeometry.vertices.push(new THREE.Vector3(x1, y1, z1));
            lineGeometry.vertices.push(new THREE.Vector3(x2, y2, z2));

            if (!this.edges.userData.keyframes[keyframeID0]) {
                this.edges.userData.keyframes[keyframeID0] = [];
            }
            if (!this.edges.userData.keyframes[keyframeID1]) {
                this.edges.userData.keyframes[keyframeID1] = [];
            }
            this.edges.userData.keyframes[keyframeID0].push({ to: keyframeID1, edges: [new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)] });
            this.edges.userData.keyframes[keyframeID1].push({ to: keyframeID0, edges: [new THREE.Vector3(x2, y2, z2), new THREE.Vector3(x1, y1, z1)] });
        }
        console.log("Edges set")
        let oldLineGeometry = this.edges.geometry;
        this.edges.geometry = lineGeometry;
        this.edges.visible = true;
        oldLineGeometry.dispose();
    }

    // Method to look up edges for a specific keyframe ID
    getEdgesForKeyframe(keyframeID) {
        return this.edges.userData.keyframes[keyframeID] || [];
    }

    // Method to set edges visibility of a specific keyframe
    setKeyframeEdgesVisibility(keyframeID) {
        let edges = this.getEdgesForKeyframe(keyframeID);

        let lineGeometry = new THREE.Geometry();
        for (let edge of edges) {
            const keyframeID = this.keyframeIndices[edge.to];
            this.keyframeObjects[keyframeID].visible = true;

            lineGeometry.vertices.push(edge.edges[0]);
            lineGeometry.vertices.push(edge.edges[1]);
        }

        let oldLineGeometry = this.edges.geometry;
        this.edges.geometry = lineGeometry;
        oldLineGeometry.dispose();
    }

    // Method to set overall graph visibility
    setGraphVisibility(visible) {
        this.edges.visible = visible;
    }

}
