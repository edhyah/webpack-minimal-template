import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

// Scene
let container;
let camera, scene, renderer;
let hand1, hand2;
let hand1Initialized = false;
let hand2Initialized = false;
let handsInitialized = false;
let controls;
let group;  // Group of objects in the scene (not including transform axes)

// Detect when xr session is really started (when the event `sessionstart` is
// fired, fields like `renderer.xr.xrFrame` are still null)
let firstXRFrameRendered = false;
let secondXRFrameRendered = false;

init();
animate();

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202020);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 3);

    controls = new OrbitControls(camera, container);
    controls.target.set(0, 1.6, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(0x808080, 0x606060));
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 6, 0);
    light.castShadow = true;
    light.shadow.camera.top = 2;
    light.shadow.camera.bottom = -2;
    light.shadow.camera.right = 2;
    light.shadow.camera.left = -2;
    light.shadow.mapSize.set(4096, 4096);
    scene.add(light);

    group = new THREE.Group();
    scene.add( group );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    initHandModels();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('beforeunload', onBeforeUnload);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onBeforeUnload() {
    console.log('Initiating cleanup...');
    scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.length) {
                for (let i = 0; i < obj.material.length; i++) {
                    obj.material[i].dispose();
                }
            }
            else obj.material.dispose();
        }
    });
    renderer.renderLists.dispose();
}

function onXRSessionInitialized() {
    //const debugObject = group.children[0];
    //moveObjectToCameraView(debugObject, scene);
}

function initHandModels() {
    const handModelFactory = new XRHandModelFactory();

    // Hand 1
    hand1 = renderer.xr.getHand(0);
    scene.add(hand1);
    hand1.add(handModelFactory.createHandModel(hand1, 'mesh'));
    hand1.addEventListener('connected', (event) => {
        hand1.handedness = event.data.handedness;
        hand1.xrInputSource = event.data;
        hand1Initialized = true;
    });
    hand1.addEventListener('pinchstart', onPinchStart);
    hand1.addEventListener('pinchend', onPinchEnd);

    // Hand 2
    hand2 = renderer.xr.getHand(1);
    scene.add(hand2);
    hand2.add(handModelFactory.createHandModel(hand2, 'mesh'));
    hand2.addEventListener('connected', (event) => {
        hand2.handedness = event.data.handedness;
        hand2.xrInputSource = event.data;
        hand2Initialized = true;
    });
    hand2.addEventListener('pinchstart', onPinchStart);
    hand2.addEventListener('pinchend', onPinchEnd);
}

// Returns world position of pinch
function getPinchPosition(hand) {
    const indexTipPosition = hand.joints['index-finger-tip'].position;
    return indexTipPosition.clone();
}

function onPinchStart(event) {
    const hand = event.target;
    return;
}

function onPinchEnd(event) {
    return;
}

// `anchor` is the anchor that the object attached to. This is needed to compute
// the camera position relative to the specified anchor. The object will be
// positioned relative to this camera position value.
//
// NOTE: Make sure to call this function after adding object to a parent (such
// as a group or an anchor) - otherwise `lookAt` will not take into account
// parent pose and may cause object to be oriented weirdly.
function moveObjectToCameraView(object, anchor) {
    const cameraPositionLocal = anchor.worldToLocal(camera.position.clone());
    const cameraDirectionLocal = camera.getWorldDirection(new THREE.Vector3());
    cameraDirectionLocal.applyQuaternion(anchor.quaternion.clone().invert());
    object.position.addVectors(cameraPositionLocal, cameraDirectionLocal.multiplyScalar(0.5));

    object.lookAt(camera.position);
}

function getLeftHand() {
    if (hand1Initialized && hand2Initialized) {
        if (hand1.handedness === 'left') return hand1;
        else return hand2;
    } else {
        return null;
    }
}

function getRightHand() {
    if (hand1Initialized && hand2Initialized) {
        if (hand1.handedness === 'right') return hand1;
        else return hand2;
    } else {
        return null;
    }
}

function getOtherHand(hand) {
    if (hand1Initialized && hand2Initialized) {
        if (hand.handedness === 'left') return getRightHand();
        else if (hand.handedness === 'right') return getLeftHand();
        else console.error('Hand does not have handedness');
    } else {
        return null;
    }
}

function animate() {
    renderer.setAnimationLoop( render );
}

function render() {

    // Even though an XR session is started, in practice XR fields like
    // `renderer.xr.xrFrame` are null. Here, we wait until the first XR frame
    // has been created, wait for it to propagate a frame update, and then
    // call `onXRSessionInitialized` to indicate that the XR session has been
    // fully initialized. Until this point, the XR camera position is not final
    // and can change.
    if (!firstXRFrameRendered && renderer.xr.getFrame()) {
        firstXRFrameRendered = true;
        renderer.render(scene, camera);
        return;
    } else if (firstXRFrameRendered && !secondXRFrameRendered) {
        secondXRFrameRendered = true;
        onXRSessionInitialized();
    }

    renderer.render(scene, camera);
}
