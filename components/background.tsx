"use client"

export default function Background() {
  return (
    <div className="absolute inset-0 z-0">
      {/* Deep space base */}
      <div
        className="w-full h-full"
        style={{
          background: `linear-gradient(160deg, #01010f 0%, #05030f 30%, #020818 60%, #030512 100%)`,
        }}
      />

      {/* Nebula clouds */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 60%, rgba(99, 28, 210, 0.22) 0%, transparent 65%),
            radial-gradient(ellipse 55% 40% at 85% 25%, rgba(20, 60, 200, 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 45% 60% at 70% 80%, rgba(180, 20, 100, 0.13) 0%, transparent 55%),
            radial-gradient(ellipse 60% 35% at 40% 10%, rgba(30, 100, 200, 0.14) 0%, transparent 55%),
            radial-gradient(ellipse 40% 50% at 90% 60%, rgba(80, 10, 160, 0.12) 0%, transparent 50%)
          `,
        }}
      />

      {/* Bright nebula cores */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 20% 15% at 14% 62%, rgba(130, 60, 255, 0.18) 0%, transparent 50%),
            radial-gradient(ellipse 18% 12% at 84% 24%, rgba(40, 90, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 15% 20% at 68% 82%, rgba(220, 40, 120, 0.12) 0%, transparent 50%)
          `,
        }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)`,
        }}
      />
    </div>
  )
}
