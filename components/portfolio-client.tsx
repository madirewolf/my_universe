"use client"

import dynamic from "next/dynamic"

// The WebGL scene is client-only. The loading stand-in paints the same deep
// backdrop as the boot screen, so there is no blank/white flash between
// first paint and the bundle arriving (BootScreen takes over from there).
const SolarPortfolio = dynamic(() => import("./solar-portfolio"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 z-[200]"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #0a1020 0%, #030509 70%)" }}
    />
  ),
})

export default function PortfolioClient() {
  return <SolarPortfolio />
}
