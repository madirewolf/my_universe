"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface NebulaProps {
  variant: "dark" | "bright"
}

interface CloudConfig {
  color: string
  pos: [number, number, number]
  rot: [number, number, number]
  size: number
  opacity: number
  swirl: number
}

// First 6: original cluster on the -Z hemisphere. Last 3: scattered across
// +Z and the side flanks so the user sees nebula coverage from any angle
// after rotating the camera. ~50% more clouds total per universe.
const PROF_CLOUDS: CloudConfig[] = [
  { color: "#00695c", pos: [-110, 20, -130], rot: [0.3, 0.5, 0.0], size: 160, opacity: 0.55, swirl: 1.0 },
  { color: "#00838f", pos: [120, -15, -100], rot: [-0.4, 0.8, 0.2], size: 150, opacity: 0.5, swirl: 0.8 },
  { color: "#00a896", pos: [-40, 60, -150], rot: [0.6, 0.2, -0.3], size: 110, opacity: 0.45, swirl: 1.3 },
  { color: "#26a69a", pos: [80, 70, -120], rot: [0.1, -0.5, 0.4], size: 130, opacity: 0.4, swirl: 0.9 },
  { color: "#00796b", pos: [-90, -30, -160], rot: [-0.2, 1.0, 0.0], size: 140, opacity: 0.55, swirl: 1.1 },
  { color: "#00acc1", pos: [60, -50, -140], rot: [0.5, -0.3, 0.7], size: 120, opacity: 0.4, swirl: 1.0 },
  // ── Scatter set ─────────────────────────────────────────────────────────
  { color: "#00897b", pos: [-30, 50, 140], rot: [0.2, -1.4, 0.3], size: 140, opacity: 0.48, swirl: 0.95 },
  { color: "#006064", pos: [80, -45, 130], rot: [-0.3, 1.6, -0.2], size: 130, opacity: 0.5, swirl: 1.1 },
  { color: "#00b8a9", pos: [-140, 10, 30], rot: [0.4, -0.9, 0.6], size: 125, opacity: 0.42, swirl: 1.0 },
]

const PERS_CLOUDS: CloudConfig[] = [
  { color: "#ff80c8", pos: [-100, 30, -130], rot: [0.3, 0.5, 0.0], size: 160, opacity: 0.6, swirl: 1.0 },
  { color: "#a070ff", pos: [110, -20, -110], rot: [-0.4, 0.8, 0.2], size: 150, opacity: 0.55, swirl: 0.8 },
  { color: "#ffd060", pos: [-50, 70, -150], rot: [0.6, 0.2, -0.3], size: 110, opacity: 0.45, swirl: 1.4 },
  { color: "#80f0ff", pos: [70, 60, -130], rot: [0.1, -0.5, 0.4], size: 130, opacity: 0.5, swirl: 0.9 },
  { color: "#ffb080", pos: [-90, -40, -160], rot: [-0.2, 1.0, 0.0], size: 140, opacity: 0.5, swirl: 1.1 },
  { color: "#c0ffe0", pos: [90, -60, -150], rot: [0.5, -0.3, 0.7], size: 120, opacity: 0.42, swirl: 1.2 },
  // ── Scatter set ─────────────────────────────────────────────────────────
  { color: "#ff6090", pos: [-40, 55, 130], rot: [0.2, -1.4, 0.3], size: 140, opacity: 0.55, swirl: 0.95 },
  { color: "#ffa040", pos: [85, -35, 140], rot: [-0.3, 1.6, -0.2], size: 130, opacity: 0.5, swirl: 1.1 },
  { color: "#d0ffe0", pos: [-145, 5, 35], rot: [0.4, -0.9, 0.6], size: 125, opacity: 0.45, swirl: 1.0 },
]

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
varying vec2 vUv;
uniform float time;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSwirl;

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
    mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm2(vec2 p) {
  float a = 0.0;
  float amp = 0.5;
  // Five octaves are visually indistinguishable at this cloud scale and trim
  // the heaviest repeated work across nine large transparent planes.
  for (int i = 0; i < 5; i++) {
    a += amp * n2(p);
    p *= 2.1;
    amp *= 0.55;
  }
  return a;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;

  // Soft circular falloff so the plane reads as a cloud, not a square
  float edge = smoothstep(1.0, 0.25, r);

  // Domain-warp the noise for swirly, organic structure
  vec2 q = vec2(
    fbm2(vUv * 1.4 + vec2(time * 0.012, time * 0.005)),
    fbm2(vUv * 1.4 + vec2(4.7, time * 0.009))
  );
  float n = fbm2(vUv * 2.6 * uSwirl + q * 1.6);
  n = pow(n, 1.4);

  float density = smoothstep(0.18, 0.85, n) * edge;

  // Subtle inner color variation
  vec3 color = uColor * (0.85 + 0.45 * fbm2(vUv * 7.0));
  // Hot core toward bright spots
  color += vec3(0.25, 0.18, 0.35) * smoothstep(0.65, 1.0, n);

  gl_FragColor = vec4(color, density * uOpacity);
}
`

export default function Nebula({ variant }: NebulaProps) {
  const matRefs = useRef<(THREE.ShaderMaterial | null)[]>([])
  const clouds = variant === "bright" ? PERS_CLOUDS : PROF_CLOUDS

  useFrame((state) => {
    const t = state.clock.elapsedTime
    matRefs.current.forEach((m) => {
      if (m) m.uniforms.time.value = t
    })
  })

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh key={`${variant}-${i}`} position={c.pos} rotation={c.rot}>
          <planeGeometry args={[c.size, c.size]} />
          <shaderMaterial
            ref={(el) => {
              matRefs.current[i] = el
            }}
            vertexShader={VERT}
            fragmentShader={FRAG}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            uniforms={{
              time: { value: 0 },
              uColor: { value: new THREE.Color(c.color) },
              uOpacity: { value: c.opacity },
              uSwirl: { value: c.swirl },
            }}
          />
        </mesh>
      ))}
    </group>
  )
}
