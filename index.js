import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "jsm/loaders/RGBELoader.js";

/** Variants config: label + file path */
const VARIANTS = {
  plus1pm: { label: "Shelly Plus 1PM", url: "./assets/shelly2.glb", scale: 1 },
  plus2pm: { label: "Shelly Plus 2PM", url: "./assets/shelly.glb", scale: 1 },
  plusi4:  { label: "Shelly Plus i4",  url: "./assets/shelly1.glb", scale: 1 }
};

// --- Three.js setup ----------------------------------------------------------
const w = window.innerWidth, h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
camera.position.set(3, 2, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Lighting ---------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.6);
hemi.position.set(0, 20, 0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(5, 10, 7);
scene.add(dir);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// Optional: environment HDR map for PBR
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader()
  .setPath("https://threejs.org/examples/textures/equirectangular/")
  .load("royal_esplanade_1k.hdr", (hdrTex) => {
    const envMap = pmrem.fromEquirectangular(hdrTex).texture;
    scene.environment = envMap;
    hdrTex.dispose();
  });

// --- Gradient background sprites -------------------------------------------
const gradientBackground = getLayer({
  hue: 0.5,
  numSprites: 8,
  opacity: 0.18,
  radius: 10,
  size: 24,
  z: -15.5,
});
scene.add(gradientBackground);

// --- Model loader / variant handling ---------------------------------------
const loader = new GLTFLoader();
const cache = new Map();
let currentModel = null;

async function setVariant(name) {
  const cfg = VARIANTS[name];
  if (!cfg) return;

  if (currentModel) {
    scene.remove(currentModel);
    currentModel = null;
  }

  let model = cache.get(name);
  if (!model) {
    model = await new Promise((resolve, reject) => {
      loader.load(cfg.url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    if (cfg.scale && cfg.scale !== 1) model.scale.setScalar(cfg.scale);
    cache.set(name, model);
  }

  currentModel = model;
  scene.add(currentModel);
  frameObject(model, camera, controls);
}

function frameObject(object, cam, controls) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());

  const fitDist = size / (2 * Math.tan((cam.fov * Math.PI) / 360));
  const dir = new THREE.Vector3(1, 0.6, 1).normalize();
  cam.position.copy(center).add(dir.multiplyScalar(fitDist * 1.3));
  cam.near = size / 100;
  cam.far = size * 10;
  cam.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

// --- UI wiring --------------------------------------------------------------
const selectEl = document.getElementById("variant");
const recenterBtn = document.getElementById("recenter");

selectEl.addEventListener("change", () => setVariant(selectEl.value));
recenterBtn.addEventListener("click", () => {
  if (currentModel) frameObject(currentModel, camera, controls);
});

// Load initial
setVariant(selectEl.value);

// --- Loop & resize ----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
