"use client"

// Background space ambience: three lightweight effects sitting in the
// mid-far layer (radius 130-300) so they read as deep-space dressing
// behind the planets and nebulas, not part of the foreground scene.
//
//   • ShootingStars — ephemeral bright streaks. Spawn at a random rate
//                     (~one every 3-5s), fade in/out over 1.5-2s.
//   • Comets        — persistent slow-drift streaks. Two on screen at
//                     all times, each takes 35-60s to traverse.
//   • Pulsars       — fixed bright points pulsing at varying frequencies.
//                     5 of them, distributed via Fibonacci sphere.
//
// All three render with additive blending + transparent + depthWrite off
// so they layer cleanly with nebulas and don't punch holes.
//
// Universe palette: cool/blue tones for the outer (dark) universe,
// warm/peach for the inner (bright) universe. Same component shape, just
// different colors, so the inner universe feels mirrored visually.

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface Palette {
  shootingStar: THREE.Color
  comet: THREE.Color
  pulsar: THREE.Color
}

const PALETTE_DARK: Palette = {
  shootingStar: new THREE.Color("#a0c8ff"),
  comet: new THREE.Color("#d8e0ff"),
  pulsar: new THREE.Color("#80a0ff"),
}
const PALETTE_BRIGHT: Palette = {
  shootingStar: new THREE.Color("#ffe0b0"),
  comet: new THREE.Color("#ffe8c8"),
  pulsar: new THREE.Color("#ffb088"),
}

interface SpaceAmbienceProps {
  variant: "dark" | "bright"
}

export default function SpaceAmbience({ variant }: SpaceAmbienceProps) {
  const palette = variant === "bright" ? PALETTE_BRIGHT : PALETTE_DARK
  return (
    <group>
      <Streaks
        count={3}
        spawnRate={0.005}
        alwaysActive={false}
        durationRange={[1.2, 2.0]}
        radiusStart={150}
        radiusOffset={90}
        tailLen={6}
        color={palette.shootingStar}
        headSize={1.0}
      />
      <Streaks
        count={2}
        spawnRate={1}
        alwaysActive={true}
        durationRange={[35, 60]}
        radiusStart={220}
        radiusOffset={180}
        tailLen={20}
        color={palette.comet}
        headSize={1.4}
      />
      <Pulsars count={5} color={palette.pulsar} />
    </group>
  )
}

// ─── Streaks (shared shooting-star + comet impl) ──────────────────────────

interface StreakState {
  active: boolean
  startTime: number
  duration: number
  start: THREE.Vector3
  end: THREE.Vector3
}

function randomOnSphere(r: number, target: THREE.Vector3): THREE.Vector3 {
  // Uniform random direction × radius.
  const u = Math.random()
  const v = Math.random()
  const theta = u * Math.PI * 2
  const phi = Math.acos(2 * v - 1)
  return target.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  )
}

interface StreaksProps {
  count: number
  /** Probability per frame to spawn when free. Ignored if alwaysActive. */
  spawnRate: number
  /** When true, immediately respawn on completion (comets). */
  alwaysActive: boolean
  /** Min/max lifetime in seconds. */
  durationRange: [number, number]
  /** Sphere radius the start point is sampled on. */
  radiusStart: number
  /** Random offset magnitude added to start to get end. */
  radiusOffset: number
  /** Length of the trailing line (world units). */
  tailLen: number
  color: THREE.Color
  headSize: number
}

function Streaks({
  count,
  spawnRate,
  alwaysActive,
  durationRange,
  radiusStart,
  radiusOffset,
  tailLen,
  color,
  headSize,
}: StreaksProps) {
  const heads = useRef<(THREE.Mesh | null)[]>([])
  const positions = useMemo(() => new Float32Array(count * 6), [count])
  const colors = useMemo(() => new Float32Array(count * 6), [count])
  const geomRef = useRef<THREE.BufferGeometry>(null)

  // Streak state — mutable refs, never causes React re-renders.
  const streaks = useRef<StreakState[]>(
    Array.from({ length: count }, () => ({
      active: false,
      startTime: 0,
      duration: 0,
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
    })),
  )

  // Reused scratch vectors so respawn / per-frame loops don't allocate.
  const offsetScratch = useRef(new THREE.Vector3())
  const headScratch = useRef(new THREE.Vector3())
  const tailScratch = useRef(new THREE.Vector3())
  const dirScratch = useRef(new THREE.Vector3())

  function respawn(i: number, t: number) {
    const s = streaks.current[i]
    s.active = true
    s.startTime = t
    s.duration =
      durationRange[0] +
      Math.random() * (durationRange[1] - durationRange[0])
    randomOnSphere(radiusStart, s.start)
    randomOnSphere(radiusOffset, offsetScratch.current)
    s.end.copy(s.start).add(offsetScratch.current)
  }

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const s = streaks.current[i]

      // Spawn check
      if (!s.active && (alwaysActive || Math.random() < spawnRate)) {
        respawn(i, t)
      }

      // Lifetime check
      if (s.active) {
        const elapsed = t - s.startTime
        if (elapsed >= s.duration) {
          s.active = false
          if (alwaysActive) respawn(i, t)
        }
      }

      // Render this slot
      if (s.active) {
        const k = (t - s.startTime) / s.duration
        // Head = lerp(start, end, k)
        headScratch.current.copy(s.start).lerp(s.end, k)
        // Tail = head − dir * tailLen
        dirScratch.current.copy(s.end).sub(s.start).normalize()
        tailScratch.current
          .copy(headScratch.current)
          .sub(dirScratch.current.multiplyScalar(tailLen))

        // Brightness: fade in at start, fade out at end (sin curve).
        const alpha = Math.sin(k * Math.PI)

        positions[i * 6 + 0] = headScratch.current.x
        positions[i * 6 + 1] = headScratch.current.y
        positions[i * 6 + 2] = headScratch.current.z
        positions[i * 6 + 3] = tailScratch.current.x
        positions[i * 6 + 4] = tailScratch.current.y
        positions[i * 6 + 5] = tailScratch.current.z

        // Vertex colors: bright at head, dim at tail (line gradient).
        colors[i * 6 + 0] = color.r * alpha
        colors[i * 6 + 1] = color.g * alpha
        colors[i * 6 + 2] = color.b * alpha
        colors[i * 6 + 3] = color.r * alpha * 0.08
        colors[i * 6 + 4] = color.g * alpha * 0.08
        colors[i * 6 + 5] = color.b * alpha * 0.08

        const m = heads.current[i]
        if (m) {
          m.position.copy(headScratch.current)
          m.visible = true
          ;(m.material as THREE.MeshBasicMaterial).opacity = alpha
        }
      } else {
        // Hide
        for (let j = 0; j < 6; j++) positions[i * 6 + j] = 0
        for (let j = 0; j < 6; j++) colors[i * 6 + j] = 0
        const m = heads.current[i]
        if (m) m.visible = false
      }
    }

    if (geomRef.current) {
      const posAttr = geomRef.current.getAttribute(
        "position",
      ) as THREE.BufferAttribute
      if (posAttr) posAttr.needsUpdate = true
      const colAttr = geomRef.current.getAttribute(
        "color",
      ) as THREE.BufferAttribute
      if (colAttr) colAttr.needsUpdate = true
    }
  })

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            heads.current[i] = el
          }}
          visible={false}
        >
          <sphereGeometry args={[headSize, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
            count={count * 2}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={colors}
            count={count * 2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

// ─── Pulsars ─────────────────────────────────────────────────────────────

interface PulsarConfig {
  pos: [number, number, number]
  freq: number   // Hz of the pulse cycle
  phase: number  // initial phase offset
}

function Pulsars({ count, color }: { count: number; color: THREE.Color }) {
  // Distribute on a sphere via Fibonacci so they spread evenly across the sky.
  const configs = useMemo<PulsarConfig[]>(() => {
    const arr: PulsarConfig[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count)
      const theta = i * golden
      const r = 165 + ((i * 23) % 50)
      arr.push({
        pos: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ],
        freq: 0.6 + ((i * 0.41) % 1.4),
        phase: (i * 1.31) % (Math.PI * 2),
      })
    }
    return arr
  }, [count])

  const meshes = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    configs.forEach((p, i) => {
      const m = meshes.current[i]
      if (!m) return
      const mat = m.material as THREE.MeshBasicMaterial
      // Sharp spike + exponential decay → crisp blink instead of a hum.
      const phase = (t * p.freq + p.phase) % 1
      mat.opacity = Math.exp(-phase * 6) * 0.9 + 0.05
    })
  })

  return (
    <group>
      {configs.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          position={p.pos}
        >
          <sphereGeometry args={[1.0, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
