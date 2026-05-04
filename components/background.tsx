"use client"

type BackgroundVariant = "dark" | "bright"

interface BackgroundProps {
  variant?: BackgroundVariant
}

export default function Background({ variant = "dark" }: BackgroundProps) {
  if (variant === "bright") {
    return (
      <div className="absolute inset-0 z-0">
        {/* Twilight rose / lavender / peach base */}
        <div
          className="w-full h-full"
          style={{
            background: `
              linear-gradient(160deg, #2a0e3a 0%, #461a5a 22%, #6b2570 45%, #8c2f6c 70%, #a0436a 100%)
            `,
          }}
        />

        {/* Big nebula clouds */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 50% at 18% 55%, rgba(255, 100, 200, 0.32) 0%, transparent 65%),
              radial-gradient(ellipse 55% 40% at 82% 28%, rgba(120, 220, 255, 0.27) 0%, transparent 60%),
              radial-gradient(ellipse 45% 60% at 70% 80%, rgba(255, 200, 120, 0.24) 0%, transparent 55%),
              radial-gradient(ellipse 60% 35% at 40% 12%, rgba(180, 120, 255, 0.24) 0%, transparent 55%),
              radial-gradient(ellipse 40% 50% at 90% 65%, rgba(255, 160, 200, 0.22) 0%, transparent 50%)
            `,
          }}
        />

        {/* Bright nebula cores */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 22% 17% at 17% 57%, rgba(255, 140, 220, 0.30) 0%, transparent 50%),
              radial-gradient(ellipse 20% 14% at 81% 26%, rgba(150, 240, 255, 0.26) 0%, transparent 50%),
              radial-gradient(ellipse 17% 22% at 68% 82%, rgba(255, 220, 140, 0.22) 0%, transparent 50%),
              radial-gradient(ellipse 14% 18% at 32% 30%, rgba(255, 180, 230, 0.18) 0%, transparent 50%),
              radial-gradient(ellipse 18% 14% at 10% 35%, rgba(180, 140, 255, 0.20) 0%, transparent 50%)
            `,
          }}
        />

        {/* Wispy mid-layer streaks */}
        <div
          className="absolute inset-0 mix-blend-screen opacity-60"
          style={{
            background: `
              linear-gradient(115deg, transparent 30%, rgba(255, 200, 240, 0.10) 45%, transparent 60%),
              linear-gradient(-25deg, transparent 40%, rgba(180, 240, 255, 0.08) 55%, transparent 70%)
            `,
          }}
        />

        {/* Soft warm vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 130% 110% at 50% 50%, transparent 35%, rgba(40, 10, 60, 0.45) 100%)`,
          }}
        />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-0">
      {/* Deep space base */}
      <div
        className="w-full h-full"
        style={{
          background: `
            linear-gradient(160deg, #01010f 0%, #05030f 30%, #020818 60%, #030512 100%)
          `,
        }}
      />

      {/* Big nebula clouds */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 60%, rgba(99, 28, 210, 0.26) 0%, transparent 65%),
            radial-gradient(ellipse 55% 40% at 85% 25%, rgba(20, 60, 200, 0.22) 0%, transparent 60%),
            radial-gradient(ellipse 45% 60% at 70% 80%, rgba(180, 20, 100, 0.16) 0%, transparent 55%),
            radial-gradient(ellipse 60% 35% at 40% 10%, rgba(30, 100, 200, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 40% 50% at 90% 60%, rgba(80, 10, 160, 0.16) 0%, transparent 50%),
            radial-gradient(ellipse 35% 45% at 8% 30%, rgba(40, 80, 220, 0.14) 0%, transparent 50%)
          `,
        }}
      />

      {/* Bright nebula cores */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 20% 15% at 14% 62%, rgba(150, 80, 255, 0.22) 0%, transparent 50%),
            radial-gradient(ellipse 18% 12% at 84% 24%, rgba(60, 120, 255, 0.19) 0%, transparent 50%),
            radial-gradient(ellipse 15% 20% at 68% 82%, rgba(220, 60, 140, 0.16) 0%, transparent 50%),
            radial-gradient(ellipse 12% 18% at 30% 28%, rgba(200, 120, 255, 0.13) 0%, transparent 50%),
            radial-gradient(ellipse 16% 12% at 92% 70%, rgba(120, 60, 200, 0.14) 0%, transparent 50%)
          `,
        }}
      />

      {/* Subtle high-altitude streaks */}
      <div
        className="absolute inset-0 mix-blend-screen opacity-50"
        style={{
          background: `
            linear-gradient(125deg, transparent 35%, rgba(120, 80, 220, 0.08) 50%, transparent 65%),
            linear-gradient(-30deg, transparent 45%, rgba(40, 110, 220, 0.07) 55%, transparent 70%)
          `,
        }}
      />

      {/* Outer vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)`,
        }}
      />
    </div>
  )
}
