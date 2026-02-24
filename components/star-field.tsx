"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

// Realistic stellar spectral colors + weights
const STAR_COLORS = [
  [0.55, 0.65, 1.00],  // O: hot blue
  [0.72, 0.84, 1.00],  // B: blue-white
  [0.93, 0.97, 1.00],  // A: white
  [1.00, 1.00, 0.92],  // F: warm white
  [1.00, 0.94, 0.72],  // G: yellow (sun-like)
  [1.00, 0.76, 0.50],  // K: orange
  [1.00, 0.50, 0.30],  // M: red-orange
]
const WEIGHTS = [0.04, 0.12, 0.16, 0.20, 0.22, 0.16, 0.10]

function pickColor() {
  const r = Math.random()
  let c = 0
  for (let i = 0; i < WEIGHTS.length; i++) {
    c += WEIGHTS[i]
    if (r < c) return STAR_COLORS[i]
  }
  return STAR_COLORS[3]
}

export default function StarField() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const stars = useMemo(() => {
    const N = 5500
    const pos    = new Float32Array(N * 3)
    const col    = new Float32Array(N * 3)
    const sizes  = new Float32Array(N)
    const phases = new Float32Array(N)
    const speeds = new Float32Array(N)

    for (let i = 0; i < N; i++) {
      // Uniform sphere distribution
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 160 + Math.random() * 140

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      const c = pickColor()
      col[i * 3]     = c[0]
      col[i * 3 + 1] = c[1]
      col[i * 3 + 2] = c[2]

      // Power-law size: mostly tiny, a few large bright ones
      const u   = Math.random()
      sizes[i]  = 0.5 + Math.pow(u, 2.5) * 9.0

      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.2 + Math.random() * 2.2
    }

    return { pos, col, sizes, phases, speeds, N }
  }, [])

  // Dense milky-way band — small, dim, white stars along a tilted great circle
  const milkyWay = useMemo(() => {
    const N   = 2200
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const sizes  = new Float32Array(N)
    const phases = new Float32Array(N)
    const speeds = new Float32Array(N)

    for (let i = 0; i < N; i++) {
      // Concentrate near a tilted plane (normal ~ [0.4, 1, 0.3])
      const theta  = Math.random() * Math.PI * 2
      const spread = (Math.random() - 0.5) * 0.55  // tight band
      const phi    = Math.PI / 2 + spread

      const r = 180 + Math.random() * 80
      let x = r * Math.sin(phi) * Math.cos(theta)
      let y = r * Math.sin(phi) * Math.sin(theta)
      let z = r * Math.cos(phi)

      // Tilt the band
      const tilt = 0.45
      const ny =  y * Math.cos(tilt) - z * Math.sin(tilt)
      const nz =  y * Math.sin(tilt) + z * Math.cos(tilt)
      pos[i * 3] = x; pos[i * 3 + 1] = ny; pos[i * 3 + 2] = nz

      // Milky way stars: soft blue-white, dim
      const brightness = 0.55 + Math.random() * 0.3
      col[i * 3]     = brightness * 0.88
      col[i * 3 + 1] = brightness * 0.92
      col[i * 3 + 2] = brightness

      sizes[i]  = 0.3 + Math.random() * 0.8   // small
      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.1 + Math.random() * 0.8   // slow twinkle
    }

    return { pos, col, sizes, phases, speeds, N }
  }, [])

  useFrame((s) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = s.clock.elapsedTime
  })

  const vertexShader = /* glsl */ `
    attribute vec3  aColor;
    attribute float aSize;
    attribute float aPhase;
    attribute float aSpeed;
    uniform float uTime;
    varying vec3  vColor;
    varying float vOpacity;

    void main() {
      vColor = aColor;
      float twinkle = 0.68 + 0.32 * sin(uTime * aSpeed + aPhase);
      vOpacity = twinkle;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (280.0 / -mvPos.z) * (0.85 + 0.15 * twinkle);
      gl_Position  = projectionMatrix * mvPos;
    }
  `

  const fragmentShader = /* glsl */ `
    varying vec3  vColor;
    varying float vOpacity;

    void main() {
      vec2  uv   = gl_PointCoord - 0.5;
      float d    = length(uv);

      // Bright pinpoint core
      float core = smoothstep(0.18, 0.0, d);
      // Soft diffuse halo
      float halo = exp(-d * d * 7.0) * 0.55;

      float alpha = (core + halo) * vOpacity;
      if (alpha < 0.008) discard;

      // Core flares white; halo keeps stellar color
      vec3 color = mix(vColor, vec3(1.0), core * 0.45);
      gl_FragColor = vec4(color, alpha);
    }
  `

  const shaderProps = {
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }

  return (
    <group>
      {/* Main stars */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={stars.N} array={stars.pos}    itemSize={3} />
          <bufferAttribute attach="attributes-aColor"   count={stars.N} array={stars.col}    itemSize={3} />
          <bufferAttribute attach="attributes-aSize"    count={stars.N} array={stars.sizes}  itemSize={1} />
          <bufferAttribute attach="attributes-aPhase"   count={stars.N} array={stars.phases} itemSize={1} />
          <bufferAttribute attach="attributes-aSpeed"   count={stars.N} array={stars.speeds} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial ref={matRef} {...shaderProps} />
      </points>

      {/* Milky Way band */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={milkyWay.N} array={milkyWay.pos}    itemSize={3} />
          <bufferAttribute attach="attributes-aColor"   count={milkyWay.N} array={milkyWay.col}    itemSize={3} />
          <bufferAttribute attach="attributes-aSize"    count={milkyWay.N} array={milkyWay.sizes}  itemSize={1} />
          <bufferAttribute attach="attributes-aPhase"   count={milkyWay.N} array={milkyWay.phases} itemSize={1} />
          <bufferAttribute attach="attributes-aSpeed"   count={milkyWay.N} array={milkyWay.speeds} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial {...shaderProps} />
      </points>
    </group>
  )
}
