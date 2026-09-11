import * as THREE from "three";
import { CENTER, ISLAND_RADIUS, POND_RADIUS, POND_X, POND_Z, WATER, WATER_Y } from "@/web/src/constants";

export type Ocean = {
  mesh: THREE.Mesh;
  update: (elapsed: number, rain?: number) => void;
};

export function buildOcean(): Ocean {
  const geo = new THREE.PlaneGeometry(420, 420, 160, 160);
  const mat = new THREE.MeshLambertMaterial({ color: WATER });
  const uTime = { value: 0 };
  const uRain = { value: 0 };
  const uIsland = { value: new THREE.Vector3(CENTER, CENTER, ISLAND_RADIUS) };
  const uPond = { value: new THREE.Vector3(POND_X, POND_Z, POND_RADIUS) };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uRain = uRain;
    shader.uniforms.uIsland = uIsland;
    shader.uniforms.uPond = uPond;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime;
uniform float uRain;
uniform vec3 uIsland;
uniform vec3 uPond;
varying float vWave;
float waveAmp(vec2 xz) {
  float islandD = length(xz - uIsland.xy);
  float shore = smoothstep(uIsland.z - 0.8, uIsland.z + 0.6, islandD);
  float pondD = length(xz - uPond.xy);
  float pond = smoothstep(uPond.z + 0.5, uPond.z + 3.0, pondD);
  return shore * pond * (1.0 + uRain * 0.85);
}
float waveHeight(vec2 xz) {
  float amp = waveAmp(xz);
  return amp * (
    sin(xz.x * 0.18 + uTime * (0.72 + uRain * 0.55)) * 0.38
    + sin(xz.y * 0.14 + uTime * (0.55 + uRain * 0.4)) * 0.30
    + sin((xz.x * 0.41 + xz.y * 0.22) + uTime * (1.15 + uRain)) * 0.16
    + sin((xz.x + xz.y) * 0.62 + uTime * 1.55) * 0.08
  );
}
`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec2 worldXZ = (modelMatrix * vec4(position, 1.0)).xz;
float h = waveHeight(worldXZ);
vWave = waveAmp(worldXZ) * smoothstep(-0.15, 0.55, h);
transformed.z += h;
`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vWave;
`,
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `vec4 diffuseColor = vec4( diffuse, opacity );
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.45 + vec3(0.12, 0.16, 0.14), vWave);
`,
      );
  };
  mat.customProgramCacheKey = () => "marooned-ocean-waves-v3";

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(CENTER, WATER_Y, CENTER);
  mesh.receiveShadow = true;
  mesh.name = "ocean";
  return {
    mesh,
    update: (elapsed: number, rain = 0) => {
      uTime.value = elapsed;
      uRain.value = rain;
    },
  };
}
