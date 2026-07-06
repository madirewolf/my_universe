import PortfolioClient from "@/components/portfolio-client"
import { UNIVERSE_CONFIG } from "@/lib/constants"

// Crawlable + screen-reader mirror of the WebGL scene. The 3D canvas is
// invisible to crawlers and assistive tech, so this section carries the
// same content as server-rendered HTML. `sr-only` keeps it out of the
// visual layout without hiding it from either audience.
function AccessibleResume() {
  return (
    <section className="sr-only" aria-label="Portfolio content">
      <h1>Mohammad Abu Daqer — Interactive Portfolio</h1>
      <p>
        Computer engineer. This site is an interactive 3D solar system:
        every planet is a discipline, every moon is a project. The content
        below mirrors it as plain text.
      </p>
      <p>
        <a href="mailto:mohammad.abu.daqer@gmail.com">mohammad.abu.daqer@gmail.com</a>
        {" · "}
        <a href="/resume.pdf">Resume (PDF)</a>
        {" · "}
        <a href="https://www.linkedin.com/in/mohammad-abu-daqer/">LinkedIn</a>
        {" · "}
        <a href="https://www.instagram.com/limiliminal/">Instagram</a>
      </p>

      {(["professional", "personal"] as const).map((universe) => {
        const cfg = UNIVERSE_CONFIG[universe]
        return (
          <section key={universe}>
            <h2>{cfg.label}</h2>
            {cfg.planets.map((planet) => (
              <section key={planet.name}>
                <h3>{planet.name}</h3>
                <p>{planet.description}</p>
                {planet.tags.length > 0 && <p>{planet.tags.join(", ")}</p>}
                {planet.landmarks.map((landmark) => (
                  <article key={landmark.name}>
                    <h4>
                      {landmark.name} — {landmark.category}
                    </h4>
                    <p>{landmark.description}</p>
                    {landmark.technologies.length > 0 && (
                      <p>{landmark.technologies.join(", ")}</p>
                    )}
                    {landmark.link && (
                      <p>
                        <a href={landmark.link}>{landmark.link}</a>
                      </p>
                    )}
                  </article>
                ))}
              </section>
            ))}
          </section>
        )
      })}
    </section>
  )
}

export default function Home() {
  return (
    <main className="w-full h-screen">
      <PortfolioClient />
      <AccessibleResume />
    </main>
  )
}
