"use client"

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { Group, Mesh } from "three"
import type { ThreeEvent } from "@react-three/fiber"
import { getPlanetMaterial } from "@/lib/shaders"
import type { Landmark, PlanetShape } from "@/lib/constants"

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
  shape?: PlanetShape
  paused?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
  /**
   * Focused-in-orbit mode: the planet IS the detail view, in place. Its
   * orbit freezes (siblings keep moving), its landmark moons materialize
   * around it, and the joystick lon/lat offsets apply. The camera flies to
   * it — nothing remounts.
   */
  focused?: boolean
  // Detail mode props (legacy origin-centered detail view)
  isDetailView?: boolean
  lonOffset?: number
  latOffset?: number
  /** object = the clicked moon mesh — tracked live during the dive. */
  onLandmarkClick?: (landmark: Landmark, object: THREE.Object3D) => void
  /** When provided (focused planet), filled with the live moon meshes so
   *  the moon→planet return can frame the exact moon it left through. */
  landmarkObjectsRef?: MutableRefObject<(THREE.Object3D | null)[]>
  /** Reports the live planet body mesh (null on unmount) — used by history
   *  navigation to re-dive into this planet like a real click. */
  registerObject?: (object: THREE.Object3D | null) => void
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

// ── Focused-mode sizing ─────────────────────────────────────────────────────
// The landmark layout above was authored for the size-4 detail planet. In
// focused-in-orbit mode the whole layout shrinks with the planet, but the
// crystals shrink LESS than the orbit radii so they stay comfortably
// clickable on a size-~1 planet.

/** World-space crystal radius for a focused planet of `size`. */
export function focusedCrystalRadius(size: number): number {
  return 0.13 + size * 0.09
}

/** Scale applied to the landmark layout (orbit radii) for a focused planet. */
function focusedOrbitScale(size: number): number {
  return (size / 4) * 1.15
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

/** Build whichever geometry a planet's `shape` field calls for. */
function makePlanetGeometry(
  shape: PlanetShape,
  size: number,
  segments: number,
  bump: number,
  seed: number,
): THREE.BufferGeometry {
  switch (shape) {
    case "cube":
      return new THREE.BoxGeometry(size * 1.55, size * 1.55, size * 1.55)
    case "torus":
      // Donut: tube ratio 0.32× makes a chunky "reel" vibe rather than a thin ring
      return new THREE.TorusGeometry(size * 0.85, size * 0.32, 18, 96)
    case "torusKnot":
      // Twisted knot — feels intricate and computational; great for AI/Controls
      return new THREE.TorusKnotGeometry(size * 0.7, size * 0.22, 160, 24, 2, 3)
    case "icosahedron": {
      const g = new THREE.IcosahedronGeometry(size, 2)
      return bump > 0 ? displaceRadial(g, size, bump, seed) : g
    }
    case "dodecahedron": {
      const g = new THREE.DodecahedronGeometry(size, 1)
      return bump > 0 ? displaceRadial(g, size, bump, seed) : g
    }
    case "capsule":
      // Vertical pill shape — reads as a phone / app device for the
      // self-hack apps planet
      return new THREE.CapsuleGeometry(size * 0.55, size * 1.0, 12, 32)
    case "sphere":
    default:
      return makeDisplacedSphere(size, segments, bump, seed)
  }
}

// Crystalline moon — low-poly icosahedron with strong vertex displacement.
// Pairs with `flatShading: true` on the material so each face reads as a sharp facet.
// Exported: MoonView builds its central data crystal with the SAME recipe and
// the SAME seed, so the crystal you arrive at is an identical (bigger) twin
// of the moon you clicked — the displacement is radius-relative, so only the
// scale changes.
export function makeCrystalMoon(radius: number, seed: number) {
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
  shape: shapeProp,
  paused = false,
  onClick,
  onHover,
  focused = false,
  isDetailView = false,
  lonOffset = 0,
  latOffset = 0,
  onLandmarkClick,
  landmarkObjectsRef,
  registerObject,
  landmarks: landmarksProp,
}: PlanetProps) {
  // Backward compat: software-systems used to be implicitly cube-shaped via type
  const shape: PlanetShape =
    shapeProp ?? (type === "software-systems" ? "cube" : "sphere")
  const orbitRef = useRef<Group>(null)
  const planetGroupRef = useRef<Group>(null)
  const bodyGroupRef = useRef<Group>(null)
  const moonsContainerRef = useRef<Group>(null)
  const planetRef = useRef<Mesh>(null)
  const moonOrbitRefs = useRef<Group[]>([])
  const landmarkRefs = useRef<Mesh[]>([])
  const [hoveredLandmark, setHoveredLandmark] = useState<number | null>(null)
  // 0→1 scale-in of the focused landmark moons (eased in useFrame).
  const focusAnim = useRef(0)

  // "Effective time" — wall clock minus any time spent paused. Used to drive
  // moon orbits / spins so pause→play resumes smoothly from where motion left
  // off rather than jumping forward by however long we were paused.
  const effectiveTime = useRef(0)
  const prevWall = useRef<number | null>(null)

  const landmarks = landmarksProp ?? []
  const orbits = useMemo(() => landmarks.map((_, i) => moonOrbit(i)), [landmarks.length])

  // Report the live body mesh for history-driven dives. Registered once on
  // mount — the mesh instance is stable for the component's lifetime.
  useEffect(() => {
    registerObject?.(planetRef.current)
    return () => registerObject?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Body radius scales between orbit (size) and detail (4) modes.
  const bodyRadius = isDetailView ? 4 : size
  const sphereSegments = isDetailView ? 96 : 64

  const planetGeom = useMemo(
    () => makePlanetGeometry(shape, bodyRadius, sphereSegments, bump, seed),
    [shape, bodyRadius, sphereSegments, bump, seed],
  )

  useEffect(() => () => planetGeom.dispose(), [planetGeom])

  // Memoize the shaderMaterial JSX so its `uniforms` object reference stays
  // stable across re-renders. Without this, r3f sees a new prop reference each
  // render and replaces material.uniforms — which resets `time` to 0 and makes
  // shader animations (radar sweep, voronoi pulse) appear frozen after the
  // camera-transition completes.
  const planetMaterialJsx = useMemo(
    () => getPlanetMaterial(type, accentColor),
    [type, accentColor],
  )

  // Pre-build a unique crystal geometry per moon. Built whenever landmarks
  // exist (orbit planets too) so focusing never pays a build cost and the
  // ShaderWarmer's startup draw covers their material.
  const moonGeoms = useMemo(() => {
    if (!landmarks.length) return [] as THREE.BufferGeometry[]
    return landmarks.map((_, i) => makeCrystalMoon(0.36, i * 13.7 + 7))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landmarks.length])

  useEffect(
    () => () => moonGeoms.forEach((g) => g.dispose()),
    [moonGeoms],
  )

  useFrame((state) => {
    const wall = state.clock.elapsedTime
    const dt = prevWall.current !== null ? wall - prevWall.current : 0
    if (prevWall.current !== null && !paused) {
      effectiveTime.current += dt
    }
    prevWall.current = wall
    const et = effectiveTime.current

    // Orbit revolution — gated by `paused` (user freeze) and `focused`
    // (a selected planet parks in place while the camera visits it; its
    // siblings keep orbiting).
    if (!isDetailView && orbitRef.current && speed && !paused && !focused) {
      orbitRef.current.rotation.y += speed
    }

    if (isDetailView && planetGroupRef.current) {
      planetGroupRef.current.rotation.x = latOffset
    }

    if (planetRef.current) {
      if (!paused) {
        // Focused planets calm down: slow axial spin only, no tumble, so
        // the surface is inspectable and the joystick offsets read clearly.
        const rotationSpeed = isDetailView || focused ? 0.005 : 0.01
        planetRef.current.rotation.y += rotationSpeed
        if (!isDetailView && !focused) {
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

    // Joystick offsets on the focused in-orbit planet (the body group wraps
    // the spinning mesh, so the offsets stack on top of the natural spin).
    if (!isDetailView && bodyGroupRef.current) {
      bodyGroupRef.current.rotation.y = focused ? lonOffset : 0
      bodyGroupRef.current.rotation.x = focused ? latOffset : 0
    }

    // Focused landmark moons crystallize in/out slowly (~0.9s ease).
    if (!isDetailView && moonsContainerRef.current) {
      const target = focused ? 1 : 0
      focusAnim.current += (target - focusAnim.current) * Math.min(1, dt * 2.4)
      const s = Math.max(focusedOrbitScale(size) * focusAnim.current, 0.0001)
      moonsContainerRef.current.scale.setScalar(s)
      moonsContainerRef.current.visible = focusAnim.current > 0.015
    }

    if (isDetailView || focused) {
      // Moons drive off `et` (effective time) so they freeze in place when
      // paused and resume from exactly where they left off — no jumps.
      orbits.forEach((o, i) => {
        const g = moonOrbitRefs.current[i]
        if (g) g.rotation.y = o.phase + et * o.speed
      })

      // The hover pulse multiplies the mesh's BASE scale — in focused mode
      // the crystals are deliberately scaled up relative to the shrunken
      // orbit layout (see renderLandmarkMoons), and overwriting that with
      // a flat 1.0 was rendering them at half size.
      const baseScale =
        !isDetailView && focused
          ? focusedCrystalRadius(size) / (0.36 * focusedOrbitScale(size))
          : 1
      landmarkRefs.current.forEach((m, i) => {
        if (m) {
          // Hover-pulse uses wall time so the indicator stays alive during pause.
          m.scale.setScalar(
            baseScale *
              (hoveredLandmark === i ? 1.55 + Math.sin(wall * 4) * 0.18 : 1.0),
          )
          // Spin on et — paused moons hold their facets still.
          m.rotation.y = et * (0.4 + i * 0.07)
          m.rotation.x = et * (0.25 + i * 0.05) + i * 0.5
        }
      })
    }
  })

  const planetMesh = (
    <mesh
      ref={planetRef}
      geometry={planetGeom}
      position={[0, 0, 0]}
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
    >
      {planetMaterialJsx}
    </mesh>
  )

  const renderLandmarkMoons = (compact: boolean) => {
    const moonScale = compact
      ? focusedCrystalRadius(size) / (0.36 * focusedOrbitScale(size))
      : 1
    const haloScale = compact ? moonScale * 0.9 : 1

    return landmarks.map((landmark, index) => {
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
              <mesh scale={haloScale}>
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
                  if (landmarkObjectsRef) landmarkObjectsRef.current[index] = el
                }}
                geometry={moonGeoms[index]}
                scale={moonScale}
                onClick={(e) => {
                  e.stopPropagation()
                  onLandmarkClick?.(landmark, e.object)
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
              <mesh scale={0.55 * moonScale}>
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
                  position={[0, compact ? 1.05 : 0.7, 0]}
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
                        "var(--font-sans), system-ui, -apple-system, sans-serif",
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
    })
  }

  if (!isDetailView) {
    // Outer group tilts the orbital plane; inner orbitRef sweeps around the tilted Y
    // axis with an initial `phase` so planets aren't all aligned at boot.
    // The trail is a partial torus child of orbitRef — its leading edge always
    // sits at the planet (local +X), trailing back along the orbit so as the
    // group rotates, the arc rotates with it and reads as motion blur.
    const trailLength = (Math.PI * 2) / 3 // 120° arc
    const trailColor = accentColor || "#a0c0ff"
    return (
      <group rotation={[tilt, 0, 0]}>
        <group ref={orbitRef} rotation={[0, phase, 0]}>
          {/*
            Partial torus: arc covers theta 0 → trailLength. With the +π/2
            rotation around X, the torus sits in the XZ plane and theta=0
            lands at +X (the planet's local position), with the arc
            sweeping toward +Z. Since orbitRef advances .rotation.y in
            the +Y direction (which sends +X → -Z), +Z is the past — so
            the arc reads as a trail behind the planet's motion.
          */}
          <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={-50}>
            <torusGeometry args={[distance ?? 0, 0.045, 6, 96, trailLength]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              uniforms={{ uColor: { value: new THREE.Color(trailColor) } }}
              vertexShader={`
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                varying vec2 vUv;
                uniform vec3 uColor;
                void main() {
                  // vUv.x: 0 = leading edge (planet), 1 = far/trailing end.
                  // Bright at the planet, fades into space as the trail extends back.
                  float t = 1.0 - vUv.x;
                  float fade = t * t;
                  gl_FragColor = vec4(uColor * (0.5 + 0.7 * fade), fade * 0.5);
                }
              `}
            />
          </mesh>
          <group ref={bodyGroupRef} position={[distance || 0, 0, 0]}>
            {planetMesh}
            {landmarks.length > 0 && (
              <group ref={moonsContainerRef} visible={false}>
                {renderLandmarkMoons(true)}
              </group>
            )}
          </group>
        </group>
      </group>
    )
  }

  return (
    <group>
      <group ref={planetGroupRef}>{planetMesh}</group>

      {renderLandmarkMoons(false)}

      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, 0, 5]} intensity={0.3} color="#4080ff" />
    </group>
  )
}
