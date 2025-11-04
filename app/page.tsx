
'use client'

import dynamic from "next/dynamic"

const SolarPortfolio = dynamic(() => import("@/components/solar-portfolio"), { ssr: false })

export default function Home() {
  return (
    <main className="w-full h-screen">
      <SolarPortfolio />
    </main>
  )
}
