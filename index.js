import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "jsm/loaders/RGBELoader.js";

/** Variants config: label + file path */
const VARIANTS = {
  plus1pm: { label: "Shelly Plus 1PM", url: "./assets/shelly2.glb", scale: 1 },
  plus2pm: { label: "Shelly Plus 2PM", url: "./assets/shelly.glb", scale: 1 },
  plusi4:  { label: "Shelly Plus i4",  url: "./assets/shelly1.glb", scale: 1 },
  duorgbw: { label: "Shelly Duo RGBW", url: "./assets/duo_rgbw.glb", scale: 1 },
  pro1:  { label: "Shelly Pro 1",  url: "./assets/pro1.glb", scale: 1 },
  pro1pm:  { label: "Shelly Pro 1PM",  url: "./assets/pro1pm.glb", scale: 1 },
  pro2pm:  { label: "Shelly Pro 2PM",  url: "./assets/pro2pm.glb", scale: 1 },
  pro1dimmer:  { label: "Shelly Pro Dimmer1PM",  url: "./assets/pro1dimmer.glb", scale: 1 },
  pro3em:  { label: "Shelly Pro 3EM",  url: "./assets/pro3em.glb", scale: 1 },
};

// --- Three.js setup ----------------------------------------------------------
const w = window.innerWidth, h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); // default dark gray

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
  placeGridAtModelFloor(model);
  setStatus(`Loaded: ${cfg.label}`);
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

// --- Grid Helper ------------------------------------------------------------
const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
grid.material.opacity = 0.35;
grid.material.transparent = true;
grid.visible = false;
scene.add(grid);

function placeGridAtModelFloor(object3D) {
  const box = new THREE.Box3().setFromObject(object3D);
  grid.position.y = box.min.y;
}

// --- Buttons wiring ---------------------------------------------------------
const btnAuto = document.getElementById("btnAuto");
const btnBg   = document.getElementById("btnBg");
const btnGrid = document.getElementById("btnGrid");

// create a small status line under the panel row (no HTML edit needed)
const panelEl = document.querySelector(".panel");
const statusEl = document.createElement("div");
statusEl.id = "status";
statusEl.style.marginTop = "8px";
statusEl.style.opacity = "0.75";
statusEl.style.fontSize = "12px";
panelEl.appendChild(statusEl);

function setStatus(text) {
  statusEl.textContent = text || "";
}

btnAuto.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  btnAuto.setAttribute("aria-pressed", String(controls.autoRotate));
  setStatus(`Auto-rotate: ${controls.autoRotate ? "ON" : "OFF"}`);
});

// Background toggle FIX:
// Instead of toggling the page body, toggle the THREE background + gradient layer.
let bgOn = true;                          // default ON (matches initial scene)
btnBg.setAttribute("aria-pressed", "true");
btnBg.addEventListener("click", () => {
  bgOn = !bgOn;

  // show/hide the gradient sprites
  gradientBackground.visible = bgOn;

  // switch scene clear color to emphasize change
  scene.background = new THREE.Color(bgOn ? 0x1a1a1a : 0x111111);
  renderer.setClearColor(scene.background, 1);

  btnBg.setAttribute("aria-pressed", String(bgOn));
  setStatus(`Background: ${bgOn ? "ON" : "OFF"}`);
});

btnGrid.addEventListener("click", () => {
  grid.visible = !grid.visible;
  btnGrid.setAttribute("aria-pressed", String(grid.visible));
  setStatus(`Grid: ${grid.visible ? "ON" : "OFF"}`);
});

// --- Variant selector & recenter -------------------------------------------
const selectEl = document.getElementById("variant");
const recenterBtn = document.getElementById("recenter");

selectEl.addEventListener("change", () => setVariant(selectEl.value));
recenterBtn.addEventListener("click", () => {
  if (currentModel) {
    frameObject(currentModel, camera, controls);
    setStatus("Re-centered");
  }
});

// Load initial model
setVariant(selectEl.value);

// --- Render loop & resize ---------------------------------------------------
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
