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

const VORTEX_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const VORTEX_FRAG = /* glsl */ `
  uniform float time;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uHovered;
  varying vec2 vUv;

  // Hash + 2D noise
  float h21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float n2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0 - 2.0*f);
    float a = h21(i);
    float b = h21(i + vec2(1,0));
    float c = h21(i + vec2(0,1));
    float d = h21(i + vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm2(vec2 p) {
    float a = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      a += amp * n2(p);
      p *= 2.1;
      amp *= 0.5;
    }
    return a;
  }

  void main() {
    // Centered, polar coords
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);

    // Discard outside the disc
    if (r > 1.0) discard;

    // Swirling vortex sampled in (radius, angle) — angle drifts inward over time
    float swirl = a + r * 4.5 + time * 0.4;
    float n = fbm2(vec2(cos(swirl) * 1.6 + r * 2.0, sin(swirl) * 1.6 - r * 2.0 + time * 0.18));

    // Falloff toward the edge so the disc fades in
    float edge = smoothstep(1.0, 0.6, r);
    float core = smoothstep(0.0, 0.7, r);  // darker / more interesting away from center

    vec3 color = mix(uColorA, uColorB, n) * (0.4 + core * 0.9);

    // Bright halo right at the rim
    float rim = smoothstep(0.85, 1.0, r) - smoothstep(1.0, 1.05, r);
    color += uColorB * rim * 1.6;

    // Hover boost
    color *= 1.0 + uHovered * 0.55;

    float alpha = edge;
    gl_FragColor = vec4(color, alpha);
  }
`

export default function Rift({ onClick, universe }: RiftProps) {
  const groupRef = useRef<Group>(null)
  const ringRef = useRef<Mesh>(null)
  const innerRingRef = useRef<Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const [hovered, setHovered] = useState(false)

  // Position the rift far out, opposite the camera's default view, slightly elevated
  const position: [number, number, number] = [0, 6, -36]

  // Color palette flips based on current universe — the rift pulses with the
  // *opposite* universe's accent so it reads as "the other side."
  const colors = useMemo(() => {
    if (universe === "professional") {
      // Personal-side colors leaking through: pink + violet
      return {
        a: new THREE.Color("#a050ff"),
        b: new THREE.Color("#ff80d0"),
        ring: "#d090ff",
      }
    }
    // Professional-side colors leaking through: cyan + electric blue
    return {
      a: new THREE.Color("#3060ff"),
      b: new THREE.Color("#00e0ff"),
      ring: "#80d0ff",
    }
  }, [universe])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (matRef.current) {
      matRef.current.uniforms.time.value = t
      matRef.current.uniforms.uHovered.value = hovered ? 1 : 0
    }
    if (groupRef.current) {
      // Slow drift / breathe
      groupRef.current.position.y = position[1] + Math.sin(t * 0.5) * 0.6
    }
    if (ringRef.current) ringRef.current.rotation.z = t * 0.08
    if (innerRingRef.current) innerRingRef.current.rotation.z = -t * 0.13
  })

  // Make the rift always face the camera-ish (rotate around X so the disc reads vertically)
  return (
    <group ref={groupRef} position={position} rotation={[0, 0, 0]}>
      {/* Inner swirling vortex — the clickable target */}
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
        scale={hovered ? 1.08 : 1}
      >
        <planeGeometry args={[5, 6.5]} />
        <shaderMaterial
          ref={matRef}
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
          vertexShader={VORTEX_VERT}
          fragmentShader={VORTEX_FRAG}
        />
      </mesh>

      {/* Outer thin glowing ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2.6, 0.05, 12, 96]} />
        <meshBasicMaterial
          color={colors.ring}
          transparent
          opacity={hovered ? 0.95 : 0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner thinner ring */}
      <mesh ref={innerRingRef}>
        <torusGeometry args={[2.0, 0.03, 12, 80]} />
        <meshBasicMaterial
          color={colors.ring}
          transparent
          opacity={hovered ? 0.7 : 0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Halo — soft additive billboard plane */}
      <mesh>
        <planeGeometry args={[8, 9]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          uniforms={{ uHaloColor: { value: colors.b } }}
          vertexShader={VORTEX_VERT}
          fragmentShader={/* glsl */ `
            uniform vec3 uHaloColor;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * 2.0 - 1.0;
              p.x *= 1.1;
              float d = length(p);
              float a = exp(-d * d * 3.5) * 0.55;
              gl_FragColor = vec4(uHaloColor * a, a);
            }
          `}
        />
      </mesh>
    </group>
  )
}
