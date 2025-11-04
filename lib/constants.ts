// Lighting configuration
export const LIGHTING = {
  ambient: 0.05,
  sunIntensity: 8,
  sunDistance: 150,
  sunDecay: 2,
} as const

// Planet configuration
export const PLANET_TYPES = ["graphics", "algorithms", "ai-controls", "software-systems"] as const

export const PLANET_DATA = [
  { distance: 8, speed: 0.02, size: 1.0, type: "graphics" as const },
  { distance: 12, speed: 0.015, size: 1.2, type: "algorithms" as const },
  { distance: 16, speed: 0.01, size: 1.1, type: "ai-controls" as const },
  { distance: 20, speed: 0.008, size: 1.3, type: "software-systems" as const },
]

export const PLANET_NAMES = [
  "Graphics Planet",
  "Algorithms Planet",
  "Artificial Intelligence & Controls Planet",
  "Software & Systems Engineering Planet",
]

export const PLANET_DESCRIPTIONS = [
  "Computer Graphics & Visual Computing",
  "Data Structures, Algorithms & Optimization",
  "Machine Learning, AI & Control Systems",
  "Software Architecture & Systems Design",
]

// Landmark data
export interface Landmark {
  name: string
  position: [number, number, number]
  category: string
  description: string
  technologies: string[]
  link?: string
  color: string
}

export const LANDMARKS: Record<number, Landmark[]> = {
  0: [
    {
      name: "DE1-SoC Pinball Engine",
      position: [3, 2, 1.5],
      category: "Computer Graphics",
      description:
        "A fully from-scratch C implementation of a pinball game physics engine and renderer targeting the ARM-based Terasic DE1-SoC board. The game drives a VGA display, simulates rigid-body ball dynamics and collisions, and maps user input (flippers, launch) to hardware buttons—running in real time on an FPGA-backed HPS core. Demonstrated both on actual hardware and via the CPULator DE1-SoC simulator",
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
      position: [-2, 3, 2],
      category: "Generative Graphics",
      description:
        "A DCGAN that learns from a curated Pokémon image dataset to synthesize entirely new, Pokémon-style creatures. End-to-end: data collection, preprocessing, model design, training loops, and qualitative evaluation in a clean Jupyter workflow.",
      technologies: ["DCGAN", "Convolutional Networks", "Image Preprocessing", "Python/Jupyter", "Git/GitHub"],
      color: "#00ff80",
      link: "https://github.com/ahhmed-e/dcgan-pokemon",
    },
  ],

  1: [
    {
      name: "DeLorean GIS Dashboard",
      position: [3.2, 2, 2],
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
      color: "#00ff00",
      link: "https://youtu.be/e3XM7Xxnoa0?feature=shared",
    },
    {
      name: "DeLorean Route Optimizer",
      position: [-4, -1.5, -2],
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
      color: "#00cc44",
    },
  ],

  2: [
    {
      name: "Autonomous Helicopter Replanning (Capstone)",
      position: [2, 3, 2],
      category: "Robotics, Perception & Control",
      description:
        "End-to-end framework for a Bell 412 to detect cylindrical obstacles and autonomously replan collision-free, dynamically feasible trajectories. Integrates X-Plane 11, Gazebo/ROS sensor sim (LiDAR/IMU), LVI-SAM mapping, OctoMap, OMPL planning, quintic-spline time-param in MATLAB, and NMPC tracking under strict timing/safety constraints.",
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

  3: [
    {
      name: "Tenstorrent – Systems Engineering",
      position: [3, -2, 2],
      category: "Systems & Infrastructure",
      description:
        "Built and maintained bring-up & qualification infrastructure for next-gen AI accelerator chips: automated tests, hardware bring-up on dev boards, real AI workload perf/stress testing, power-measurement experiments, and cross-team silicon/board debug—taking a new processor from first-silicon through full qualification on CI.",
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
};
