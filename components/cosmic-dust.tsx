"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface CosmicDustProps {
  variant: "dark" | "bright"
}

const PROF_PALETTE: [number, number, number][] = [
  [0.55, 0.65, 1.00], // ice blue
  [0.95, 0.50, 0.95], // magenta
  [0.70, 0.60, 1.00], // violet
  [0.90, 0.95, 1.00], // white
  [0.50, 0.85, 1.00], // cyan
]

const PERS_PALETTE: [number, number, number][] = [
  [1.00, 0.75, 0.95], // pink
  [0.90, 0.75, 1.00], // lavender
  [1.00, 0.95, 0.80], // peach
  [0.85, 1.00, 0.95], // mint
  [1.00, 0.85, 0.70], // gold
]

const VERT = /* glsl */ `
attribute vec3  aColor;
attribute vec3  aVelocity;
attribute float aSize;
attribute float aPhase;
uniform float   uTime;
varying vec3  vColor;
varying float vOpacity;

void main() {
  vColor = aColor;
  // Slow drift — wraps loosely via sine so particles never escape
  vec3 drift = aVelocity * 6.0 * sin(uTime * 0.04 + aPhase * 0.5);
  vec3 p = position + drift;

  float flicker = 0.7 + 0.3 * sin(uTime * 0.7 + aPhase);
  vOpacity = flicker;

  vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * (220.0 / -mvPos.z);
  gl_Position  = projectionMatrix * mvPos;
}
`

const FRAG = /* glsl */ `
varying vec3  vColor;
varying float vOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  float core = smoothstep(0.32, 0.0, d);
  float halo = exp(-d * d * 5.5) * 0.45;

  float alpha = (core * 0.65 + halo) * vOpacity;
  if (alpha < 0.005) discard;

  vec3 color = mix(vColor, vec3(1.0), core * 0.4);
  gl_FragColor = vec4(color, alpha);
}
`

export default function CosmicDust({ variant }: CosmicDustProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const data = useMemo(() => {
    const palette = variant === "bright" ? PERS_PALETTE : PROF_PALETTE
    const N = 900
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const vel = new Float32Array(N * 3)
    const sizes = new Float32Array(N)
    const phases = new Float32Array(N)

    for (let i = 0; i < N; i++) {
      // Sphere shell distribution between 50–150 from origin
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 50 + Math.random() * 100

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      // Random drift direction; magnitude scaled in shader
      const vx = (Math.random() - 0.5) * 0.5
      const vy = (Math.random() - 0.5) * 0.5
      const vz = (Math.random() - 0.5) * 0.5
      vel[i * 3] = vx
      vel[i * 3 + 1] = vy
      vel[i * 3 + 2] = vz

      const c = palette[Math.floor(Math.random() * palette.length)]
      col[i * 3] = c[0]
      col[i * 3 + 1] = c[1]
      col[i * 3 + 2] = c[2]

      sizes[i] = 1.5 + Math.pow(Math.random(), 2.2) * 5.0
      phases[i] = Math.random() * Math.PI * 2
    }

    return { pos, col, vel, sizes, phases, N }
  }, [variant])

  useFrame((s) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = s.clock.elapsedTime
  })

  return (
    <points key={variant}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={data.N} array={data.pos} itemSize={3} />
        <bufferAttribute attach="attributes-aColor" count={data.N} array={data.col} itemSize={3} />
        <bufferAttribute attach="attributes-aVelocity" count={data.N} array={data.vel} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={data.N} array={data.sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase" count={data.N} array={data.phases} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </points>
  )
}
