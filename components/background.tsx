"use client"

export default function Background() {
  return (
    <div className="absolute inset-0 z-0">
      <div
        className="w-full h-full"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%),
            linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #0c0c1d 100%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(circle at 30% 70%, rgba(138, 43, 226, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(255, 20, 147, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(0, 191, 255, 0.05) 0%, transparent 70%)
          `,
        }}
      />
    </div>
  )
}
