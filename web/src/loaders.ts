import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const gltfLoader = new GLTFLoader();

export function prepareTemplate(root: THREE.Object3D): THREE.Object3D {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.metalness !== undefined) {
        std.metalness = 0;
        std.roughness = 0.82;
      }
    }
  });
  return root;
}

export async function loadGlb(url: string): Promise<THREE.Object3D> {
  const gltf = await gltfLoader.loadAsync(url);
  return prepareTemplate(gltf.scene);
}

export async function loadObj(url: string, color = 0x3a7a32): Promise<THREE.Object3D> {
  const obj = await new OBJLoader().loadAsync(url);
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = new THREE.MeshLambertMaterial({ color });
  });
  return prepareTemplate(obj);
}
