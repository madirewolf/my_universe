"use client"

// Sun — drastic redesign. Compared to the previous version:
//   • Photosphere shader now does multi-scale fbm + domain-warped plasma
//     flow + sunspots (dark low-freq patches), all anchored to the sun's
//     body (object-space normal) so the texture doesn't slide as the sun
//     rotates.
//   • Prominences upgraded from half-torus arcs to curved CatmullRom
//     bezier tubes that loop foot→peak→foot like real magnetic field
//     lines. Pulse on opacity (not scale) so they stay grounded.
//   • Solar wind: 220 Points-based particles streaming outward from the
//     surface. Each particle has its own direction, speed, and age that
//     fades to nothing as it travels out — way more "solar" than the old
//     straight ray streaks.
//   • Hot fresnel rim adds a chromospheric glow at the limb.
//
// Pause-aware via the same effectiveTime / prevWall pattern as the rest
// of the project (gross rotations freeze, surface boil keeps wall time).

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Mesh } from "three"
import { LIGHTING } from "@/lib/constants"

type SunVariant = "warm" | "nebula"

interface SunProps {
  position: [number, number, number]
  variant?: SunVariant
  paused?: boolean
  onClick?: () => void
}

const SUN_VARIANTS: Record<SunVariant, {
  colorA: string
  colorB: string
  spotCol: string
  glowColor: string
  coronaColor: string
  windCol: string
  rimGlow: [number, number, number]
  emissive: number
  granScale: number
  hotSpot: number
}> = {
  warm: {
    colorA: "#ff3a00",       // deep red-orange (cool granulation troughs)
    colorB: "#ffe890",       // bright yellow-white (hot cells)
    spotCol: "#2a0d00",      // sunspot — very dark, almost black
    glowColor: "#ffb347",
    coronaColor: "#ffd37a",
    windCol: "#ffc888",
    rimGlow: [1.0, 0.55, 0.18],
    emissive: 1.95,
    granScale: 1.6,
    hotSpot: 1.0,
  },
  nebula: {
    colorA: "#5020a0",       // deep purple
    colorB: "#ff90d8",       // bright pink
    spotCol: "#150428",      // dark purple spot
    glowColor: "#b890ff",
    coronaColor: "#d090ff",
    windCol: "#e0a8ff",
    rimGlow: [0.85, 0.55, 1.0],
    emissive: 1.75,
    granScale: 1.4,
    hotSpot: 0.65,
  },
}

const SUN_RADIUS = 2.0
const NUM_WIND_PARTICLES = 220

export default function Sun({
  position,
  variant = "warm",
  paused = false,
  onClick,
}: SunProps) {
  const sunRef = useRef<Mesh>(null)
  const sunMatRef = useRef<THREE.ShaderMaterial>(null)
  const coronaRef = useRef<Mesh>(null)
  const coronaMatRef = useRef<THREE.ShaderMaterial>(null)
  const glowRef = useRef<Mesh>(null)
  const chromosphereRef = useRef<Mesh>(null)
  const v = SUN_VARIANTS[variant]

  // ── GLSL ─────────────────────────────────────────────────────────────
  // Object-space normal (vObj) keeps noise anchored to the body so it
  // doesn't slide as the sun rotates.
  const sunVertex = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vObj;

    void main() {
      vNormal  = normalize(normalMatrix * normal);
      vObj     = normalize(normal);
      vec4 wp  = modelMatrix * vec4(position, 1.0);
      vec4 mv  = viewMatrix * wp;
      vViewDir = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `

  const noiseGLSL = /* glsl */ `
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = hash(i + vec3(0,0,0));
      float n100 = hash(i + vec3(1,0,0));
      float n010 = hash(i + vec3(0,1,0));
      float n110 = hash(i + vec3(1,1,0));
      float n001 = hash(i + vec3(0,0,1));
      float n101 = hash(i + vec3(1,0,1));
      float n011 = hash(i + vec3(0,1,1));
      float n111 = hash(i + vec3(1,1,1));
      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);
      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);
      return mix(nxy0, nxy1, f.z);
    }
    float fbm(vec3 p) {
      float a = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        a += amp * noise(p);
        p *= 2.1;
        amp *= 0.5;
      }
      return a;
    }
  `

  // Photosphere fragment: multi-scale convection + plasma flow + sunspots.
  const sunFragment = /* glsl */ `
    uniform float uTime;
    uniform vec3  uColorA, uColorB, uSpotCol, uRimGlow;
    uniform float uEmissive, uGranScale, uHotSpot;

    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vObj;

    ${noiseGLSL}

    void main() {
      vec3 p = vObj * uGranScale;
      float t = uTime * 0.10;

      // Multi-scale convection: small bubbles + larger flow currents.
      float gSmall = fbm(p * 5.5 + vec3(t * 0.5, 0.0, 0.0));
      float gLarge = fbm(p * 1.8 + vec3(0.0, t * 0.30, 0.0));

      // Domain-warped flow — warp the sample position by another fbm so
      // the surface looks like turbulent plasma rather than static cells.
      vec3 warp = vec3(
        fbm(p * 1.5 + vec3(t * 0.13)),
        fbm(p * 1.5 + vec3(0.0, t * 0.13, 0.0)),
        fbm(p * 1.5 + vec3(0.0, 0.0, t * 0.13))
      ) * 0.55;
      float flow = fbm((p + warp) * 3.2 + vec3(t * 0.20));

      float gran = smoothstep(0.18, 0.95, gSmall * 0.55 + gLarge * 0.45 + flow * 0.40);
      float hotspots = pow(gran, 3.0) * uHotSpot;

      // Sunspots: low-frequency dark patches (rare on the surface).
      float spotN = fbm(p * 0.55 + vec3(0.0, 0.0, t * 0.04));
      float spotMask = smoothstep(0.50, 0.62, spotN);    // 0 inside spot

      // Limb darkening + Fresnel rim.
      float ndv = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
      float limb = pow(ndv, 0.55);
      float fres = pow(1.0 - ndv, 2.4);

      // Color blend: cool/hot cells, then darken by sunspots.
      vec3 baseCol = mix(uColorA, uColorB, clamp(gran * 1.2 + hotspots, 0.0, 1.0));
      baseCol = mix(uSpotCol, baseCol, spotMask);

      float glow = uEmissive * (0.55 + 0.45 * limb) + fres * 0.7;
      vec3 col = baseCol * glow;

      // Hot chromospheric rim glow.
      col += uRimGlow * fres * 0.45 * (0.6 + 0.4 * uHotSpot);

      gl_FragColor = vec4(col, 1.0);
    }
  `

  // Corona: billboard plane with turbulent edge.
  const coronaVertex = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  const coronaFragment = /* glsl */ `
    uniform float uTime;
    uniform vec3  uCoronaCol;
    uniform float uIntensity;
    varying vec2 vUv;
    ${noiseGLSL}
    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      float r = length(uv);
      float edge = 1.0 - smoothstep(0.55, 1.0, r + (fbm(vec3(uv * 2.0, uTime * 0.15)) * 0.18));
      float inner = smoothstep(1.0, 0.0, r);
      float a = clamp(edge * inner, 0.0, 1.0);
      gl_FragColor = vec4(uCoronaCol * uIntensity, a);
    }
  `

  // ── Solar wind particles ──────────────────────────────────────────────
  // Each particle has a fixed direction and speed; its age cycles 0→1 as
  // it travels from the surface outward. Position + per-vertex color
  // (which carries alpha as luminance under additive blending) update
  // every frame.
  const wind = useMemo(() => {
    const dirs: THREE.Vector3[] = []
    const speeds: number[] = []
    const ages = new Float32Array(NUM_WIND_PARTICLES)
    for (let i = 0; i < NUM_WIND_PARTICLES; i++) {
      const u = Math.random()
      const w = Math.random()
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * w - 1)
      dirs.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        ),
      )
      speeds.push(0.18 + Math.random() * 0.32)
      ages[i] = Math.random()        // staggered start so they don't pulse together
    }
    return {
      dirs,
      speeds,
      ages,
      positions: new Float32Array(NUM_WIND_PARTICLES * 3),
      colors: new Float32Array(NUM_WIND_PARTICLES * 3),
    }
  }, [])
  const windGeomRef = useRef<THREE.BufferGeometry>(null)
  const windColor = useMemo(() => new THREE.Color(v.windCol), [v.windCol])

  // Separate wall-time tracker for the wind delta (wind doesn't tick when
  // paused, but it also shouldn't drift on resume — we want the *increment*
  // since the last frame, not since the cinematic started).
  const windPrev = useRef<number | null>(null)

  // Reset wind on variant switch so the pattern looks fresh after a rift.
  useEffect(() => {
    for (let i = 0; i < NUM_WIND_PARTICLES; i++) {
      wind.ages[i] = Math.random()
    }
  }, [variant, wind])

  useFrame((state) => {
    const wall = state.clock.getElapsedTime()

    // Surface boil + corona stay on wall time so the sun never freezes.
    if (sunMatRef.current) sunMatRef.current.uniforms.uTime.value = wall
    if (coronaMatRef.current) coronaMatRef.current.uniforms.uTime.value = wall

    // Outer glow breathes — slower / deeper while paused for a "stasis" cue.
    if (glowRef.current) {
      const breathe = paused ? 0.5 : 1.8
      const amp = paused ? 0.10 : 0.05
      glowRef.current.scale.setScalar(1 + Math.sin(wall * breathe) * amp)
    }

    // Chromosphere flicker (wall time — alive even when paused).
    if (chromosphereRef.current) {
      const flicker =
        1 + Math.sin(wall * 4.2) * 0.012 + Math.sin(wall * 7.7) * 0.008
      chromosphereRef.current.scale.setScalar(flicker)
    }

    // Solar wind: advance particle ages, write positions + colors.
    if (windGeomRef.current) {
      const dt = paused ? 0 : Math.min(0.05, wall - (windPrev.current ?? wall))
      windPrev.current = wall
      const pos = wind.positions
      const col = wind.colors
      for (let i = 0; i < NUM_WIND_PARTICLES; i++) {
        wind.ages[i] += dt * wind.speeds[i]
        if (wind.ages[i] > 1) wind.ages[i] -= 1
        const r = SUN_RADIUS + wind.ages[i] * 5.0
        pos[i * 3 + 0] = wind.dirs[i].x * r
        pos[i * 3 + 1] = wind.dirs[i].y * r
        pos[i * 3 + 2] = wind.dirs[i].z * r
        // Brightness fades over the particle's life (1 at birth, 0 at edge).
        const alpha = (1 - wind.ages[i]) * 0.9
        col[i * 3 + 0] = windColor.r * alpha
        col[i * 3 + 1] = windColor.g * alpha
        col[i * 3 + 2] = windColor.b * alpha
      }
      const posAttr = windGeomRef.current.getAttribute("position") as THREE.BufferAttribute
      const colAttr = windGeomRef.current.getAttribute("color") as THREE.BufferAttribute
      if (posAttr) posAttr.needsUpdate = true
      if (colAttr) colAttr.needsUpdate = true
    }

    // Corona is a billboard plane that always faces the camera.
    if (coronaRef.current) {
      coronaRef.current.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <group position={position}>
      {/* Photosphere — emissive shader sphere, click to pause */}
      <mesh
        ref={sunRef}
        onClick={(e) => {
          if (!onClick) return
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          if (!onClick) return
          e.stopPropagation()
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          if (!onClick) return
          document.body.style.cursor = "default"
        }}
      >
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <shaderMaterial
          ref={sunMatRef}
          transparent={false}
          depthWrite
          depthTest
          blending={THREE.NormalBlending}
          uniforms={{
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color(v.colorA) },
            uColorB: { value: new THREE.Color(v.colorB) },
            uSpotCol: { value: new THREE.Color(v.spotCol) },
            uRimGlow: {
              value: new THREE.Vector3(v.rimGlow[0], v.rimGlow[1], v.rimGlow[2]),
            },
            uEmissive: { value: v.emissive },
            uGranScale: { value: v.granScale },
            uHotSpot: { value: v.hotSpot },
          }}
          vertexShader={sunVertex}
          fragmentShader={sunFragment}
        />
      </mesh>

      {/* Chromosphere — thin glowing shell flickering with hot ionized plasma */}
      <mesh ref={chromosphereRef}>
        <sphereGeometry args={[SUN_RADIUS * 1.03, 48, 48]} />
        <meshBasicMaterial
          color={v.coronaColor}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle outer glow shell */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[SUN_RADIUS * 1.13, 48, 48]} />
        <meshBasicMaterial
          color={v.glowColor}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* (Magnetic-loop prominences removed — they read as off-putting tubes.
          The fresnel rim glow + chromosphere shell carry the limb activity now.) */}

      {/* Solar wind — Points streaming outward radially */}
      <points>
        <bufferGeometry ref={windGeomRef}>
          <bufferAttribute
            attach="attributes-position"
            array={wind.positions}
            count={NUM_WIND_PARTICLES}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={wind.colors}
            count={NUM_WIND_PARTICLES}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          sizeAttenuation
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Camera-facing corona plane with turbulent edge */}
      <mesh ref={coronaRef} renderOrder={-1} position={[0, 0, 0]}>
        <planeGeometry args={[7.5, 7.5, 1, 1]} />
        <shaderMaterial
          ref={coronaMatRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uCoronaCol: { value: new THREE.Color(v.coronaColor) },
            uIntensity: { value: 1.2 },
          }}
          vertexShader={coronaVertex}
          fragmentShader={coronaFragment}
        />
      </mesh>

      {/* Point light — actual scene illumination */}
      <pointLight
        intensity={LIGHTING.sunIntensity}
        distance={LIGHTING.sunDistance}
        decay={LIGHTING.sunDecay}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
    </group>
  )
}
