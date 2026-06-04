"use client"

import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useEffect, useRef, useState, type MutableRefObject } from "react"
import * as THREE from "three"
import { LIGHTING, UNIVERSE_CONFIG, type Landmark, type Universe } from "@/lib/constants"
import SolarSystem from "./solar-system"
import Planet from "./planet"
import StarField from "./star-field"
import StarNest from "./star-nest"
import Background from "./background"
import Nebula from "./nebula"
import SpaceAmbience from "./space-ambience"
import CosmicDust from "./cosmic-dust"
import Rift from "./rift"
import RiftCorridor, {
  RIFT_TIMING,
  type RiftCinematicState,
} from "./rift-corridor"
import MoonView from "./moon-view"
import UIOverlay from "./ui-overlay"

type Mode = "system" | "planet" | "moon"

// Easing helpers for the rift cinematic.
//   easeInCubic    → Phase A: accelerating dolly-IN (slow start, fast end)
//   easeInOutCubic → Phase C: smooth, lingering dolly-OUT (slow at both ends)
function easeInCubic(t: number): number {
  return t * t * t
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const RIFT_WORLD_POS = new THREE.Vector3(0, 16, -75)
const RIFT_OVERHEAD = new THREE.Vector3(0, 52, 0)
const ORIGIN = new THREE.Vector3(0, 0, 0)
// How close the camera gets to the rift core at the midpoint of the cinematic.
// Very close — the corridor at full opacity hides whatever the camera sees
// from inside the core's icosahedron (radius 1.2). User wanted the camera
// to get genuinely "right up to" the rift before the corridor takes over.
const RIFT_NEAR_DIST = 0.4
const RIFT_REVEAL_DIST = 7
// Reused scratch Vector3 for the lookAt lerp — avoids per-frame allocations.
const _lookAt = new THREE.Vector3()

function CameraController({
  mode,
  isTransitioning,
  setIsTransitioning,
  riftState,
  onSwapUniverse,
  onCinematicComplete,
}: {
  mode: Mode
  isTransitioning: boolean
  setIsTransitioning: (v: boolean) => void
  riftState: MutableRefObject<RiftCinematicState>
  onSwapUniverse: () => void
  onCinematicComplete: () => void
}) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 25, 0))
  // Captured camera position when stage 'in' starts, AND nearRift snapshot
  // when stage 'out' starts. Reused for the lerp source.
  const stageStartPos = useRef<THREE.Vector3 | null>(null)

  useFrame((state) => {
    const sr = riftState.current

    // ── Rift cinematic takes priority ─────────────────────────────────────
    // Stage machine driven by riftState.current (see rift-corridor.tsx for
    // timing constants).
    //   • 'in'   (2.5s): two sub-phases, sequenced.
    //       ROTATE (0.0-0.9s): camera holds at start, gaze smoothly pans
    //                          ORIGIN → RIFT_WORLD_POS. Corridor invisible.
    //                          You see the camera deliberately swing onto
    //                          the rift before any motion.
    //       ZOOM   (0.9-2.5s): camera accelerates toward nearRift along
    //                          the line through the rift, gaze locked on
    //                          the rift. Corridor fades in over the last
    //                          0.7s of zoom (see RIFT_TIMING.IN_FADE_*).
    //   • 'peak' (var):    camera held at rift, corridor at full opacity.
    //                      Universe swap fires when entering this stage.
    //                      Holds until riftState.ready flips true — set
    //                      by RiftCompileGate after gl.compileAsync
    //                      resolves (i.e. the new universe's shaders are
    //                      actually compiled). Min floor = 0.5s.
    //   • 'out'  (1.8s):   smooth pull OUT to overhead. Corridor fades
    //                      out over first 1.5s, crossfades into new rift.
    if (sr.stage !== "idle") {
      if (sr.stageStart < 0) {
        sr.stageStart = state.clock.elapsedTime
        if (sr.stage === "in") {
          stageStartPos.current = camera.position.clone()
        }
      }
      const t = state.clock.elapsedTime - sr.stageStart

      // nearRift = RIFT_NEAR_DIST units in front of the rift core.
      const riftDir = RIFT_WORLD_POS.clone().normalize()
      const nearRift = RIFT_WORLD_POS.clone().sub(
        riftDir.multiplyScalar(RIFT_NEAR_DIST),
      )

      if (sr.stage === "in") {
        if (t < RIFT_TIMING.IN_ROTATE_DURATION) {
          // ROTATE sub-phase: camera holds at its start position; gaze
          // pans smoothly from origin (sun) onto the rift.
          const k = easeInOutCubic(t / RIFT_TIMING.IN_ROTATE_DURATION)
          camera.position.copy(stageStartPos.current!)
          _lookAt.lerpVectors(ORIGIN, RIFT_WORLD_POS, k)
          camera.lookAt(_lookAt)
        } else if (t < RIFT_TIMING.IN_DURATION) {
          // ZOOM sub-phase: camera dollies start → nearRift, gaze locked
          // on the rift the whole time. Accelerating ease-in feels like
          // "spooling up to lightspeed" once we've committed to the dive.
          const localT =
            (t - RIFT_TIMING.IN_ROTATE_DURATION) / RIFT_TIMING.IN_ZOOM_DURATION
          const k = easeInCubic(Math.min(localT, 1))
          camera.position.lerpVectors(stageStartPos.current!, nearRift, k)
          camera.lookAt(RIFT_WORLD_POS)
        } else {
          // 'in' → 'peak'. Fire the universe swap (corridor is at full
          // opacity now, so it hides the actual mesh-tree swap).
          sr.stage = "peak"
          sr.stageStart = state.clock.elapsedTime
          onSwapUniverse()
        }
      } else if (sr.stage === "peak") {
        camera.position.copy(nearRift)
        camera.lookAt(RIFT_WORLD_POS)

        if (sr.ready && t >= RIFT_TIMING.PEAK_MIN_DURATION) {
          // 'peak' → 'out'. New universe shaders are compiled; release.
          sr.stage = "out"
          sr.stageStart = state.clock.elapsedTime
          stageStartPos.current = nearRift.clone()
        }
      } else if (sr.stage === "out") {
        const revealRift = RIFT_WORLD_POS.clone().sub(
          riftDir.multiplyScalar(RIFT_REVEAL_DIST),
        )
        const k = easeInOutCubic(Math.min(t / RIFT_TIMING.OUT_DURATION, 1))
        camera.position.lerpVectors(stageStartPos.current!, revealRift, k)
        camera.lookAt(RIFT_WORLD_POS)

        if (t >= RIFT_TIMING.OUT_DURATION) {
          sr.stage = "idle"
          sr.stageStart = -1
          stageStartPos.current = null
          onCinematicComplete()
        }
      }
      return
    }

    if (!isTransitioning) return
    if (mode === "moon") {
      // Default top-down. Sprite Html cards billboard to face the camera so
      // they stay readable regardless of angle. Tiny z offset breaks the
      // OrbitControls gimbal-lock singularity at polar angle 0.
      target.current.set(0, 12, 0.5)
    } else if (mode === "planet") {
      target.current.set(0, 0, 12)
    } else {
      target.current.set(0, 52, 0)
    }
    camera.position.lerp(target.current, 0.04)
    camera.lookAt(0, 0, 0)
    if (camera.position.distanceTo(target.current) < 0.5) {
      setIsTransitioning(false)
    }
  })

  return null
}

/**
 * ShaderWarmer
 *
 * Mounts inside the Canvas. On first mount calls `gl.compileAsync(scene,
 * camera)` which iterates ALL materials in the scene (incl. hidden meshes
 * via scene.traverse, regardless of visibility) and compiles their shader
 * programs to an internal 1×1 render target.
 *
 * Combined with the dual-mount system-mode JSX below (both universes'
 * SolarSystem + Rift mounted, inactive group set to visible=false), this
 * means by the time the user clicks the rift the OTHER universe's
 * shaders are already cached. The swap then becomes a visibility toggle,
 * not a fresh shader compile, so the corridor stops freezing mid-flight.
 *
 * Best-effort: compileAsync resolves async; if the user clicks rift
 * before warm-up finishes, RiftCompileGate (below) acts as a backup
 * gate.
 */
function ShaderWarmer({
  systemGroupRefs,
}: {
  systemGroupRefs: MutableRefObject<Record<Universe, THREE.Group | null>>
}) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const groups = Object.values(systemGroupRefs.current).filter(
      (group): group is THREE.Group => group !== null,
    )
    const originalVisibility = groups.map((group) => group.visible)
    const withAllSystemGroupsVisible = <T,>(fn: () => T): T => {
      groups.forEach((group) => {
        group.visible = true
      })
      try {
        return fn()
      } finally {
        groups.forEach((group, index) => {
          group.visible = originalVisibility[index]
        })
      }
    }

    const compileAsync = (
      gl as unknown as {
        compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>
      }
    ).compileAsync
    if (typeof compileAsync === "function") {
      withAllSystemGroupsVisible(() => compileAsync.call(gl, scene, camera)).catch(() => {
        /* swallow — three.js's program cache is the actual prize */
      })
    } else {
      try {
        withAllSystemGroupsVisible(() => gl.compile(scene, camera))
      } catch {
        /* ignore */
      }
    }
    // Run once on mount only — shader compile is one-shot per program.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, scene, systemGroupRefs])
  return null
}

/**
 * RiftCompileGate
 *
 * Watches `universe` and, on each change after initial mount, uses
 * `WebGLRenderer.compileAsync` (three.js r152+) to verify that ALL
 * materials in the new scene tree have been compiled before signaling the
 * rift cinematic that it's safe to transition out of 'peak'.
 *
 * Why: when the universe swaps, the new universe's planet shaders are
 * lazy-compiled on first render — that's the first-load freeze the user
 * was hitting (the corridor visually stalled because the GPU was blocked
 * compiling). compileAsync uses an internal 1×1 render target plus the
 * KHR_parallel_shader_compile extension to compile in the background and
 * resolves a Promise when finished, so we get a real "scene ready"
 * signal instead of a hardcoded setTimeout guess.
 *
 * If compileAsync isn't available (very old three.js / older browsers),
 * we fall back to synchronous compile() + a 300ms beat. A 4s hard
 * fallback prevents the cinematic from ever stalling indefinitely if
 * something pathological happens.
 */
function RiftCompileGate({
  universe,
  riftState,
}: {
  universe: Universe
  riftState: MutableRefObject<RiftCinematicState>
}) {
  const { gl, scene, camera } = useThree()
  const isFirstRun = useRef(true)

  useEffect(() => {
    // Skip the initial mount — we only want to gate the cinematic AFTER
    // a real universe swap.
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    let cancelled = false

    // Defer one frame so React has fully committed the new scene tree
    // (added the new planet meshes / shaders to three.js's scene graph)
    // before we ask the renderer to compile them.
    const raf = requestAnimationFrame(() => {
      if (cancelled) return

      const compileAsync = (
        gl as unknown as {
          compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>
        }
      ).compileAsync

      const markReady = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) riftState.current.ready = true
          })
        })
      }

      if (typeof compileAsync === "function") {
        compileAsync.call(gl, scene, camera).then(markReady).catch(markReady)
      } else {
        // Fallback for ancient three.js: synchronous compile + a small
        // post-flush delay to let the GPU breathe before the corridor
        // fades out.
        try {
          gl.compile(scene, camera)
        } catch {
          /* ignore */
        }
        setTimeout(markReady, 300)
      }
    })

    // Hard ceiling — if something stalls compileAsync (offline GPU,
    // browser bug), don't trap the user inside the corridor forever.
    const fallback = setTimeout(() => {
      if (!cancelled) riftState.current.ready = true
    }, 4000)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(fallback)
    }
  }, [universe, gl, scene, camera, riftState])

  return null
}

export default function SolarPortfolio() {
  const [universe, setUniverse] = useState<Universe>("professional")
  const [selectedPlanet, setSelectedPlanet] = useState<number | null>(null)
  const [planetRotation, setPlanetRotation] = useState({ lon: 0, lat: 0 })
  const [hoveredPlanet, setHoveredPlanet] = useState<number | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [riftActive, setRiftActive] = useState(false)
  // Stage state for the rift cinematic. Mutated in place by CameraController
  // and read by RiftCorridor — both run in useFrame on the same Canvas, so a
  // ref keeps them in sync without per-frame React re-renders.
  const riftState = useRef<RiftCinematicState>({
    stage: "idle",
    stageStart: -1,
    ready: true,
  })
  const systemGroupRefs = useRef<Record<Universe, THREE.Group | null>>({
    professional: null,
    personal: null,
  })
  // Joystick velocity from the navigation dial (-1..1 each axis). When non-zero
  // a RAF loop integrates it into planetRotation for continuous rotation.
  const joystickRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const { x, y } = joystickRef.current
      if (x !== 0 || y !== 0) {
        const speed = 1.6 // rad/sec at full deflection
        setPlanetRotation((p) => ({
          lon: p.lon + x * dt * speed,
          lat: p.lat - y * dt * speed,
        }))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const setJoystick = (vel: { x: number; y: number }) => {
    joystickRef.current = vel
  }

  // Spacebar = global pause toggle (so people can freeze the system to click moons easily)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const config = UNIVERSE_CONFIG[universe]
  const planets = config.planets
  const selected = selectedPlanet !== null ? planets[selectedPlanet] : null

  const mode: Mode = selectedLandmark ? "moon" : selectedPlanet !== null ? "planet" : "system"

  // When in moon mode, derive the moon's index in its planet's landmark list so
  // we hand the same seed to MoonView that the orbiting moon used.
  const landmarkIndex =
    selected && selectedLandmark ? selected.landmarks.indexOf(selectedLandmark) : -1
  const landmarkSeed = landmarkIndex >= 0 ? landmarkIndex * 13.7 + 7 : 0

  const handlePlanetClick = (idx: number) => {
    setSelectedPlanet(idx)
    setPlanetRotation({ lon: 0, lat: 0 })
    setIsTransitioning(true)
  }

  const handleLandmarkClick = (landmark: Landmark) => {
    setSelectedLandmark(landmark)
    setIsTransitioning(true)
  }

  const handleBackFromMoon = () => {
    setSelectedLandmark(null)
    setIsTransitioning(true)
  }

  const handleBack = () => {
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setIsTransitioning(true)
  }

  const handleEnterRift = () => {
    if (riftActive) return
    setSelectedPlanet(null)
    setSelectedLandmark(null)
    setHoveredPlanet(null)
    setRiftActive(true)
    // Initialize the cinematic stage. CameraController will pick this up on
    // its next frame and lazy-init the stageStart timestamp from the canvas
    // clock. Universe swap fires when CameraController transitions 'in' →
    // 'peak'; the corridor sits at full opacity until riftState.ready flips
    // true, which we schedule ~800ms after the swap.
    riftState.current = { stage: "in", stageStart: -1, ready: false }
  }

  const handleSwapUniverse = () => {
    setUniverse((u) => (u === "professional" ? "personal" : "professional"))
    setIsTransitioning(true)
    // riftState.ready stays false here. RiftCompileGate (rendered inside
    // Canvas, below) watches the `universe` prop and flips ready=true when
    // WebGLRenderer.compileAsync resolves — i.e. the new universe's shader
    // programs are actually compiled. The corridor + camera 'peak' stage
    // hold until then, so we never transition into a half-rendered scene.
  }

  const handleCinematicComplete = () => {
    setRiftActive(false)
  }

  // (Rotation now driven entirely by the NavDial joystick + the integrator above.)

  return (
    <div className="w-full h-screen relative overflow-hidden">
      <Background variant={config.backgroundVariant} />

      <Canvas
        camera={{ position: [0, 52, 0], fov: 60 }}
        gl={{ antialias: true }}
        onPointerDown={() => isTransitioning && setIsTransitioning(false)}
      >
        <Suspense fallback={null}>
          <StarNest
            // Personal universe stays soft pastel so the fractal doesn't fight
            // the bright pink/violet background. Public universe is pushed
            // toward light purple — knocks the natural warm/orange highlights
            // of the fractal toward lavender so the whole rim glow reads cool.
            brightness={config.backgroundVariant === "bright" ? 0.0009 : 0.0014}
            saturation={config.backgroundVariant === "bright" ? 0.55 : 0.85}
            tint={
              config.backgroundVariant === "bright"
                ? [1.05, 1.0, 1.05]
                : [1.05, 0.78, 1.55]
            }
          />
          <StarField />
          <Nebula variant={config.backgroundVariant} />
          <SpaceAmbience variant={config.backgroundVariant} />
          <CosmicDust variant={config.backgroundVariant} />
          <Environment preset="night" />
          <CameraController
            mode={mode}
            isTransitioning={isTransitioning}
            setIsTransitioning={setIsTransitioning}
            riftState={riftState}
            onSwapUniverse={handleSwapUniverse}
            onCinematicComplete={handleCinematicComplete}
          />
          <RiftCompileGate universe={universe} riftState={riftState} />

          <ambientLight intensity={LIGHTING.ambient} />

          {mode === "system" && (
            <>
              {/* Dual-mount — both universes mounted from app start, hidden
                  one toggled via visible=false. ShaderWarmer (one mount
                  below) compiles both universes' shader programs at
                  startup so the rift swap is just a visibility flip,
                  not a synchronous shader compile that stalls the
                  WebGL frame loop. */}
              {(["professional", "personal"] as Universe[]).map((u) => {
                const cfg = UNIVERSE_CONFIG[u]
                const isActive = u === universe
                return (
                  <group
                    key={u}
                    ref={(group) => {
                      systemGroupRefs.current[u] = group
                    }}
                    visible={isActive}
                  >
                    <SolarSystem
                      planets={cfg.planets}
                      sunVariant={cfg.sunVariant}
                      paused={paused || !isActive}
                      onSunClick={() => setPaused((p) => !p)}
                      onPlanetClick={handlePlanetClick}
                      onPlanetHover={setHoveredPlanet}
                    />
                    <Rift onClick={handleEnterRift} universe={u} paused={paused || !isActive} />
                  </group>
                )
              })}
              <ShaderWarmer systemGroupRefs={systemGroupRefs} />
            </>
          )}

          {mode === "planet" && selected && (
            <Planet
              isDetailView
              size={4}
              type={selected.type}
              accentColor={selected.color}
              bump={selected.bump}
              shape={selected.shape}
              seed={(selectedPlanet ?? 0) * 17.31}
              landmarks={selected.landmarks}
              lonOffset={planetRotation.lon}
              latOffset={planetRotation.lat}
              paused={paused}
              onLandmarkClick={handleLandmarkClick}
            />
          )}

          {mode === "moon" && selectedLandmark && (
            <MoonView landmark={selectedLandmark} seed={landmarkSeed} universe={universe} />
          )}

          {/* Rift transition — lightspeed corridor. Stage machine lives in
              CameraController; this just renders opacity from riftState. */}
          <RiftCorridor active={riftActive} riftState={riftState} />

          <OrbitControls
            // Pan stays off so rotation is always anchored to the sun (system),
            // the planet (planet detail), or the data crystal (moon).
            enablePan={false}
            target={[0, 0, 0]}
            enableZoom
            enableRotate
            minDistance={mode === "system" ? 30 : mode === "moon" ? 4 : 8}
            maxDistance={mode === "system" ? 90 : mode === "moon" ? 16 : 20}
            autoRotate={mode === "system" && !isTransitioning && !paused}
            autoRotateSpeed={0.1}
            maxPolarAngle={mode === "system" ? Math.PI / 2.2 : Math.PI}
            minPolarAngle={0}
          />
        </Suspense>
      </Canvas>

      <UIOverlay
        universe={universe}
        config={config}
        mode={mode}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        selectedPlanet={selectedPlanet}
        hoveredPlanet={hoveredPlanet}
        selectedLandmark={selectedLandmark}
        onBackToSystem={handleBack}
        onBackFromMoon={handleBackFromMoon}
        onJoystick={setJoystick}
        onEnterRift={handleEnterRift}
      />
    </div>
  )
}
