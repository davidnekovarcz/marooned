import * as THREE from "three";

/** Kenney-style stand-in — vendor packs have no fishing-rod mesh. */
export function makeFishingPole(): THREE.Group {
  const root = new THREE.Group();
  root.name = "fishingPole";
  const wood = new THREE.MeshLambertMaterial({ color: 0x6a4a32 });
  const cane = new THREE.MeshLambertMaterial({ color: 0xc4a574 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a332c });
  const cord = new THREE.MeshLambertMaterial({ color: 0xd8d0c4 });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.28, 6), wood);
  shaft.position.y = 0.64;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.012, 0.32, 5), cane);
  tip.position.y = 1.42;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 8), dark);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.04, 0.26, 0);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.52, 4), cord);
  line.position.set(0.015, 1.32, 0.26);
  line.rotation.x = 0.42;
  root.add(shaft, tip, reel, line);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  return root;
}
