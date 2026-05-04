// Lighting configuration
export const LIGHTING = {
  ambient: 0.05,
  sunIntensity: 8,
  sunDistance: 150,
  sunDecay: 2,
} as const

// Universes
export const UNIVERSES = ["professional", "personal"] as const
export type Universe = (typeof UNIVERSES)[number]

// Landmark = a single project / item attached to a planet, rendered as an orbiting moon.
export interface Landmark {
  name: string
  category: string
  description: string
  technologies: string[]
  link?: string
  color: string
}

// PlanetEntry bundles everything about a planet — orbital params, presentation, content.
export interface PlanetEntry {
  type: string // shader key (see lib/shaders.tsx)
  distance: number
  speed: number
  size: number
  /** Initial orbit angle in radians; spreads planets around the ring at boot. */
  phase?: number
  /** Orbital plane inclination in radians; gives the system depth. */
  tilt?: number
  /** Vertex displacement amount (0–0.2). Adds noise-driven mountain relief to spheres; ignored for cubes. */
  bump?: number
  name: string
  description: string
  color: string
  tags: string[]
  landmarks: Landmark[]
}

export interface UniverseConfig {
  label: string
  eyebrow: string
  glitchSubtitle: string
  sunVariant: "warm" | "nebula"
  backgroundVariant: "dark" | "bright"
  planets: PlanetEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL universe — the public-facing portfolio
// ─────────────────────────────────────────────────────────────────────────────

const PROFESSIONAL: UniverseConfig = {
  label: "Universe",
  eyebrow: "Interactive Portfolio",
  glitchSubtitle: "solar system :P",
  sunVariant: "warm",
  backgroundVariant: "dark",
  planets: [
    {
      type: "graphics",
      distance: 8,
      speed: 0.025,
      size: 0.9,
      phase: 0.2,
      tilt: 0.05,
      bump: 0.04,
      name: "Graphics Planet",
      description: "Computer Graphics & Visual Computing",
      color: "#ff0080",
      tags: ["C/C++", "GPU", "Rendering", "Generative AI"],
      landmarks: [
        {
          name: "DE1-SoC Pinball Engine",
          category: "Computer Graphics",
          description:
            "A fully from-scratch C implementation of a pinball game physics engine and renderer targeting the ARM-based Terasic DE1-SoC board. The game drives a VGA display, simulates rigid-body ball dynamics and collisions, and maps user input (flippers, launch) to hardware buttons—running in real time on an FPGA-backed HPS core. Demonstrated both on actual hardware and via the CPULator DE1-SoC simulator.",
          technologies: [
            "Embedded Systems & Low-Level Programming",
            "Physics Simulation & Graphics Rendering",
            "Performance Optimization",
            "Toolchain & Debugging",
            "Software Engineering Practices",
          ],
          color: "#ff0080",
          link: "https://github.com/yixinlok/pinball",
        },
        {
          name: "Pixelmon Dream Generator",
          category: "Generative Graphics",
          description:
            "A DCGAN that learns from a curated Pokémon image dataset to synthesize entirely new, Pokémon-style creatures. End-to-end: data collection, preprocessing, model design, training loops, and qualitative evaluation in a clean Jupyter workflow.",
          technologies: ["DCGAN", "Convolutional Networks", "Image Preprocessing", "Python/Jupyter", "Git/GitHub"],
          color: "#ff66c4",
          link: "https://github.com/ahhmed-e/dcgan-pokemon",
        },
      ],
    },
    {
      type: "algorithms",
      distance: 13,
      speed: 0.018,
      size: 1.35,
      phase: 1.8,
      tilt: -0.08,
      bump: 0.09,
      name: "Algorithms Planet",
      description: "Data Structures, Algorithms & Optimization",
      color: "#00d470",
      tags: ["C++", "Graphs", "Pathfinding", "Optimization"],
      landmarks: [
        {
          name: "DeLorean GIS Dashboard",
          category: "Data Visualization & HCI",
          description:
            "Student-focused GIS that visualizes POIs on an interactive map with POI-type & budget filters (via Yelp), custom iconography, and responsive decluttering through an “invisible grid.” Validated with think-aloud studies, timing, and heatmaps against ISO & Nielsen heuristics.",
          technologies: [
            "APIs",
            "Graphics Library",
            "Algorithms",
            "UI/Graphics Programming",
            "Data Integration & Filtering",
            "Usability Engineering & Testing",
          ],
          color: "#00d470",
          link: "https://youtu.be/e3XM7Xxnoa0?feature=shared",
        },
        {
          name: "DeLorean Route Optimizer",
          category: "Pathfinding & Optimization",
          description:
            "Phase II of the DeLorean GIS adding intelligent routing—from BFS/Dijkstra/A* to multi-destination “travelling courier” with greedy/multistart/two-opt and multi-destination Dijkstra. Modular pipeline plus future work on constraint-aware trip recommendations.",
          technologies: [
            "BFS",
            "Dijkstra",
            "A*",
            "Two-opt",
            "C++ multithreading",
            "OpenStreetMap",
            "Yelp API",
            "LibCurl/Boost",
            "Software Architecture & Performance Tuning",
          ],
          color: "#80ff90",
        },
      ],
    },
    {
      type: "ai-controls",
      distance: 17,
      speed: 0.011,
      size: 1.05,
      phase: 3.5,
      tilt: 0.12,
      bump: 0.03,
      name: "Artificial Intelligence & Controls Planet",
      description: "Machine Learning, AI & Control Systems",
      color: "#4080ff",
      tags: ["ROS", "NMPC", "LiDAR", "MATLAB"],
      landmarks: [
        {
          name: "Autonomous Helicopter Replanning (Capstone)",
          category: "Robotics, Perception & Control",
          description:
            "End-to-end framework for a Bell-412 to detect cylindrical obstacles and autonomously replan collision-free, dynamically feasible trajectories. Integrates X-Plane 11, Gazebo/ROS sensor sim (LiDAR/IMU), LVI-SAM mapping, OctoMap, OMPL planning, quintic-spline time-param in MATLAB, and NMPC tracking under strict timing/safety constraints. Year-long ECE496Y1 capstone, ~25,500 LoC C++.",
          technologies: [
            "ROS/Gazebo",
            "X-Plane 11",
            "LVI-SAM",
            "OctoMap",
            "OMPL",
            "MATLAB (Quintic Splines)",
            "NMPC",
            "RViz",
          ],
          color: "#4080ff",
          link: "https://github.com/sk-porwal/capstone",
        },
      ],
    },
    {
      type: "software-systems",
      distance: 21,
      speed: 0.013,
      size: 1.45,
      phase: 5.0,
      tilt: -0.04,
      bump: 0,
      name: "Software & Systems Engineering Planet",
      description: "Software Architecture & Systems Design",
      color: "#ff8000",
      tags: ["Python", "CI/CD", "Hardware", "Systems"],
      landmarks: [
        {
          name: "Tenstorrent – Systems Engineering",
          category: "Systems & Infrastructure",
          description:
            "Built and maintained bring-up & qualification infrastructure for next-gen AI accelerator chips (Wormhole, Grayskull): automated tests, hardware bring-up on dev boards, real AI workload perf/stress testing, power-measurement experiments, and cross-team silicon/board debug—taking new processors from first-silicon through full qualification on CI.",
          technologies: [
            "Hardware Bring-up & Debugging",
            "Python/Shell Test Automation",
            "CI/CD (GitLab Runners, Docker)",
            "Flask Web Front-end",
            "AI Workload Benchmarking",
            "IPMI/Redfish",
            "Data Acquisition & Analysis",
          ],
          color: "#ff8000",
          link: "https://tenstorrent.com/en",
        },
      ],
    },
    {
      type: "autonomy",
      distance: 27,
      speed: 0.007,
      size: 1.15,
      phase: 0.6,
      tilt: 0.18,
      bump: 0.06,
      name: "Autonomy & Defence Planet",
      description: "Autonomy, Sensor Fusion & Defence Tech",
      color: "#00e0ff",
      tags: ["ROS", "SLAM", "Sensor Fusion", "MAVLink", "Defence"],
      landmarks: [
        {
          name: "GPS-Denied Navigation Module",
          category: "Autonomy & Sensor Fusion",
          description:
            "Flight-controller-agnostic GPS-denial module for small UAVs. Combines visual-inertial odometry, lidar-aided SLAM, and map-matching to publish ersatz GPS + VIO state over MAVLink. License-checked CI pipeline (no-GPL policy enforced via dependency-licence audit) so the module embeds in customer products without contamination risk. Active R&D under Vimy Systèmes.",
          technologies: ["Python", "C++", "ROS", "Kimera-VIO", "OpenCV", "EKF", "MAVLink", "Docker", "GitHub Actions"],
          color: "#00e0ff",
        },
        {
          name: "FinalFusion — Maritime Domain Awareness",
          category: "Multi-Modal Sensor Fusion",
          description:
            "Lead architect for a maritime-domain-awareness pipeline fusing Sentinel-1 SAR, Sentinel-2 optical, AIS, AMSR2, RADARSAT-1, and OSINT inputs. Hybrid classical + learned fusion with explainability hooks aligned to IEEE 7001 transparency requirements. Submission to DND IDEaS CFP6 Challenge 13.",
          technologies: [
            "Sentinel-1 SAR",
            "Sentinel-2 Optical",
            "AIS",
            "Multi-Sensor Fusion",
            "Explainable AI",
            "IEEE 7001",
            "Python",
          ],
          color: "#00b8d4",
        },
        {
          name: "5GCx Pilot AI Evaluation",
          category: "Perception & Eye-Tracking",
          description:
            "Flight-simulator-based pilot performance and AI-assist evaluation tooling: IMU-augmented EKF head-pose estimation, gaze stabilization, fixation/saccade classification, area-of-interest analysis, and situational-awareness scoring. Co-developed YOLOv8 dataset auto-labeling tooling that materially reduced manual annotation effort.",
          technologies: ["Python", "OpenCV", "EKF", "YOLOv8", "Eye-Tracking", "PyTorch", "scikit-learn"],
          color: "#80f0ff",
          link: "https://5gcx.ai",
        },
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL universe — the mirror side. Content here is placeholder; swap in
// real items when ready. The shape and visuals are wired up; the words aren't.
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAL: UniverseConfig = {
  label: "Inner Universe",
  eyebrow: "Off the clock",
  glitchSubtitle: "soft little world",
  sunVariant: "nebula",
  backgroundVariant: "bright",
  planets: [
    {
      type: "personal",
      distance: 9,
      speed: 0.024,
      size: 0.95,
      phase: 1.1,
      tilt: 0.10,
      bump: 0.05,
      name: "Music",
      description: "Sounds I keep returning to.",
      color: "#ff66cc",
      tags: ["Producing", "Listening", "Live", "Theory"],
      landmarks: [
        {
          name: "Currently Spinning",
          category: "What's on rotation",
          description:
            "Placeholder — drop in current favourite albums / artists / sets. (Edit this in lib/constants.ts.)",
          technologies: ["album", "artist", "playlist"],
          color: "#ff66cc",
        },
        {
          name: "Production Setup",
          category: "Tools",
          description:
            "Placeholder — DAW, controllers, monitors, signal chain. (Edit this in lib/constants.ts.)",
          technologies: ["Ableton / FL / REAPER", "controller", "monitors"],
          color: "#ff8fdd",
        },
      ],
    },
    {
      type: "personal",
      distance: 14,
      speed: 0.013,
      size: 1.3,
      phase: 4.0,
      tilt: -0.07,
      bump: 0.07,
      name: "Philosophy",
      description: "Ideas worth chewing on.",
      color: "#a070ff",
      tags: ["Mind", "Ethics", "Reading", "Conversation"],
      landmarks: [
        {
          name: "Reading List",
          category: "Books in flight",
          description:
            "Placeholder — current and recent reads, plus the ones that changed how you think. (Edit this in lib/constants.ts.)",
          technologies: ["book", "essay", "paper"],
          color: "#a070ff",
        },
        {
          name: "Open Questions",
          category: "Things I'm wrestling with",
          description:
            "Placeholder — the puzzles you keep returning to. Mind, agency, meaning, etc. (Edit this in lib/constants.ts.)",
          technologies: ["question", "argument", "framework"],
          color: "#c0a0ff",
        },
      ],
    },
    {
      type: "personal",
      distance: 17,
      speed: 0.020,
      size: 0.7,
      phase: 2.5,
      tilt: 0.20,
      bump: 0.12,
      name: "Nyx",
      description: "My cat. The most important member of the household.",
      color: "#909090",
      tags: ["Cat", "Companion", "Mischief", "Naps"],
      landmarks: [
        {
          name: "About Nyx",
          category: "The boss",
          description:
            "Placeholder — Nyx's story: how you met, breed/look, signature moves, favourite spots. (Edit this in lib/constants.ts.)",
          technologies: ["cuddles", "zoomies", "supervisor"],
          color: "#b0b0b0",
        },
        {
          name: "Daily Patrol Route",
          category: "Routines",
          description:
            "Placeholder — the windowsill schedule, treat times, where Nyx insists on sleeping. (Edit this in lib/constants.ts.)",
          technologies: ["window", "fridge", "lap"],
          color: "#d0d0d0",
        },
      ],
    },
    {
      type: "personal",
      distance: 22,
      speed: 0.010,
      size: 1.5,
      phase: 5.8,
      tilt: -0.12,
      bump: 0.04,
      name: "Films & Shows",
      description: "Stories that stuck.",
      color: "#ffaa55",
      tags: ["Film", "TV", "Anime", "Documentary"],
      landmarks: [
        {
          name: "All-Time Top",
          category: "Things I've rewatched too many times",
          description:
            "Placeholder — your desert-island films and series. (Edit this in lib/constants.ts.)",
          technologies: ["film", "series", "anime"],
          color: "#ffaa55",
        },
        {
          name: "Recently Watched",
          category: "What's on the screen lately",
          description:
            "Placeholder — current rotation, what surprised you, what disappointed. (Edit this in lib/constants.ts.)",
          technologies: ["film", "show", "doc"],
          color: "#ffd080",
        },
      ],
    },
    {
      type: "personal",
      distance: 28,
      speed: 0.0065,
      size: 1.25,
      phase: 0.4,
      tilt: 0.06,
      bump: 0.13,
      name: "Nature",
      description: "The outside world.",
      color: "#80e060",
      tags: ["Hiking", "Plants", "Wildlife", "Water"],
      landmarks: [
        {
          name: "Favourite Places",
          category: "Spots I keep going back to",
          description:
            "Placeholder — trails, parks, lakes, viewpoints. (Edit this in lib/constants.ts.)",
          technologies: ["trail", "park", "lake"],
          color: "#80e060",
        },
        {
          name: "Field Notes",
          category: "Things I've noticed",
          description:
            "Placeholder — bird sightings, plant ids, weather you remember, seasons. (Edit this in lib/constants.ts.)",
          technologies: ["bird", "plant", "season"],
          color: "#a0ff80",
        },
      ],
    },
  ],
}

export const UNIVERSE_CONFIG: Record<Universe, UniverseConfig> = {
  professional: PROFESSIONAL,
  personal: PERSONAL,
}
