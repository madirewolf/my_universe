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
  /** Optional image paths (relative to /public, e.g. "/nyx/img.webp"). */
  images?: string[]
  /** Optional extra text panels rendered after the main description. */
  notes?: { label: string; kicker?: string; body: string }[]
  /** Optional list of labelled links rendered as stacked buttons. */
  links?: { label: string; url: string }[]
  /** Optional per-moon UI labels for the generated section tabs. */
  sectionLabels?: {
    story?: string
    tech?: string
    link?: string
    images?: string
  }
  /** Optional per-moon subtitles under tab labels. */
  sectionKickers?: {
    story?: string
    tech?: string
    link?: string
    images?: string
  }
  /** Hide the generated technologies/chips section when it is redundant. */
  hideTech?: boolean
  /** Render the generated tech section as prose instead of chips. */
  techAsText?: string
}

/** Geometric shape of a planet's body. Defaults to "sphere". */
export type PlanetShape =
  | "sphere"
  | "cube"
  | "icosahedron"
  | "torus"
  | "torusKnot"
  | "dodecahedron"
  | "capsule"

// PlanetEntry bundles everything about a planet: orbital params, presentation, content.
export interface PlanetEntry {
  type: string // shader key (see lib/shaders.tsx)
  distance: number
  speed: number
  size: number
  /** Initial orbit angle in radians; spreads planets around the ring at boot. */
  phase?: number
  /** Orbital plane inclination in radians; gives the system depth. */
  tilt?: number
  /** Vertex displacement amount (0–0.2). Adds noise-driven mountain relief to spheres / icos / dodecs. */
  bump?: number
  /** Body shape. Defaults to "sphere". */
  shape?: PlanetShape
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
  sunVariant: "warm" | "nebula" | "teal"
  backgroundVariant: "dark" | "bright"
  planets: PlanetEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL universe: the public-facing portfolio
// ─────────────────────────────────────────────────────────────────────────────

const PROFESSIONAL: UniverseConfig = {
  label: "Universe",
  eyebrow: "Interactive Portfolio",
  glitchSubtitle: "solar system :P",
  sunVariant: "teal",
  backgroundVariant: "dark",
  planets: [
    {
      type: "graphics",
      distance: 8,
      speed: 0.017,
      size: 0.9,
      phase: 0.2,
      tilt: 0.05,
      bump: 0.04,
      name: "Graphics",
      description: "Computer Graphics & Visual Computing",
      color: "#ff0080",
      tags: ["C/C++", "GPU", "Rendering", "Generative AI"],
      landmarks: [
        {
          name: "DE1-SoC Pinball Engine",
          category: "Computer Graphics",
          description:
            "A fully from-scratch C implementation of a pinball game physics engine and renderer targeting the ARM-based Terasic DE1-SoC board. The game drives a VGA display, simulates rigid-body ball dynamics and collisions, and maps user input (flippers, launch) to hardware buttons, running in real time on an FPGA-backed HPS core. Demonstrated both on actual hardware and via the CPULator DE1-SoC simulator.",
          technologies: [
            "Embedded Systems & Low-Level Programming",
            "Physics Simulation & Graphics Rendering",
            "Performance Optimization",
            "Toolchain & Debugging",
            "Software Engineering Practices",
          ],
          color: "#ff0080",
          link: "https://github.com/yixinlok/pinball",
          images: ["/professional/de1-soc-pinball.png"],
        },
        {
          name: "Pixelmon Dream Generator",
          category: "Generative Graphics",
          description:
            "A DCGAN that learns from a curated Pokémon image dataset to synthesize entirely new, Pokémon-style creatures. End-to-end: data collection, preprocessing, model design, training loops, and qualitative evaluation in a clean Jupyter workflow.",
          technologies: ["DCGAN", "Convolutional Networks", "Image Preprocessing", "Python/Jupyter", "Git/GitHub"],
          color: "#ff66c4",
          link: "https://github.com/ahhmed-e/dcgan-pokemon",
          images: ["/professional/pixelmon-dream-generator.png"],
        },
        {
          name: "Real-Time Web Audio Instrument",
          category: "Audio / DSP",
          description:
            "Browser-based real-time audio instrument using the Web Audio API for low-latency signal processing and interactive sound generation. This sits beside graphics because it is another real-time creative computing system: input, signal, timing, feedback, and direct sensory response.",
          technologies: [
            "TypeScript",
            "Web Audio API",
            "DSP",
            "low-latency signal processing",
            "interactive sound generation",
          ],
          color: "#ff4fb3",
          images: ["/professional/web-audio-instrument.png"],
        },
      ],
    },
    {
      type: "algorithms",
      distance: 13,
      speed: 0.012,
      size: 1.35,
      phase: 1.8,
      tilt: -0.08,
      bump: 0.09,
      name: "Algorithms",
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
          images: ["/professional/delorean-map.png"],
        },
        {
          name: "DeLorean Route Optimizer",
          category: "Pathfinding & Optimization",
          description:
            "Phase II of the DeLorean GIS adding intelligent routing, from BFS/Dijkstra/A* to multi-destination “travelling courier” with greedy/multistart/two-opt and multi-destination Dijkstra. Modular pipeline plus future work on constraint-aware trip recommendations.",
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
      speed: 0.0072,
      size: 1.05,
      phase: 3.5,
      tilt: 0.12,
      bump: 0.03,
      shape: "torusKnot",
      name: "Controls & Perception",
      description: "Robotics perception, simulation, motion planning, and control systems",
      color: "#4080ff",
      tags: ["ROS", "Perception", "SLAM", "NMPC", "Simulation"],
      landmarks: [
        {
          name: "Autonomous Helicopter",
          category: "Robotics, Perception & Control (Capstone)",
          description:
            "Year-long ECE496Y1 capstone restoring and extending an autonomous Bell-412 flight stack in high-fidelity simulation. Owned the perception and simulation/visualization workflow, online trajectory replanning, and secondary controls work: obstacles introduced in Gazebo became OpenCV/YOLO detections, detections became planner constraints, and the stack recomputed dynamically feasible trajectories tied back into SLAM state and NMPC tracking. Demonstrated waypoint cruise, obstacle replan, and safe landing end-to-end in a ~25,500 LoC C++ ROS/Gazebo system.",
          technologies: [
            "C++17",
            "ROS",
            "Gazebo SITL",
            "OpenCV",
            "YOLO",
            "LVI-SAM",
            "OctoMap",
            "ACADO",
            "qpOASES",
            "NMPC",
            "MAVLink",
            "CMake",
          ],
          color: "#4080ff",
          link: "https://github.com/sk-porwal/capstone",
          images: ["/professional/helicopter-capstone.png"],
        },
        {
          name: "GPS-Denied Navigation Module",
          category: "Autonomy & Sensor Fusion",
          description:
            "Active Vimy product R&D for flight-controller-agnostic GPS-denial support on small UAVs. Built a working demo that fuses vision, inertial, and lidar-derived state into MAVLink-compatible GPS/odometry outputs, then continued hardening the architecture with deterministic replay tooling, Docker builds, and license-clean dependency gates.",
          technologies: [
            "Python",
            "C++",
            "ROS",
            "Kimera-VIO",
            "OpenCV",
            "EKF",
            "MAVLink",
            "Docker",
            "GitHub Actions",
            "deterministic replay",
            "license audit",
          ],
          color: "#00e0ff",
          images: ["/professional/gnss-denied-demo.png"],
        },
        {
          name: "FinalFusion · Maritime Domain Awareness",
          category: "Multi-Modal Sensor Fusion",
          description:
            "Built prototype/demo architecture for a proposed Vimy maritime-domain-awareness pipeline fusing heterogeneous sensor streams into explainable, policy-aware outputs. The concept maps to DND/CAF multi-modal AI needs: SAR, optical, AIS, weather/ice, legacy radar, and OSINT sources fused into situational-awareness outputs with transparency hooks rather than black-box answers.",
          technologies: ["Sentinel-1 SAR", "Sentinel-2 Optical", "AIS", "AMSR2", "RADARSAT-1", "OSINT", "Multi-Sensor Fusion", "Explainable AI", "IEEE 7001", "Python"],
          color: "#00b8d4",
          images: ["/professional/flare-finalfusion-demo.png"],
        },
      ],
    },
    {
      type: "ai-controls",
      distance: 21,
      speed: 0.0064,
      size: 1.12,
      phase: 4.35,
      tilt: -0.12,
      bump: 0.04,
      shape: "dodecahedron",
      name: "Applied AI & Agentic Systems",
      description: "RAG pipelines, ranking systems, LLM workflows, and decision automation",
      color: "#8b5cff",
      tags: ["Python", "RAG", "LLMs", "pgvector", "Automation"],
      landmarks: [
        {
          name: "JobFinder",
          category: "Applied AI / RAG Product",
          description:
            "Sole-built job-discovery and application pipeline that ingests live postings, ranks them against an embedded resume/profile corpus, and drafts tailored application material. The system moves from regex pre-filtering to local Ollama embeddings, Claude Haiku triage, Claude Sonnet drafting, and pgvector-backed retrieval over a structured personal profile. It has async ingestion, migrations, structured logging, cost tracking, and a FastAPI + HTMX tracker UI around the model layer.",
          technologies: [
            "Python",
            "Anthropic API",
            "Claude Haiku",
            "Claude Sonnet",
            "Ollama",
            "nomic-embed-text",
            "Postgres 16",
            "pgvector",
            "FastAPI",
            "HTMX",
            "Alembic",
            "Typer",
            "psycopg3 async",
            "RAG",
          ],
          color: "#8b5cff",
        },
        {
          name: "IBKR Auto-Trader",
          category: "Decision Systems",
          description:
            "Live-money multi-strategy runner against Interactive Brokers ForecastEx using ib_async, with a hard daily loss circuit-breaker and an 8-point trade-approval gate before any prospective entry. The interesting part is not finance as an aesthetic; it is automation under real risk, where ranking, approval logic, scheduling, ledgering, and shutdown behavior all have consequences.",
          technologies: [
            "Python",
            "ib_async",
            "IBKR TWS/Gateway",
            "ForecastEx",
            "Postgres trade ledger",
            "APScheduler",
            "risk circuit breaker",
            "approval gates",
          ],
          color: "#a78bfa",
          images: [
            "/professional/ibkr-auto-trader-connect.png",
            "/professional/ibkr-auto-trader-strategies.png",
            "/professional/ibkr-auto-trader-trades.png",
          ],
        },
        {
          name: "AMMVER",
          category: "Explainable Forecasting / Defence AI",
          description:
            "Led engineering for Vimy's DND IDEaS Fast Forward project forecasting global emerging threats using a hybrid neural-network and hidden-Markov-model approach. Built and presented an explainable conflict-forecasting concept live to a technical and military review audience, tying public information, statistical modeling, and machine-learning forecasts into a decision-support workflow.",
          technologies: [
            "Hybrid neural networks",
            "Hidden Markov models",
            "Explainable AI",
            "Conflict forecasting",
            "DND IDEaS",
            "Decision support",
            "Policy-aware outputs",
          ],
          color: "#9d8bff",
          images: ["/professional/ammver-map.png"],
        },
      ],
    },
    {
      type: "software-systems",
      distance: 25,
      speed: 0.0086,
      size: 1.45,
      phase: 5.1,
      tilt: -0.04,
      bump: 0,
      shape: "cube",
      name: "Tenstorrent",
      description: "Software Architecture & Systems Design",
      color: "#ff8000",
      tags: ["Python", "CI/CD", "Hardware", "Systems"],
      landmarks: [
        {
          name: "Tenstorrent – Systems Engineering",
          category: "Systems & Infrastructure",
          description:
            "Built and maintained bring-up & qualification infrastructure for next-gen AI accelerator chips (Wormhole, Grayskull): automated tests, hardware bring-up on dev boards, real AI workload perf/stress testing, power-measurement experiments, and cross-team silicon/board debug, taking new processors from first-silicon through full qualification on CI.",
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
          images: [
            "/professional/tenstorrent-server.png",
            "/professional/tenstorrent-board-lineage.png",
            "/professional/tenstorrent-chip-socket.png",
            "/professional/tenstorrent-system-interface.png",
            "/professional/tenstorrent-debug-rig.png",
          ],
        },
      ],
    },
    {
      type: "autonomy",
      distance: 30,
      speed: 0.0046,
      size: 1.15,
      phase: 0.7,
      tilt: 0.18,
      bump: 0.06,
      name: "Vimy Systems",
      description: "Vimy deep-tech work across autonomy, defence AI, sensor fusion, and product demos",
      color: "#00e0ff",
      tags: ["Vimy", "Autonomy", "Defence AI", "Sensor Fusion", "Demos"],
      landmarks: [
        {
          name: "5GCx Pilot AI Evaluation",
          category: "Pilot Readiness & HMI Evaluation",
          description:
            "Supported engineering for a public AI/ML defence-tech platform focused on 5th-generation fighter lead-in training, pilot operational readiness, and human-machine-interface evaluation. Public framing emphasizes sensor fusion capacity, F-35 procurement fit, NORAD/NATO interoperability, and Canadian defence technology/data sovereignty; technical work stays intentionally high-level in the public portfolio.",
          technologies: ["Python", "Computer Vision", "Applied AI", "Sensor Fusion", "HMI Evaluation", "Pilot Readiness", "Defence Tech"],
          color: "#80f0ff",
          link: "https://5gcx.ai",
          images: ["/professional/5gcx-fighter.png"],
        },
        {
          name: "Drone Surge - Cardboard UAS Concept",
          category: "Attritable UAS / Systems Engineering",
          description:
            "Co-authored Vimy's Round 2 design package for DND's Drone Surge / UAS competition after a Round 1 selection and $35,000 award. Contributed the system-engineering matrix, schematic package, manufacturability arguments, and scalable low-cost attritable UAS concept work aligned with operational effectiveness, interoperability, and domestic industrial capacity.",
          technologies: [
            "DND IDEaS",
            "UAS",
            "attritable drones",
            "systems engineering matrix",
            "manufacturability",
            "schematic package",
            "interoperability",
          ],
          color: "#62e8ff",
          images: ["/professional/drone-surge-uas-render.png"],
        },
        {
          name: "Vimy.ai - Public Web Presence",
          category: "Web / Product Engineering",
          description:
            "Owned a large share of Vimy's public web presence: content architecture, visual direction, motion, 3D/Spline embeds, React 19 + Vite + Tailwind implementation, and deployment polish. The work translated deep-tech defence and AI programs into a public product surface that feels credible, technical, and presentable.",
          technologies: [
            "React 19",
            "Vite",
            "Tailwind",
            "Spline embeds",
            "content architecture",
            "motion",
            "deployment polish",
            "product storytelling",
          ],
          color: "#8af4ff",
          link: "https://vimy.ai",
          images: ["/professional/vimy-ai-website.png"],
        },
        {
          name: "Demos, Architecture & Responsible AI",
          category: "Productization & AI Governance",
          description:
            "The connective engineering at Vimy: translating research prototypes and proposal concepts into customer-facing demos and technical architectures across explainable AI, autonomy, and sensor-fusion programs — and the responsible-AI posture underneath them. IEEE 7001/7003 transparency and algorithmic-bias framing, ISO/IEC 42001 AI-management concepts, OpenLineage + PROV-O lineage capture, gitleaks scanning, and license-audit gates. The throughline is making early technical work both legible enough to evaluate and accountable enough to trust.",
          technologies: [
            "product demos",
            "technical architecture",
            "prototype hardening",
            "Docker",
            "CI hygiene",
            "IEEE 7001 / 7003",
            "ISO/IEC 42001",
            "OpenLineage + PROV-O",
            "license audit",
          ],
          color: "#a0f8ff",
          images: ["/professional/vimy-poster.png"],
        },
      ],
    },
    {
      type: "pill",
      distance: 35,
      speed: 0.0038,
      size: 1.3,
      phase: 2.8,
      tilt: -0.16,
      bump: 0,
      shape: "capsule",
      name: "Self-Hack",
      description: "Apps in progress. Tech as a layer between us and our biology: body, attention, sleep.",
      // Accent for orbit trail / tags / hover. Pill's two halves (red top,
      // yellow bottom) are hardcoded in the "pill" shader case.
      color: "#dc2626",
      tags: ["Mobile", "Self-Optimization", "Kotlin", "In Progress"],
      landmarks: [
        {
          name: "Redline · Voice-Coached Fitness",
          category: "Body / Mobile",
          description:
            "Native Kotlin + Jetpack Compose fitness app combining live voice-coached cadence/tempo coaching, nutrition tracking, and run tracking. Architecture includes Hilt dependency injection, Room local database layers, modular feature packages, coroutine workflows, DND-aware notifications, and runtime-permission rationale flows. The point: turn the workout phone into a coach, not a screen.",
          technologies: [
            "Kotlin",
            "Jetpack Compose",
            "Hilt",
            "Room",
            "Coroutines",
            "runtime permissions",
            "voice coaching",
            "run tracking",
            "nutrition tracking",
          ],
          color: "#c8ff40",
          images: [
            "/professional/redline-stats.png",
            "/professional/redline-home.png",
          ],
        },
        {
          name: "Reel It In · Reclaim Your Attention",
          category: "Attention / Mobile",
          description:
            "Working Android Accessibility Service that detects when the user enters Instagram Reels from addictive app surfaces and gently routes them out, while preserving useful DM-shared reels. Built with minimal-permission posture and a foreground-service pattern so the OS does not silently kill it. The premise is simple: reduce the infinite-scroll trap without forcing total abstinence from the social app.",
          technologies: [
            "Kotlin",
            "Accessibility Service",
            "AndroidX",
            "foreground service",
            "Instagram",
            "focus tooling",
            "anti-doomscroll",
          ],
          color: "#a8e828",
          images: ["/professional/reel-it-in-permissions.png"],
        },
        {
          name: "Lucid · Smart Wake (in design)",
          category: "Sleep / Wearables",
          description:
            "Alarm that doesn't just hit you with a noise at a fixed time. Reads heart-rate variability + motion from a watch to estimate sleep stage, then triggers in the next light-REM window, so you surface naturally rather than getting cortisol-slapped out of deep sleep. Working name; rename in lib/constants.ts.",
          technologies: [
            "WearOS · watch HRV",
            "REM-stage estimation",
            "circadian timing",
            "Android",
            "in design",
          ],
          color: "#88e060",
        },
        {
          name: "What I'm Hacking",
          category: "Thesis",
          description:
            "Three apps, one goal: tech as a deliberate layer between us and our biology. Not to escape it, but to relate to it on better terms. Body coaching, attention reclamation, and sleep-cycle alignment all aim at the same target: making the human stack more humane to live inside.",
          technologies: [
            "self as platform",
            "tech as scaffold",
            "biology hack",
            "deliberate friction",
          ],
          color: "#d8ff80",
        },
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL universe: the mirror side. Content here is placeholder; swap in
// real items when ready. The shape and visuals are wired up; the words aren't.
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAL: UniverseConfig = {
  label: "Inner Universe",
  eyebrow: "Off the clock",
  glitchSubtitle: "\\\\_†_// -=- <<-O->> .*.*-.-*-.-**-.-*-.-*-.-*.*. <<-O->>-=-",
  sunVariant: "nebula",
  backgroundVariant: "bright",
  planets: [
    {
      type: "personal",
      distance: 14,
      speed: 0.0086,
      size: 1.3,
      phase: 4.0,
      tilt: -0.07,
      bump: 0.07,
      shape: "icosahedron",
      name: "Philosophy",
      description: "How I think about work, technology, and building tools that help people connect.",
      color: "#a070ff",
      tags: ["Human-Centered Tech", "Connection", "Biology", "Systems"],
      landmarks: [
        {
          name: "Technology Should Connect",
          category: "Work Philosophy",
          description:
            "A lot of why I went into computer engineering is here. I am fascinated by systems that help people find each other, understand each other, and spend less time fighting tools. I want to build technology that reduces friction, makes knowledge easier to reach, and turns screens back into something more human.",
          technologies: [
            "connection",
            "knowledge access",
            "human-centered systems",
            "better social tools",
          ],
          color: "#a070ff",
          sectionLabels: {
            tech: "principles",
            story: "Why Tech",
          },
          sectionKickers: {
            tech: "what I want tools to do",
          },
        },
        {
          name: "Build Around The Human",
          category: "Biology & Design",
          description:
            "Good tools should respect how people actually live: attention, energy, sleep, movement, food, motivation, and habit. The point is not to escape being human. It is to design systems that make healthier choices easier and make daily life feel less hostile to the body.",
          technologies: [
            "attention",
            "energy",
            "sleep",
            "fitness",
            "behavior design",
          ],
          color: "#a8b8ff",
          sectionLabels: {
            tech: "human stack",
            story: "Human Biology",
          },
          sectionKickers: {
            tech: "systems that work with us",
          },
        },
        {
          name: "How I Work",
          category: "Engineering Style",
          description:
            "I like first-principles thinking, clear feedback loops, and systems that can be tested, debugged, and improved. Whether it is software, AI, maps, hardware, or personal tools, I care about making ideas practical enough to help real people.",
          technologies: [
            "first principles",
            "feedback loops",
            "debugging",
            "practical systems",
          ],
          color: "#c8a0ff",
          sectionLabels: {
            tech: "working style",
            story: "Engineering Mindset",
          },
          sectionKickers: {
            tech: "how I build",
          },
        },
      ],
    },
    {
      type: "cat",
      distance: 17,
      speed: 0.0132,
      size: 0.85,
      phase: 2.5,
      tilt: 0.20,
      bump: 0.04,
      shape: "sphere",
      name: "Nyx",
      description: "My small chaotic night creature. Docile, dramatic, yet somehow in charge.",
      color: "#1a1a22",
      tags: ["Cat", "Chaos", "Night", "Boss"],
      landmarks: [
        {
          name: "Why I Named Her Nyx",
          category: "Origin",
          description:
            "Nyx is the primordial Greek deity of night, daughter of Chaos. The name felt right immediately: small, dark, mysterious, and full of contained cosmic disorder. She is docile most of the time, but the night-creature energy is real.",
          technologies: [],
          color: "#7a6abf",
          sectionLabels: {
            tech: "name roots",
            images: "photos",
          },
          sectionKickers: {
            tech: "mythology",
            images: "first Nyx fragments",
          },
          images: [
            "/nyx/image-1780562125160.webp",
            "/nyx/image-1780562057110.webp",
            "/nyx/image-1780562088979.webp",
          ],
        },
        {
          name: "Gallery",
          category: "The boss in pictures",
          description:
            "Belly-out lounging, long dramatic stretches, constant eating, green-eyed stares, tongue-out bleps, full loaf mode, and sudden suspicion if she smells another cat. The whole Nyx experience.",
          technologies: ["chaos", "blep", "loaf", "bite", "kitten"],
          color: "#b0b0b0",
          hideTech: true,
          sectionLabels: {
            images: "photos",
          },
          sectionKickers: {
            images: "the boss in pictures",
          },
          images: [
            "/nyx/image-1780562099824.webp",
            "/nyx/image-1780562108138.webp",
            "/nyx/image-1780562117202.webp",
          ],
        },
      ],
    },
    {
      type: "personal",
      distance: 22,
      speed: 0.0066,
      size: 1.5,
      phase: 5.8,
      tilt: -0.12,
      bump: 0.04,
      shape: "torus",
      name: "Films & Shows",
      description: "Stories that make me think, feel, and stare at the wall after.",
      color: "#ffaa55",
      tags: ["Film", "Letterboxd", "Watching", "Reviews"],
      landmarks: [
        {
          name: "Letterboxd · @madirewolf",
          category: "Watch diary",
          description:
            "Where I log what I am working through: ratings, reviews, lists, rewatches, and whatever recently caught me off guard. This diary is far from complete!.",
          technologies: [],
          color: "#ffaa55",
          link: "https://letterboxd.com/madirewolf/",
          sectionLabels: {
            tech: "what's there",
            link: "open Letterboxd",
            story: "Letterboxd"
          },
          sectionKickers: {
            tech: "watch diary",
            link: "@madirewolf",
          },
        },
        {
          name: "Favourite Directors",
          category: "Whose work I keep coming back to",
          description:
            "I find tracking directors delivers very consistently! Directors I keep returning to because their films feel built from a worldview, not just a plot. Nolan for structure and moral pressure, Villeneuve for scale and dread, Anderson for constructed tenderness, Tarkovsky for spiritual time, Tarantino for style and tension.",
          technologies: [
            "Christopher Nolan",
            "Denis Villeneuve",
            "Wes Anderson",
            "Andrei Tarkovsky",
            "Quentin Tarantino",
          ],
          color: "#ffd080",
          sectionLabels: {
            story: "Favourite directors",
            tech: "directors",
          },
          sectionKickers: {
            tech: "whose work I return to",
          },
        },
        {
          name: "The Classics",
          category: "Films that stuck",
          description:
            "The films that stay with me usually have a scene where the floor drops out: Fight Club, Incendies, Memento, Prisoners, A Beautiful Mind, Shutter Island. I like twists when they are not cheap shock, but a new way of understanding the whole story. The best scenes feel like two people, or two versions of one person, acting out a much deeper philosophy, the White Lotus is a show that illustrates that really well!",
          technologies: [
            "Fight Club",
            "Whiplash",
            "Memento",
            "The Prestige",
            "Inception",
            "Interstellar",
            "Blade Runner",
            "Blade Runner 2049",
            "Prisoners",
            "Incendies",
            "Pulp Fiction",
            "Inglourious Basterds",
            "The Lighthouse",
            "Manchester by the Sea",
            "Nocturnal Animals",
            "Catch Me If You Can",
            "Gladiator",
            "Paprika",
            "Coraline",
            "Fantastic Mr Fox",
            "Matilda",
            "The Imitation Game",
            "A Beautiful Mind",
            "Shutter Island",
          ],
          color: "#ffc080",
          sectionLabels: {
            tech: "Fav films",
            story: "Favourite Films"
          },
          sectionKickers: {
            tech: "",
          },
        },
        {
          name: "TV & Limited Series",
          category: "fav shows",
          description:
            "Different formats hold different parts of me. I loved Game of Thrones for how unpredictable it was (till the last two seasons), as well as its beautiful dialogue, and explorations of morality. Daredevil for the raw dark feel. Adventure Time and Gumball were the cartoon worlds that shaped my younger brain. Tokyo Ghoul for the intense darkness. Sherlock and Chernobyl for proof that a limited series can hit with the force of film.",
          technologies: [
            "Sherlock (BBC miniseries)",
            "Chernobyl (HBO)",
            "Game of Thrones",
            "Adventure Time",
            "Daredevil",
            "Tokyo Ghoul",
            "Gumball",
          ],
          color: "#ffb060",
          sectionLabels: {
            tech: "shows",
            story: "Favourite shows",
          },
          sectionKickers: {
            tech: "",
          },
        },
        {
          name: "What film means to me",
          category: "Personal note",
          description:
            "Film, like music, is communication. I love moral dilemmas, gray areas, multidisciplinary stories, science that becomes philosophy, and art that makes me feel something before I can explain it. Arrival stayed with me because it treats language as a force that shapes reality, empathy, and even moral imagination. Samsara feels like a meditation. Prisoners asks what morality becomes under pressure. Incendies leaves you in shock. I like work with depth: make me think, make me feel, then make me reconsider what I thought I understood.",
          technologies: [
            "communication",
            "Samsara · meditation",
            "Lynch · trippy",
            "Interstellar · what you take for granted",
            "Memento / Shutter Island · mental state",
            "Prisoners · morality",
            "Incendies · shock",
            "Arrival · language",
            "movies that move",
          ],
          color: "#ffe0a0",
          sectionLabels: {
            tech: "what I look for",
            story: "What media means to me"
          },
          sectionKickers: {
            tech: "",
          },
          techAsText:
            "I look for communication under the plot: moral pressure, altered mental states, language shaping reality, spirituality, shock, empathy, and scenes that make the whole story rearrange itself in your head. The best films move first, then explain themselves later.",
        },
      ],
    },
    {
      type: "personal",
      distance: 28,
      speed: 0.0043,
      size: 1.25,
      phase: 0.4,
      tilt: 0.06,
      bump: 0.13,
      name: "Nature",
      description: "Vastness, survival, ruins. Moments that make my feel fully present.",
      color: "#80e060",
      tags: ["Stargazing", "Ruins", "Desert", "Wilderness"],
      landmarks: [
        {
          name: "A Sky Full of Stars",
          category: "Jordan",
          description:
            "Past midnight in Wadi Rum, I was lying on the red sand with my family, looking at stars I did not know a naked eye could see. It looked like something only a professional long-exposure camera could capture, but it was just there above us. Falling stars kept cutting across the sky every few seconds or minutes. I felt blissful, euphoric, and completely mind-blown by how much had always been there, hidden by light. I realized our technological impact on our environment was quite literally impeding our vision.",
          technologies: [
          ],
          images: [
            "/nature/wadi-rum-sky.png",
            "/nature/wadi-rum-tent.png",
            "/nature/wadi-rum-lil-bro.png",
          ],
          color: "#80e060",
        },
        {
          name: "Civilizations of Old",
          category: "Petra, Romans, Dead Sea, Bosphorus",
          description:
            "I love archaeology and ruins because they make me feel small inside history. They are beauty, mystery, proof that everything ends, and a way to touch the past. Every carved stone and old city feels like a reminder that entire worlds can vanish and still leave a shape behind. I have been lucky to see some of the most stunning ruins in the world: Petra, Roman Theaters, the Bosphorus, the beautiful mosques of Istanbul, the Hagia Sophia, the Levant olive fields, the Dead Sea, and many more.",
          technologies: [
          ],
          notes: [
            {
              label: "Olive fields",
              kicker: "Family farm in Jordan",
              body:
                "The olive fields I saw in the Levant were on my family's farm, next to their old swings. That memory feels different from Petra or the Bosphorus: less like a monument, more like inheritance. The olive fields felt like a reminder of my Palestinian roots, the land that my family came from, and the fact that I carry that history with me even if I have not lived there.",
            },
          ],
          images: [
            "/nature/petra.png",
            "/nature/mount-nebo-view.png",
            "/nature/mount-nebo-memorial-view.png",
            "/nature/amman-roman-theater.png",
            "/nature/amman-citadel-sister.png",
            "/nature/amman-hercules-arch-me.png",
            "/nature/hercules-statue-fields.png",
            "/nature/petra-church-floor.png",
          ],
          color: "#a0ff80",
        },
        {
          name: "Home",
          category: "Kuwait",
          description:
            "Kuwait nature is harsh, melancholic, but still beautiful. I grew up a few minutes from the Persian Gulf, with the beach always close. The desert was my favourite part though. It becomes so beautiful in the winter: BBQs, infinite sand, ATVing, and telescope nights looking for Jupiter and Saturn with friends and family. It also carries a story for me. Feeling the same sun Ghassan Kanafani speaks of in his book Men Under the Sun makes me reflect on my grandfather arriving to this land. As disapora I always felt so lost in this world till I found my people, but that is a constant reminder to my privilege and the fact that I am still indebted to the actions of those that came before me.",
          technologies: [
          ],
          images: ["/nature/kuwait-beach-me.png", "/nature/kuwait-waterline.png"],
          color: "#90e890",
        },
        {
          name: "Canada: Backcountry, Canoes, Cottages",
          category: "Canada",
          description:
            "Canada gave me a whole other version of nature! My first backcountry camping trip in Muskoka with friends is still one of the most magical experiences of my life. Canoeing through Canadian nature near Quebec, hiking through forests near cottages, and lying on docks while getting absolutely rained on all gave me that same feeling: nothing between me and the world. Just completely engulfed in the vastness and beauty of it all. ",
          technologies: [
          ],
          images: [
            "/nature/quebec-waterfall-reflection.png",
            "/nature/quebec-waterfall-rocks.png",
            "/nature/muskoka-marko.png",
            "/nature/muskoka-sander.png",
            "/nature/muskoka-camping-collage.png",
            "/nature/ottawa-parliament-river.png",
            "/nature/niagara-falls.png",
            "/nature/toronto-islands-ryan-sahib.png",
            "/nature/north-frontenac-cottage-nic.png",
            "/nature/north-frontenac-canoe-gold.png",
            "/nature/north-frontenac-canoe-sky.png",
            "/nature/canada-forest.png",
          ],
          color: "#b0f8a0",
        },
        {
          name: "What nature means to me",
          category: "Personal note",
          description:
            "Genuinely nothing makes me feel as alive. The stars in Wadi Rum, the ruins in Petra, the Kuwaiti desert at night, ATVing the dunes, canoeing through Canadian wilderness, hiking in the middle of the forest, or lying on a dock in the rain all point to the same thing. Nature forces meditation. Nature forces presentness. Nature forces humility. It is the ultimate vastness, the ultimate unknown, and the ultimate reminder that we are small and temporary. It is also the ultimate beauty, the ultimate connection to something bigger than ourselves, and the ultimate reminder that there is still wonder in the world.",
          technologies: [],
          color: "#c0ffc0",
        },
      ],
    },
  ],
}

export const UNIVERSE_CONFIG: Record<Universe, UniverseConfig> = {
  professional: PROFESSIONAL,
  personal: PERSONAL,
}
