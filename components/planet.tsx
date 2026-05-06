"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { Group, Mesh } from "three"
import { getPlanetMaterial } from "@/lib/shaders"
import type { Landmark } from "@/lib/constants"

interface PlanetProps {
  // Orbit mode props
  distance?: number
  speed?: number
  size: number
  type: string
  accentColor?: string
  phase?: number
  tilt?: number
  bump?: number
  seed?: number
  paused?: boolean
  onClick?: () => void
  onHover?: (hovered: boolean) => void
  // Detail mode props
  isDetailView?: boolean
  lonOffset?: number
  latOffset?: number
  onLandmarkClick?: (landmark: Landmark) => void
  landmarks?: Landmark[]
}

const GOLDEN_FRACTION = 0.6180339887

function moonOrbit(index: number) {
  return {
    radius: 6.6 + (index % 3) * 0.55,
    speed: 0.16 + ((index * 0.11) % 0.32),
    phase: (index * GOLDEN_FRACTION * Math.PI * 2) % (Math.PI * 2),
    inclination: (((index * 0.83) % 1) - 0.5) * Math.PI * 0.65,
  }
}

// ─── Vertex displacement (mountain relief) ──────────────────────────────────
// Sin-based hash with trilinear value-noise FBM. Cheap, deterministic, runs
// once at planet mount inside a useMemo.

function hash3(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}

function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const sz = fz * fz * (3 - 2 * fz)
  const c000 = hash3(ix, iy, iz)
  const c100 = hash3(ix + 1, iy, iz)
  const c010 = hash3(ix, iy + 1, iz)
  const c110 = hash3(ix + 1, iy + 1, iz)
  const c001 = hash3(ix, iy, iz + 1)
  const c101 = hash3(ix + 1, iy, iz + 1)
  const c011 = hash3(ix, iy + 1, iz + 1)
  const c111 = hash3(ix + 1, iy + 1, iz + 1)
  const x00 = c000 * (1 - sx) + c100 * sx
  const x10 = c010 * (1 - sx) + c110 * sx
  const x01 = c001 * (1 - sx) + c101 * sx
  const x11 = c011 * (1 - sx) + c111 * sx
  const y0 = x00 * (1 - sy) + x10 * sy
  const y1 = x01 * (1 - sy) + x11 * sy
  return y0 * (1 - sz) + y1 * sz
}

function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let total = 0
  let amp = 0.5
  for (let i = 0; i < octaves; i++) {
    total += amp * valueNoise3(x, y, z)
    x *= 2
    y *= 2
    z *= 2
    amp *= 0.5
  }
  return total // ~0..1
}

function displaceRadial(
  g: THREE.BufferGeometry,
  baseRadius: number,
  bump: number,
  seed: number,
  noiseScale = 2.5,
  octaves = 4,
) {
  if (bump <= 0) return g
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const dx = x / baseRadius, dy = y / baseRadius, dz = z / baseRadius
    const n = fbm3(
      dx * noiseScale + seed,
      dy * noiseScale + seed * 1.7,
      dz * noiseScale + seed * 2.3,
      octaves,
    )
    const factor = 1 + (n - 0.5) * 2 * bump
    pos.setXYZ(i, x * factor, y * factor, z * factor)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

function makeDisplacedSphere(radius: number, segments: number, bump: number, seed: number) {
  const g = new THREE.SphereGeometry(radius, segments, segments)
  return displaceRadial(g, radius, bump, seed)
}

// Crystalline moon — low-poly icosahedron with strong vertex displacement.
// Pairs with `flatShading: true` on the material so each face reads as a sharp facet.
function makeCrystalMoon(radius: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(radius, 1) // 80 faces
  return displaceRadial(g, radius, 0.22, seed, 3.0, 3)
}

export default function Planet({
  distance,
  speed,
  size,
  type,
  accentColor,
  phase = 0,
  tilt = 0,
  bump = 0,
  seed = 0,
  paused = false,
  onClick,
  onHover,
  isDetailView = false,
  lonOffset = 0,
  latOffset = 0,
  onLandmarkClick,
  landmarks: landmarksProp,
}: PlanetProps) {
  const orbitRef = useRef<Group>(null)
  const planetGroupRef = useRef<Group>(null)
  const planetRef = useRef<Mesh>(null)
  const moonOrbitRefs = useRef<Group[]>([])
  const landmarkRefs = useRef<Mesh[]>([])
  const [hoveredLandmark, setHoveredLandmark] = useState<number | null>(null)

  const landmarks = landmarksProp ?? []
  const orbits = useMemo(() => landmarks.map((_, i) => moonOrbit(i)), [landmarks.length])

  // Software-systems uses a cube; everything else gets a (possibly displaced) sphere.
  const isCube = type === "software-systems"

  // Sphere radius differs between detail (4) and orbit (size) modes — bake displacement
  // for whichever is currently rendered.
  const sphereRadius = isDetailView ? 4 : size
  const sphereSegments = isDetailView ? 96 : 64

  const displacedGeom = useMemo(() => {
    if (isCube) return null
    return makeDisplacedSphere(sphereRadius, sphereSegments, bump, seed)
  }, [isCube, sphereRadius, sphereSegments, bump, seed])

  useEffect(() => () => displacedGeom?.dispose(), [displacedGeom])

  // Memoize the shaderMaterial JSX so its `uniforms` object reference stays
  // stable across re-renders. Without this, r3f sees a new prop reference each
  // render and replaces material.uniforms — which resets `time` to 0 and makes
  // shader animations (radar sweep, voronoi pulse) appear frozen after the
  // camera-transition completes.
  const planetMaterialJsx = useMemo(
    () => getPlanetMaterial(type, accentColor),
    [type, accentColor],
  )

  // Pre-build a unique crystal geometry per moon (only matters in detail view)
  const moonGeoms = useMemo(() => {
    if (!isDetailView) return [] as THREE.BufferGeometry[]
    return landmarks.map((_, i) => makeCrystalMoon(0.36, i * 13.7 + 7))
  }, [isDetailView, landmarks.length])

  useEffect(
    () => () => moonGeoms.forEach((g) => g.dispose()),
    [moonGeoms],
  )

  useFrame((state) => {
    // Orbit revolution — gated by `paused` so the user can freeze the system
    // and click any planet at leisure.
    if (!isDetailView && orbitRef.current && speed && !paused) {
      orbitRef.current.rotation.y += speed
    }

    if (isDetailView && planetGroupRef.current) {
      planetGroupRef.current.rotation.x = latOffset
    }

    if (planetRef.current) {
      if (!paused) {
        const rotationSpeed = isDetailView ? 0.005 : 0.01
        planetRef.current.rotation.y += rotationSpeed
        if (!isDetailView) {
          planetRef.current.rotation.x += 0.005
        }
      }

      // Shader time uniform stays driven by wall-clock even when paused — the
      // *movement* of planets stops, but surface effects (radar sweep, voronoi
      // pulse, hex scan) keep ticking so the world doesn't feel dead.
      const material = planetRef.current.material as any
      if (material.uniforms?.time) {
        material.uniforms.time.value = state.clock.elapsedTime
      }

      if (planetGroupRef.current) {
        planetGroupRef.current.rotation.y = planetRef.current.rotation.y + lonOffset
        if (!isDetailView) {
          planetGroupRef.current.rotation.x = planetRef.current.rotation.x
        }
      }
    }

    if (isDetailView) {
      const t = state.clock.elapsedTime
      if (!paused) {
        orbits.forEach((o, i) => {
          const g = moonOrbitRefs.current[i]
          if (g) g.rotation.y = o.phase + t * o.speed
        })
      }

      landmarkRefs.current.forEach((m, i) => {
        if (m) {
          m.scale.setScalar(
            hoveredLandmark === i ? 1.55 + Math.sin(t * 4) * 0.18 : 1.0,
          )
          if (!paused) {
            // Crystal moons spin on their own axes — every facet catches light differently
            m.rotation.y = t * (0.4 + i * 0.07)
            m.rotation.x = t * (0.25 + i * 0.05) + i * 0.5
          }
        }
      })
    }
  })

  const planetMesh = (
    <mesh
      ref={planetRef}
      position={isDetailView ? [0, 0, 0] : [distance || 0, 0, 0]}
      onClick={onClick}
      onPointerOver={(e) => {
        if (!isDetailView && onHover) {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
          onHover(true)
        }
      }}
      onPointerOut={() => {
        if (!isDetailView && onHover) {
          document.body.style.cursor = "default"
          onHover(false)
        }
      }}
      castShadow
      receiveShadow
      {...(displacedGeom ? { geometry: displacedGeom } : {})}
    >
      {isCube && <boxGeometry args={[size * 1.55, size * 1.55, size * 1.55]} />}
      {planetMaterialJsx}
    </mesh>
  )

  if (!isDetailView) {
    // Outer group tilts the orbital plane; inner orbitRef sweeps around the tilted Y
    // axis with an initial `phase` so planets aren't all aligned at boot.
    return (
      <group rotation={[tilt, 0, 0]}>
        <group ref={orbitRef} rotation={[0, phase, 0]}>
          {planetMesh}
        </group>
      </group>
    )
  }

  return (
    <group>
      <group ref={planetGroupRef}>{planetMesh}</group>

      {landmarks.map((landmark, index) => {
        const o = orbits[index]
        return (
          <group key={index} rotation-x={o.inclination}>
            <group
              ref={(el) => {
                if (el) moonOrbitRefs.current[index] = el
              }}
            >
              <group position={[o.radius, 0, 0]}>
                {/* Faint halo so each moon reads as a distinct point of light
                    against the cosmic backdrop. */}
                <mesh>
                  <sphereGeometry args={[0.55, 24, 24]} />
                  <meshBasicMaterial
                    color={landmark.color}
                    transparent
                    opacity={0.18}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>

                {/* Crystalline moon — displaced icosahedron, flat-shaded so every facet
                    reads as a discrete crystal cut. Slow per-moon spin makes them glint. */}
                <mesh
                  ref={(el) => {
                    if (el) landmarkRefs.current[index] = el
                  }}
                  geometry={moonGeoms[index]}
                  onClick={(e) => {
                    e.stopPropagation()
                    onLandmarkClick?.(landmark)
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation()
                    document.body.style.cursor = "pointer"
                    setHoveredLandmark(index)
                  }}
                  onPointerOut={() => {
                    document.body.style.cursor = "default"
                    setHoveredLandmark(null)
                  }}
                >
                  <meshStandardMaterial
                    color={landmark.color}
                    emissive={landmark.color}
                    emissiveIntensity={0.6}
                    roughness={0.32}
                    metalness={0.78}
                    flatShading
                  />
                </mesh>

                {/* Inner facet glint — small bright crystal core */}
                <mesh scale={0.55}>
                  <icosahedronGeometry args={[0.36, 0]} />
                  <meshBasicMaterial
                    color={landmark.color}
                    transparent
                    opacity={0.35}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>

                {/* Hover preview — a tiny floating card with the project name +
                    category. Positioned just above the moon, screen-space so
                    text stays readable at any camera distance. */}
                {hoveredLandmark === index && (
                  <Html
                    position={[0, 0.7, 0]}
                    center
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        padding: "8px 12px",
                        background: "rgba(4, 6, 20, 0.85)",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        border: `1px solid ${landmark.color}55`,
                        borderRadius: 8,
                        boxShadow: `0 0 18px ${landmark.color}30, 0 6px 18px rgba(0,0,0,0.45)`,
                        color: "white",
                        fontFamily:
                          "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: 1.15,
                          marginBottom: 2,
                        }}
                      >
                        {landmark.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: `${landmark.color}cc`,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {landmark.category}
                      </div>
                    </div>
                  </Html>
                )}
              </group>
            </group>
          </group>
        )
      })}

      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, 0, 5]} intensity={0.3} color="#4080ff" />
    </group>
  )
}
