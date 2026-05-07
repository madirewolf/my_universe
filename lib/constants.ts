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

/** Geometric shape of a planet's body. Defaults to "sphere". */
export type PlanetShape =
  | "sphere"
  | "cube"
  | "icosahedron"
  | "torus"
  | "torusKnot"
  | "dodecahedron"

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
      speed: 0.0072,
      size: 1.05,
      phase: 3.5,
      tilt: 0.12,
      bump: 0.03,
      shape: "torusKnot",
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
      speed: 0.0086,
      size: 1.45,
      phase: 5.0,
      tilt: -0.04,
      bump: 0,
      shape: "cube",
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
      speed: 0.0046,
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
      speed: 0.016,
      size: 0.95,
      phase: 1.1,
      tilt: 0.10,
      bump: 0.05,
      name: "Music",
      description: "Sounds I keep returning to. Mixes, playlists, listening lives.",
      color: "#ff66cc",
      tags: ["Mixing", "DJing", "Listening", "Producing"],
      landmarks: [
        {
          name: "mixSESH — DJ Mix Series",
          category: "Original Mixes",
          description:
            "Long-form mix sessions that stitch together genres and moods into one continuous listen — opening track sets the tone, last track is the comedown. Five mixes so far on Spotify (mixSESH 1 → 5), with the longer cuts also on SoundCloud. Click below to drop into mixSESH 5; older sessions are linked from my profile.",
          technologies: [
            "mixSESH 1 — open.spotify.com/playlist/0QUZYcvaSVXzFe4WHB6mPq",
            "mixSESH 2 — open.spotify.com/playlist/10ugI5sIchfeTM00jXOhgZ",
            "mixSESH 3 — open.spotify.com/playlist/0QUZYcvaSVXzFe4WHB6mPq",
            "mixSESH 4 — open.spotify.com/playlist/5DSAHSyD0GteGcVLFWoyuM",
            "mixSESH 5 — latest",
          ],
          color: "#ff66cc",
          link: "https://open.spotify.com/playlist/62xKFqjWWNyEAR770x8mTk",
        },
        {
          name: "SoundCloud — Long-form Sets",
          category: "DJ Sets & Edits",
          description:
            "Where the longer, looser stuff lives. Continuous mixes recorded in single sessions — DJ sets, house experiments, edits that aren't streaming-friendly. (Customize this paragraph with the names of your favourite uploaded sets.)",
          technologies: ["SoundCloud", "DJ Sets", "Continuous Mixes"],
          color: "#ff80b8",
          link: "https://soundcloud.com/personesque-bobensque",
        },
        {
          name: "Currently Spinning",
          category: "Artists in rotation",
          description:
            "The names I've been deep on lately. The list shifts every few weeks but these are the ones I keep returning to — across electronica, experimental hip hop, hyperpop, drain gang, IDM, ambient. English, French, Slavic, German, Arabic — anything that carves out its own emotional space.",
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
        },
        {
          name: "Genre Atlas",
          category: "What I tune into",
          description:
            "A wide net. Anything that feels new or unguarded — electronic and experimental are the centre of gravity, but the outer edges keep moving. Mostly English, French, Slavic, German, and Arabic-language tracks.",
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
        },
        {
          name: "What music means to me",
          category: "Personal note",
          description:
            "Placeholder — your paragraph on what music means to you. Time-binding? Emotional architecture? The way a track timestamps a year of your life and snaps you back to it years later? Replace this text with your own words in lib/constants.ts.",
          technologies: ["Personal", "Memory", "Mood"],
          color: "#ffd0f0",
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
      description: "Frameworks, questions, and thinkers I'm working with.",
      color: "#a070ff",
      tags: ["Synthesis", "Spectrum", "Order", "Bridging"],
      landmarks: [
        {
          name: "The Big Questions",
          category: "What I keep coming back to",
          description:
            "Five interlocking questions that pull at most of my thinking. How do we organize better as a species, holistically? How do we delete the barriers between us? How do we use tech to gamify, surpass, and hack our biology? What system lies after capitalism — it's done us good and bad and feels near the end of its cycle. And what role does AI play in whatever world order comes next?",
          technologies: [
            "species-scale coordination",
            "dissolving barriers",
            "biology hacking",
            "post-capitalism",
            "AI as catalyst",
          ],
          color: "#a070ff",
        },
        {
          name: "How I Frame It",
          category: "Operating principles",
          description:
            "Everything is a spectrum — but that doesn't mean frameworks are useless. Quite the opposite: because there are no black-and-white answers, all we DO have is ideologies and patterns. I don't believe in traditional hierarchy, but I do believe in order. Spiral dynamics + the pendulum swinging back and forth feels like the right shape for civilizational change. I fuck with absurdism, with non-duality, with the theory of unified consciousness, with quantum biomechanical models of the brain. I've gone through Peterson, Islam, Buddhism, Sufism — outgrown most as singular answers, kept the parts that hold up.",
          technologies: [
            "spectrum thinking",
            "spiral dynamics",
            "pendulum theory",
            "order, not hierarchy",
            "absurdism",
            "non-duality",
            "unified consciousness",
            "Sufi / Buddhist threads",
          ],
          color: "#c0a0ff",
        },
        {
          name: "Two-Pronged Mental Health",
          category: "Where I land hardest",
          description:
            "Mental health is double-pronged. It's not JUST the damn phone — but it's also not just \"take care of your nihilistic depressing thoughts.\" If you're wrecking your body with under- or over-sleep, disordered eating, no movement, cortisol-spiking workouts, drugs, self-medication — no amount of mindfulness fixes that. And if you're physically dialed but never doing the spiritual work — meditating, finding yourself, building morality from first principles, addressing your deep biases — you're still stuck. Balance both. Get your neurochemistry right so the brain isn't fighting an uphill battle to land on the right thoughts. Then do the inner work so it has somewhere to land.",
          technologies: [
            "neurochemistry",
            "spiritual work",
            "balance",
            "first principles morality",
            "bias awareness",
          ],
          color: "#a8b8ff",
        },
        {
          name: "What I'm Building Toward",
          category: "The project",
          description:
            "I want to bridge the gap between humans. I want to make social media SOCIAL AGAIN. I want to use tech to get rid of the mundane and focus on getting people to see through each other's differences. I want to make knowledge more easily accessible — make humans capable of acquiring the most accurate up-to-date research without needing to be deeply research-literate. And I keep coming back to E.O. Wilson's line: \"We have Paleolithic emotions, medieval institutions, and god-like technology.\" That's the gap to close. Take care of the Paleolithic emotions; understand they don't always align with logic; learn to feel them and be in the moment without being taken over — or take them over. Then upgrade the institutions. The tech is already further than we are.",
          technologies: [
            "bridge humans",
            "social media → social",
            "knowledge accessibility",
            "Paleolithic / medieval / god-like (Wilson)",
            "mirror-karma",
          ],
          color: "#c8a0ff",
        },
        {
          name: "Adjacent Minds",
          category: "Thinkers in the same territory",
          description:
            "People I've been deep on or that map onto where I've landed. I outgrew most of the canonical frameworks but these five are doing rigorous work where the canon waved its hands. Each one fills in part of the picture Peterson was reaching for but missed.",
          technologies: [
            "John Vervaeke — meaning crisis, 4E cognition",
            "Daniel Schmachtenberger — civilizational coordination",
            "Iain McGilchrist — divided brain, science + mysticism",
            "Bernardo Kastrup — analytic idealism, consciousness as ground",
            "E.O. Wilson — Consilience; the Paleolithic / medieval / god-like quote",
          ],
          color: "#b890ff",
        },
        {
          name: "What philosophy means to me",
          category: "Personal note",
          description:
            "Placeholder — write this in your own voice when you're ready. Why you do it, what it gives back, what it costs. (Edit in lib/constants.ts.)",
          technologies: ["Personal", "Practice"],
          color: "#d8b0ff",
        },
      ],
    },
    {
      type: "personal",
      distance: 17,
      speed: 0.0132,
      size: 0.7,
      phase: 2.5,
      tilt: 0.20,
      bump: 0.12,
      shape: "dodecahedron",
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
      speed: 0.0066,
      size: 1.5,
      phase: 5.8,
      tilt: -0.12,
      bump: 0.04,
      shape: "torus",
      name: "Films & Shows",
      description: "Stories that stuck. Watch diary lives on Letterboxd.",
      color: "#ffaa55",
      tags: ["Film", "Letterboxd", "Watching", "Reviews"],
      landmarks: [
        {
          name: "Letterboxd · @madirewolf",
          category: "Watch Diary",
          description:
            "Where I log everything I watch — ratings, reviews, lists. The four films pinned to the top of the profile are my all-time favourites; the diary is the live feed of what I'm working through. Click below to land on the profile.",
          technologies: ["Letterboxd", "Diary", "Reviews", "Lists"],
          color: "#ffaa55",
          link: "https://letterboxd.com/madirewolf/",
        },
        {
          name: "Favourite Directors",
          category: "Whose work I keep coming back to",
          description:
            "Five directors whose filmographies I treat as continuing studies — each one builds a coherent worldview across decades. I'll watch anything they make, and rewatch the canon.",
          technologies: [
            "Christopher Nolan",
            "Denis Villeneuve",
            "Wes Anderson",
            "Andrei Tarkovsky",
            "Quentin Tarantino",
          ],
          color: "#ffd080",
        },
        {
          name: "The Vault",
          category: "Films that stuck",
          description:
            "Some hit on first watch then deeper every rewatch (Fight Club, Whiplash, Memento, The Prestige). Some encode a feeling so cleanly they can't be undone (Manchester by the Sea, The Lighthouse, Nocturnal Animals). Some are pure aesthetic and meaning (Blade Runner 2049, Paprika, Coraline, Fantastic Mr Fox). All earned their place.",
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
          ],
          color: "#ffc080",
        },
        {
          name: "TV & Limited Series",
          category: "Long-form storytelling",
          description:
            "Series where the long format isn't padding — it's necessary architecture. Sherlock and Chernobyl prove the limited-series form can exceed feature films. Game of Thrones for the world-building and the descent. Adventure Time for the slow reveal that it was a serious work all along.",
          technologies: [
            "Sherlock (BBC miniseries)",
            "Chernobyl (HBO)",
            "Game of Thrones",
            "Adventure Time",
          ],
          color: "#ffb060",
        },
        {
          name: "What film means to me",
          category: "Personal note",
          description:
            "Placeholder — film as a relayer of human meaning and experience. The way 90 minutes of someone else's vision can encode a decade of their understanding, then transmit it into yours. (Replace with your own words in lib/constants.ts.)",
          technologies: ["Personal", "Meaning", "Empathy"],
          color: "#ffe0a0",
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
      description: "Vastness, time, and the things tech shields us from.",
      color: "#80e060",
      tags: ["Stargazing", "Ruins", "Desert", "Wilderness"],
      landmarks: [
        {
          name: "Wadi Rum — Stars I Couldn't See Before",
          category: "Jordan",
          description:
            "I'll never forget stargazing in Wadi Rum. I saw the infinite amount of stars that had always been right there, my whole life — yet I could never see them until that night when there was finally no light pollution. It made me reflect on tech and the role it plays in our lives. How we're, in many ways, controlled by our environment and shielded so heavily that the actual sky becomes invisible. Take the shielding away and the universe is just there.",
          technologies: [
            "Wadi Rum",
            "Jordan",
            "no light pollution",
            "infinite stars",
            "tech as shielding",
          ],
          color: "#80e060",
        },
        {
          name: "Old Worlds — Petra, Dead Sea, Bosphorus, Levant",
          category: "Civilizational time",
          description:
            "Petra and the Dead Sea — every step, a new civilization that used to be there, died, disappeared, and now all that remains are their homes etched into stone mountains. The fields of olive trees stretching across the Levant. The Strait of Istanbul — the Bosphorus — glistening under the sun, so many people died for it. Something in me yearns for archaeology and ruins of the past. As stereotypical as that is.",
          technologies: [
            "Petra",
            "Dead Sea",
            "Bosphorus",
            "Levant olives",
            "archaeology",
          ],
          color: "#a0ff80",
        },
        {
          name: "Home — Persian Gulf, Kuwaiti Desert",
          category: "Childhood vastness",
          description:
            "I grew up minutes from the Persian Gulf — that vast ocean a short walk from my door. Then there's the Kuwaiti desert: BBQs out there, infinite sands going on forever, ATVing across the dunes. Best memory of all: dragging a telescope into the middle of the desert with a friend in the middle of the night and seeing Jupiter and Saturn. The desert + the sky, no shielding, just looking up.",
          technologies: [
            "Persian Gulf",
            "Kuwait desert",
            "ATVing the dunes",
            "telescope nights",
            "Jupiter",
            "Saturn",
          ],
          color: "#90e890",
        },
        {
          name: "Canada — Backcountry, Canoes, Cottages",
          category: "Canada",
          description:
            "First camping trip in Canada was backcountry camping in Muskoka with friends — one of the most magical experiences of my life. Then canoeing through the Canadian nature for the first time. Getting rained on intensely on the docks and just laying there, taking it all in. Hiking through forests with friends near their cottages. Pure wilderness with no infrastructure between you and it. The trips you measure other trips against.",
          technologies: [
            "Muskoka backcountry",
            "canoeing",
            "rain on the docks",
            "cottage hikes",
            "first time",
          ],
          color: "#b0f8a0",
        },
        {
          name: "What nature means to me",
          category: "Personal note",
          description:
            "Genuinely nothing makes me feel as alive. Whether it's the stars in Wadi Rum, ruins in Petra, the Kuwaiti desert at night with a telescope, ATVing the dunes, canoeing through Canadian wilderness, hiking near a cottage, or just laying on a dock getting rained on — being near nature is the closest thing I get to being fully present. The meta-theme keeps showing up: light pollution as a metaphor for everything tech shields us from. Take away the shielding, look up, look back, and what was there the whole time is just there.",
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
