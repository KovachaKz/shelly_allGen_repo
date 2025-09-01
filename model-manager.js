import * as THREE from "three";
import { GLTFLoader }  from "jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "jsm/loaders/DRACOLoader.js";
import { KTX2Loader }  from "jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "jsm/libs/meshopt_decoder.module.js";

export class ModelManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);

    // Core loader
    this.gltf = new GLTFLoader();

    // Optional accelerators/codecs
    const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/libs/draco/");
    this.gltf.setDRACOLoader(draco);

    this.gltf.setMeshoptDecoder(MeshoptDecoder);

    // Optional: KTX2 (super fast GPU textures)
    this.ktx2 = new KTX2Loader()
      .setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/libs/basis/")
      .detectSupport(renderer);
  }

  async load(url, { signal, envMapHDR=null } = {}) {
    const controller = signal ? null : new AbortController();
    const abortSignal = signal || controller?.signal;

    const scene = await new Promise((resolve, reject) => {
      this.gltf.load(
        url,
        (asset) => resolve(asset),
        undefined,
        (e) => reject(e)
      );
      if (abortSignal) abortSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });

    // choose scene and animations
    const root = scene.scene || scene.scenes?.[0];
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Ensure correct color workflow (r152+):
        if (o.material?.map?.isTexture) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });

    // optional: apply HDR environment → PMREM
    if (envMapHDR) {
      const tex = await new Promise((res, rej) => {
        new (await import("jsm/loaders/RGBELoader.js").then(m => m.RGBELoader))()
          .load(envMapHDR, res, undefined, rej);
      });
      const env = this.pmrem.fromEquirectangular(tex).texture;
      root.traverse((o) => { if (o.isMesh && o.material && "envMap" in o.material) o.material.envMap = env; });
      tex.dispose();
    }

    // camera framing helpers
    const bbox = new THREE.Box3().setFromObject(root);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    return { root, bbox, size, center, animations: scene.animations ?? [] };
  }

  frameObject(object, camera, controls, padding = 1.25) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * Math.PI / 180;
    const dist = (maxDim / (2 * Math.tan(fov / 2))) * padding;
    const dir = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(center).add(dir.multiplyScalar(dist));
    camera.near = dist / 100;
    camera.far  = dist * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }
}
