"use client"

import { useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Group, Mesh } from "three"
import type { Universe } from "@/lib/constants"

interface RiftProps {
  onClick: () => void
  universe: Universe
}

// Vortex-style additive shader for the central energy core. Slowly drifts +
// glitches its color separation so the rift "shudders" intermittently.
const CORE_FRAG = /* glsl */ `
  uniform float time;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uHovered;
  varying vec2 vUv;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
    float a = 0.0, amp = 0.5;
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

    float a = atan(p.y, p.x);
    // Glitch: occasional fast offset
    float glitchTrigger = step(0.93, sin(time * 0.7) * 0.5 + 0.5);
    float glitchOff = glitchTrigger * (h21(vec2(floor(time * 18.0), 0.0)) - 0.5) * 0.4;

    float swirl = a + r * 5.0 + time * 0.6 + glitchOff;
    float n = fbm2(vec2(cos(swirl) * 1.4 + r * 2.5, sin(swirl) * 1.4 - r * 2.5 + time * 0.18));

    float edge = smoothstep(1.0, 0.55, r);
    float core = smoothstep(0.0, 0.55, r);

    vec3 color = mix(uColorA, uColorB, n) * (0.45 + core * 1.05);
    // Bright rim
    float rim = smoothstep(0.85, 1.0, r) - smoothstep(1.0, 1.05, r);
    color += uColorB * rim * 1.8;
    color *= 1.0 + uHovered * 0.65;

    gl_FragColor = vec4(color, edge);
  }
`

const CORE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

interface ShardSpec {
  dir: THREE.Vector3
  length: number
  hue: number
}

export default function Rift({ onClick, universe }: RiftProps) {
  const groupRef = useRef<Group>(null)
  const coreInnerRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const shardsGroupRef = useRef<Group>(null)
  const beamsGroupRef = useRef<Group>(null)
  const sliceMatRef = useRef<THREE.ShaderMaterial>(null)
  const [hovered, setHovered] = useState(false)

  // Position FAR off and elevated — bigger but distant so it reads as a
  // rip in space rather than something hovering nearby.
  const position: [number, number, number] = [0, 16, -75]

  const colors = useMemo(() => {
    if (universe === "professional") {
      return {
        a: new THREE.Color("#a050ff"),
        b: new THREE.Color("#ff80d0"),
        beam: "#e090ff",
        shard: "#d090ff",
        emissive: "#ffa0e8",
      }
    }
    return {
      a: new THREE.Color("#3070ff"),
      b: new THREE.Color("#00e0ff"),
      beam: "#90e0ff",
      shard: "#80c8ff",
      emissive: "#a0e8ff",
    }
  }, [universe])

  // Fibonacci-sphere distribution of crystal shards radiating outward
  const shards = useMemo<ShardSpec[]>(() => {
    const N = 14
    return Array.from({ length: N }).map((_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i
      const dir = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
      )
      // Vary length so the silhouette feels organic (not a perfect star)
      const length = 4.5 + ((i * 1.617) % 1) * 4.5
      return { dir, length, hue: i / N }
    })
  }, [])

  // Light beams — flat rectangles fanning out, additive blended
  const beams = useMemo(() => {
    const N = 18
    return Array.from({ length: N }).map((_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + 0.7
      const dir = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
      )
      const len = 16 + ((i * 0.83) % 1) * 10
      return { dir, len }
    })
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (sliceMatRef.current) {
      sliceMatRef.current.uniforms.time.value = t
      sliceMatRef.current.uniforms.uHovered.value = hovered ? 1 : 0
    }
    if (groupRef.current) {
      // Slow base rotation
      groupRef.current.rotation.y = t * 0.04
      groupRef.current.rotation.z = Math.sin(t * 0.13) * 0.08
      // Glitchy 2% chance per frame to jitter position briefly
      const glitch = Math.random() < 0.025 ? (Math.random() - 0.5) * 0.6 : 0
      groupRef.current.position.x = position[0] + glitch
      groupRef.current.position.y = position[1] + Math.sin(t * 0.4) * 0.4
    }
    if (coreInnerRef.current) {
      const pulse = 1 + Math.sin(t * 1.6) * 0.16 + (hovered ? 0.18 : 0)
      coreInnerRef.current.scale.setScalar(pulse)
    }
    if (haloRef.current) {
      const breathe = 1 + Math.sin(t * 0.9) * 0.06
      haloRef.current.scale.setScalar(breathe)
    }
    if (shardsGroupRef.current) {
      // Counter-rotate the shards
      shardsGroupRef.current.rotation.y = -t * 0.09
      shardsGroupRef.current.rotation.x = Math.sin(t * 0.07) * 0.12
    }
    if (beamsGroupRef.current) {
      // Beams sweep
      beamsGroupRef.current.rotation.y = t * 0.18
      beamsGroupRef.current.rotation.x = Math.cos(t * 0.11) * 0.18
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Big invisible click/hover sphere wrapping everything */}
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
          setHovered(true)
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default"
          setHovered(false)
        }}
      >
        <sphereGeometry args={[14, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>

      {/* Wide ambient glow */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[8.5, 32, 32]} />
        <meshBasicMaterial
          color={colors.a}
          transparent
          opacity={0.085}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Mid halo */}
      <mesh>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial
          color={colors.b}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Vortex disc — billboard plane with the swirl shader */}
      <mesh>
        <planeGeometry args={[8, 8]} />
        <shaderMaterial
          ref={sliceMatRef}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          uniforms={{
            time: { value: 0 },
            uColorA: { value: colors.a },
            uColorB: { value: colors.b },
            uHovered: { value: 0 },
          }}
          vertexShader={CORE_VERT}
          fragmentShader={CORE_FRAG}
        />
      </mesh>

      {/* Bright pulsing core */}
      <mesh ref={coreInnerRef}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshBasicMaterial
          color={colors.emissive}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Crystal shards radiating outward — like a shattered frozen star */}
      <group ref={shardsGroupRef}>
        {shards.map((s, i) => {
          const half = s.length / 2
          const pos = s.dir.clone().multiplyScalar(half + 1.4)
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            s.dir,
          )
          return (
            <group key={i} position={pos.toArray()} quaternion={quat}>
              <mesh scale={[0.55, s.length / 2, 0.55]}>
                <octahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                  color={colors.shard}
                  emissive={colors.emissive}
                  emissiveIntensity={1.4}
                  roughness={0.18}
                  metalness={0.82}
                  flatShading
                  transparent
                  opacity={0.92}
                />
              </mesh>
              {/* Glow streak around each shard */}
              <mesh scale={[0.95, s.length / 2 + 0.4, 0.95]}>
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial
                  color={colors.emissive}
                  transparent
                  opacity={0.18}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* Light beam streaks — thin additive planes piercing through the core */}
      <group ref={beamsGroupRef}>
        {beams.map((b, i) => {
          const half = b.len / 2
          const pos = b.dir.clone().multiplyScalar(half)
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            b.dir,
          )
          return (
            <mesh key={i} position={pos.toArray()} quaternion={quat}>
              <planeGeometry args={[0.45, b.len]} />
              <meshBasicMaterial
                color={colors.beam}
                transparent
                opacity={0.35}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
