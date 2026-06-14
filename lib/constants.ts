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
      name: "Graphics Planet",
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
      name: "Controls & Perception Planet",
      description: "Robotics perception, simulation, motion planning, and control systems",
      color: "#4080ff",
      tags: ["ROS", "Perception", "SLAM", "NMPC", "Simulation"],
      landmarks: [
        {
          name: "Autonomous Helicopter Replanning (Capstone)",
          category: "Robotics, Perception & Control",
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
      name: "Applied AI & Agentic Systems Planet",
      description: "RAG pipelines, ranking systems, LLM workflows, and decision automation",
      color: "#8b5cff",
      tags: ["Python", "RAG", "LLMs", "pgvector", "Automation"],
      landmarks: [
        {
          name: "JobFinder - Job Discovery Pipeline",
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
          name: "IBKR Auto-Trader Manager",
          category: "Decision Systems / Live Risk",
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
          name: "AMMVER - Emerging Threat Forecasting",
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
      name: "Vimy Systems Planet",
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
          name: "MyDrumpad",
          category: "Music / Mobile",
          description:
            "Kotlin Android drum and loop pad built with a SoundPool audio engine, BPM control, and loop playback. Smaller than the other systems, but it connects the music side to the engineering side directly: touch, timing, rhythm, and software as instrument.",
          technologies: [
            "Kotlin",
            "Android",
            "SoundPool",
            "BPM control",
            "loop playback",
            "mobile audio",
          ],
          color: "#b8f050",
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
  glitchSubtitle: "soft little world",
  sunVariant: "nebula",
  backgroundVariant: "bright",
  planets: [
    {
      type: "personal",
      distance: 9,
      speed: 0.016,
      size: 0.95,
      phase: 1.1,
      tilt: 0.10,
      bump: 0.05,
      name: "Music",
      description: "Connection, euphoria, culture, and the sounds that make me feel alive.",
      color: "#ff66cc",
      tags: ["Mixing", "DJing", "Listening", "Producing"],
      landmarks: [
        {
          name: "euphoriphilia",
          category: "Playlist",
          description:
            "My main playlist, named around the love of euphoria. Not just happiness in the simple sense, but that shared, overflowing feeling where your first instinct is to give it to someone else. It lives somewhere between bliss, melancholy, chaos, release, and the small utopian hope that joy is supposed to be shared.",
          technologies: ["Spotify", "playlist", "euphoria", "always growing"],
          color: "#ff66cc",
          link: "https://open.spotify.com/playlist/2FQxHlFhPRnHfHnCC9uPF5",
          sectionLabels: {
            tech: "playlist notes",
            link: "link to playlist",
          },
          sectionKickers: {
            tech: "what it holds",
            link: "Spotify",
          },
        },
        {
          name: "SoundCloud",
          category: "DJ sets & edits",
          description:
            "Where the longer, looser experiments live. Mixing, DJing, and producing feel like capturing a feeling while it is still moving: bliss, therapy, dissociation, harmony. The technical side matters too, waves and frequencies and patterns, but it does not kill the magic. It makes the magic stranger. A few sets I'm proud of:",
          technologies: ["SoundCloud", "DJ sets", "continuous mixes"],
          color: "#ff80b8",
          link: "https://soundcloud.com/personesque-bobensque",
          sectionLabels: {
            tech: "sets / edits",
            link: "listen on SoundCloud",
          },
          sectionKickers: {
            tech: "where it lives",
            link: "mixes and tracks",
          },
          links: [
            {
              label: "Dopamine Kumo Mix",
              url: "https://soundcloud.com/personesque-bobensque/dopamine-kumo-mix",
            },
            {
              label: "FEEL IT CHAOS X BREATHE",
              url: "https://soundcloud.com/personesque-bobensque/feel-it-chaos-x-breathe",
            },
            {
              label: "hardcore sirdsapes x stop scaring the hoes",
              url: "https://soundcloud.com/personesque-bobensque/hardcore-sirdsapes-x-stop-scaring-the-hoes",
            },
            {
              label: "richasstaxi",
              url: "https://soundcloud.com/personesque-bobensque/richaxxtaxi",
            },
          ],
        },
        {
          name: "Currently Spinning",
          category: "On rotation",
          description:
            "The artists I've been deep on lately. It shifts every few weeks, but the thread is usually the same: sounds that feel new, emotional, synthetic, warped, or strangely human. Music has always been how I reached people and cultures I would not have accessed otherwise. English, French, Slavic, German, Arabic. If it hits, it hits.",
          technologies: [
            "Brutalismus 3000",
            "Autechre",
            "Bladee",
            "Benzii",
            "Whitearmor",
            "Oneohtrix Point Never",
            "FKA Twigs",
            "Playboi Carti",
            "Halsey",
            "Fakemink",
            "Mietze Conte",
            "Machine Girl",
          ],
          color: "#ff8fdd",
          link: "https://open.spotify.com/user/5xe060hdw181po4eo06pezsr2",
          sectionLabels: {
            tech: "current fav artists",
            link: "Spotify profile",
          },
          sectionKickers: {
            tech: "on rotation",
            link: "where I listen",
          },
        },
        {
          name: "Genre Atlas",
          category: "What I tune into",
          description:
            "A wide net, but not random. Electronic and experimental are the center of gravity because they feel like the future arriving through the body. Hyperpop, gabber, IDM, drain gang, ambient, rap, breakbeat, trance, glitch, and the edges in between. I like when a sound is unguarded enough to make me curious.",
          technologies: [
            "electro · hyperpop",
            "techno · gabber",
            "drain gang · cloud rap",
            "IDM · experimental",
            "left field bass",
            "post-techno punk",
            "indie · garage rock",
            "plunderphonics",
            "progressive electronic",
            "ambient",
            "uk garage · breakbeat",
            "trance · nu-disco",
            "drum & bass · drumstep",
            "electroacoustic · glitch",
            "vaporwave · digital futurism",
            "experimental hip hop",
            "rage rap · uk drill",
          ],
          color: "#ffb0e8",
          sectionLabels: {
            tech: "genres",
          },
          sectionKickers: {
            tech: "sounds I tune into",
          },
        },
        {
          name: "What music means to me",
          category: "Personal note",
          description:
            "Music is the great connector. It made me feel less alone: sharing songs with close friends, hearing records from Marco's massive vinyl collection, finding strangers through electro-pop, playing tracks out loud, or sitting alone in a dark room and listening to To Pimp a Butterfly from beginning to end. Raving gave me community, then taught me what parts of that world I had outgrown. It helped me understand hedonism and lostness by going through them, not just thinking about them. I found myself through chaos, and music is still the cleanest way I know to turn that chaos into connection.",
          technologies: [
            "the great connector",
            "catch a vibe",
            "frequency · resonance",
            "feeling captured",
            "DJ · mix · morph",
            "therapy · joy · euphoria",
            "liminal raving",
            "Raving · McKenzie Wark",
          ],
          color: "#ffd0f0",
          sectionLabels: {
            tech: "how it feels",
          },
          sectionKickers: {
            tech: "the recurring thread",
          },
          techAsText:
            "The throughline is connection: catching a vibe with someone, feeling frequency and resonance, DJing as a way to mix and morph emotion, and music as therapy, joy, euphoria, and release. Even raving sits there for me now: not just a scene, but a liminal place where I learned what I wanted, what I had outgrown, and what still made me feel alive.",
        },
      ],
    },
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
      description: "What makes me tick: uncertainty, consciousness, technology, and the urge to connect people.",
      color: "#a070ff",
      tags: ["Synthesis", "Spectrum", "Order", "Bridging"],
      landmarks: [
        {
          name: "The Question Underneath",
          category: "What I keep coming back to",
          description:
            "This planet is where I try to explain the question under almost everything I care about: how do I balance the animal part of me that wants happiness, food, touch, pleasure, play, and comfort with the conscious part that wants to fix everything, put people together, and be good? There is no final answer. It changes by person, moment, body, context, and stage of life. The only certainty is how uncertain things are.",
          technologies: [
            "animal self",
            "conscious self",
            "uncertainty",
            "balance",
            "being good",
          ],
          color: "#a070ff",
          sectionLabels: {
            tech: "core tension",
          },
          sectionKickers: {
            tech: "what keeps returning",
          },
        },
        {
          name: "How I Frame It",
          category: "Operating principles",
          description:
            "I used to get more attached to feeling like I had found the truth. Now I am more accepting that I probably have not. Everything is circular, everything is a spectrum, and that does not make frameworks useless. It makes them more important, because patterns are all we have when clean answers disappear. Order does not mean hierarchy to me. Things can unfold chronologically without becoming morally superior to what came before.",
          technologies: [
            "spectrum thinking",
            "spiral dynamics",
            "pendulum theory",
            "order, not hierarchy",
            "circular change",
            "uncertainty",
          ],
          color: "#c0a0ff",
          sectionLabels: {
            tech: "frameworks",
          },
          sectionKickers: {
            tech: "how I think with them",
          },
        },
        {
          name: "Two-Pronged Mental Health",
          category: "Where I land hardest",
          description:
            "Mental health is double pronged. It is not just the phone, but it is also not just your nihilistic thoughts. If you wreck your body with bad sleep, disordered eating, no movement, burnout workouts, drugs, or self-medication, mindfulness alone cannot carry you. If you optimize the body but never do the inner work, you are still stuck. Get the neurochemistry right so the brain is not fighting an uphill battle, then do the spiritual work: meditation, self-knowledge, first-principles morality, and bias awareness.",
          technologies: [
            "neurochemistry",
            "spiritual work",
            "balance",
            "first principles morality",
            "bias awareness",
          ],
          color: "#a8b8ff",
          sectionLabels: {
            tech: "mental health model",
          },
          sectionKickers: {
            tech: "body and inner work",
          },
        },
        {
          name: "What I'm Building Toward",
          category: "The project",
          description:
            "A lot of why I went into computer engineering is here. I am fascinated by tech because it can either extract attention from people or help them find each other. Social media feels broken because it was optimized to retain attention, not create connection. It amplifies fake highlights, anxiety, comparison, rage, misinformation, and shallow interaction. I want to make social media social again: real community, shared interests, friendship, knowledge access, and technology that removes the mundane so people can actually see each other.",
          technologies: [
            "bridge humans",
            "social media to social",
            "real community",
            "knowledge accessibility",
            "attention vs connection",
          ],
          color: "#c8a0ff",
          sectionLabels: {
            tech: "mission",
          },
          sectionKickers: {
            tech: "what I want tech to do",
          },
        },
        {
          name: "What I Keep",
          category: "Spirituality without inherited cruelty",
          description:
            "I reject traditionalism when it means clinging to old things only because they are old, but I understand why humans preserve old patterns. Sometimes it slows down the loss of things that still work. From religion and spirituality, I keep meditation, group meditation, kindness, ego dissolution, charity, cleanliness, purity of soul, solidarity, gentleness toward the innocent and weak, and hating the action without hating the person. I reject the inherited cruelty: sexism, racism, slavery, and anything that asks people to worship harm just because it is old.",
          technologies: [
            "meditation",
            "ego dissolution",
            "charity",
            "solidarity",
            "gentleness",
          ],
          color: "#b890ff",
          sectionLabels: {
            tech: "kept values",
          },
          sectionKickers: {
            tech: "what survives the critique",
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
      description: "My small chaotic night creature. Docile, dramatic, and somehow in charge.",
      color: "#1a1a22",
      tags: ["Cat", "Chaos", "Night", "Boss"],
      landmarks: [
        {
          name: "Why I Named Her Nyx",
          category: "Origin",
          description:
            "Nyx is the primordial Greek deity of night, daughter of Chaos. The name felt right immediately: small, dark, mysterious, and full of contained cosmic disorder. She is docile most of the time, but the night-creature energy is real.",
          technologies: ["Greek mythology", "primordial deity", "daughter of Chaos", "the night"],
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
            "Where I log what I am working through: ratings, reviews, lists, rewatches, and whatever recently caught me off guard. The diary is less about completionism and more about leaving a trail of what I was thinking about when I watched it.",
          technologies: ["Letterboxd", "diary", "reviews", "lists"],
          color: "#ffaa55",
          link: "https://letterboxd.com/madirewolf/",
          sectionLabels: {
            tech: "what's there",
            link: "open Letterboxd",
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
            "Directors I keep returning to because their films feel built from a worldview, not just a plot. Nolan for structure and moral pressure, Villeneuve for scale and dread, Anderson for constructed tenderness, Tarkovsky for spiritual time, Tarantino for style and tension.",
          technologies: [
            "Christopher Nolan",
            "Denis Villeneuve",
            "Wes Anderson",
            "Andrei Tarkovsky",
            "Quentin Tarantino",
          ],
          color: "#ffd080",
          sectionLabels: {
            tech: "directors",
          },
          sectionKickers: {
            tech: "whose work I return to",
          },
        },
        {
          name: "The Vault",
          category: "Films that stuck",
          description:
            "The films that stay with me usually have a scene where the floor drops out: Fight Club, Incendies, Memento, Prisoners, A Beautiful Mind, Shutter Island. I like twists when they are not cheap shock, but a new way of understanding the whole story. The best scenes feel like two people, or two versions of one person, acting out a much deeper philosophy.",
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
            tech: "films",
          },
          sectionKickers: {
            tech: "the ones that stuck",
          },
        },
        {
          name: "TV & Limited Series",
          category: "Long-form storytelling",
          description:
            "Different formats hold different parts of me. Game of Thrones for world-building and collapse. Daredevil for moral grit. Adventure Time and Gumball for the cartoon worlds that shaped my younger brain. Tokyo Ghoul for that darker anime register. Sherlock and Chernobyl for proof that a limited series can hit with the force of film.",
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
          },
          sectionKickers: {
            tech: "long-form worlds",
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
          },
          sectionKickers: {
            tech: "why it stays with me",
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
      description: "Vastness, survival, ruins, and the moments that make me feel fully alive.",
      color: "#80e060",
      tags: ["Stargazing", "Ruins", "Desert", "Wilderness"],
      landmarks: [
        {
          name: "Wadi Rum, Stars I Couldn't See Before",
          category: "Jordan",
          description:
            "Around 1 AM in Wadi Rum, I was lying on the red sand with my family, looking at stars I did not know a naked eye could see. It looked like something only a professional long-exposure camera could capture, but it was just there above us. Falling stars kept cutting across the sky every few seconds or minutes. I felt blissful, euphoric, and completely mind-blown by how much had always been there, hidden by light.",
          technologies: [
            "Wadi Rum",
            "Jordan",
            "no light pollution",
            "infinite stars",
            "tech as shielding",
          ],
          images: [
            "/nature/wadi-rum-sky.png",
            "/nature/wadi-rum-tent.png",
            "/nature/wadi-rum-lil-bro.png",
          ],
          color: "#80e060",
        },
        {
          name: "Old Worlds: Petra, Dead Sea, Bosphorus, Levant",
          category: "Civilizational time",
          description:
            "Petra, the Dead Sea, and the Bosphorus glistening under the sun. I love archaeology and ruins because they make me feel small inside history. They are beauty, mystery, proof that everything ends, and a way to touch the past. Every carved stone and old city feels like a reminder that entire worlds can vanish and still leave a shape behind.",
          technologies: [
            "Petra",
            "Dead Sea",
            "Bosphorus",
            "Levant olives",
            "archaeology",
          ],
          notes: [
            {
              label: "Olive fields",
              kicker: "family farm",
              body:
                "The olive fields I saw in the Levant were on my family's farm, next to their old swings. That memory feels different from Petra or the Bosphorus: less like a monument, more like inheritance, family, and a place that was quietly still there.",
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
          name: "Home: Persian Gulf, Kuwaiti Desert",
          category: "Childhood vastness",
          description:
            "Kuwait nature is harsh, lonely, solemn, melancholic, and still beautiful. I grew up a few minutes from the Persian Gulf, with the beach always nearby, and the desert becomes beautiful in winter: BBQs, infinite sand, ATVing, and telescope nights looking for Jupiter and Saturn. It also carries survival for me: heat, scarcity, mud shacks, refugee journeys, my grandfather arriving by boat, and the strange fact that people survive anyway.",
          technologies: [
            "Persian Gulf",
            "Kuwait desert",
            "ATVing the dunes",
            "telescope nights",
            "Jupiter",
            "Saturn",
          ],
          images: ["/nature/kuwait-beach-me.png", "/nature/kuwait-waterline.png"],
          color: "#90e890",
        },
        {
          name: "Canada: Backcountry, Canoes, Cottages",
          category: "Canada",
          description:
            "Canada gave me another kind of aliveness. My first backcountry camping trip in Muskoka with friends is still one of the most magical experiences of my life. Canoeing through Canadian nature, hiking through forests near cottages, and lying on docks while getting absolutely rained on all gave me that same feeling: nothing between me and the world, no interface, no shielding.",
          technologies: [
            "Muskoka backcountry",
            "canoeing",
            "rain on the docks",
            "cottage hikes",
            "first time",
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
            "Genuinely nothing makes me feel as alive. The stars in Wadi Rum, the ruins in Petra, the Kuwaiti desert at night, ATVing the dunes, canoeing through Canadian wilderness, hiking near a cottage, or lying on a dock in the rain all point to the same thing. Nature makes me present by removing the filters. Light pollution is the obvious metaphor, but it applies to so much tech: take away the shielding, look up, and what was there the whole time is just there.",
          technologies: ["Aliveness", "Presence", "Vastness", "Time"],
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
