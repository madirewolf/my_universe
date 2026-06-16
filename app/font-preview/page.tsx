// TEMPORARY font-preview page — delete after picking fonts.
const FONTS = [
  { id: "Michroma", file: "/fonts/Michroma-Regular.ttf", note: "complete · wide geometric sci-fi" },
  { id: "BodoniModa", file: "/fonts/BodoniModa.ttf", note: "complete · elegant high-contrast serif" },
  { id: "Acthirey", file: "/fonts/Acthirey.ttf", note: "DEMO · decorative" },
  { id: "Bitsand", file: "/fonts/Bitsand.ttf", note: "DEMO · digital/pixel" },
  { id: "Gravitor", file: "/fonts/Gravitor.otf", note: "DEMO · sci-fi" },
  { id: "PixarOne", file: "/fonts/PixarOne.otf", note: "knockoff · playful rounded" },
  { id: "PixarTwo", file: "/fonts/PixarTwo.otf", note: "knockoff · playful rounded" },
]

export default function FontPreview() {
  const faces = FONTS.map(
    (f) => `@font-face{font-family:'${f.id}';src:url('${f.file}');font-display:swap;}`,
  ).join("\n")

  return (
    <main style={{ minHeight: "100vh", background: "#0a0e1a", color: "white", padding: "40px 48px", fontFamily: "system-ui" }}>
      <style dangerouslySetInnerHTML={{ __html: faces }} />
      <h2 style={{ opacity: 0.5, fontWeight: 600, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 28 }}>
        Font preview — pick two
      </h2>
      {FONTS.map((f) => (
        <section key={f.id} style={{ marginBottom: 34, paddingBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8fd9ff", marginBottom: 10 }}>
            {f.id} <span style={{ color: "rgba(255,255,255,0.4)" }}>— {f.note}</span>
          </div>
          <div style={{ fontFamily: `"${f.id}"`, fontSize: 40, lineHeight: 1.1, marginBottom: 6 }}>
            Welcome to my Universe
          </div>
          <div style={{ fontFamily: `"${f.id}"`, fontSize: 18, opacity: 0.8, marginBottom: 6 }}>
            or rather my solar system :P
          </div>
          <div style={{ fontFamily: `"${f.id}"`, fontSize: 15, opacity: 0.7 }}>
            The Question Underneath — Moon 1 / 5 — Algorithms &amp; Optimization 0123456789
          </div>
        </section>
      ))}
    </main>
  )
}
