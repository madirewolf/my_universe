import * as THREE from "three"

const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p){
    p = fract(p*0.3183099 + vec3(0.1,0.2,0.3));
    p *= 17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float noise(vec3 p){
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float n000 = hash(i + vec3(0,0,0));
    float n100 = hash(i + vec3(1,0,0));
    float n010 = hash(i + vec3(0,1,0));
    float n110 = hash(i + vec3(1,1,0));
    float n001 = hash(i + vec3(0,0,1));
    float n101 = hash(i + vec3(1,0,1));
    float n011 = hash(i + vec3(0,1,1));
    float n111 = hash(i + vec3(1,1,1));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }
  float fbm(vec3 p){
    float a=0.0, amp=0.5;
    for(int i=0;i<5;i++){
      a += amp * noise(p);
      p *= 2.07;
      amp *= 0.5;
    }
    return a;
  }
`

const LIGHTING_GLSL = /* glsl */ `
  struct LightOut { vec3 color; float ndl; float spec; float fres; };
  LightOut shade(vec3 n, vec3 v, vec3 l, vec3 base, float specPow, float specStr, float rimStr, float ambient){
    LightOut o;
    float ndl = max(dot(n,l), 0.0);
    vec3 h = normalize(l+v);
    float spec = pow(max(dot(n,h),0.0), specPow) * specStr * step(0.0, ndl);
    float fres = pow(1.0 - max(dot(n,v), 0.0), 2.0) * rimStr;
    vec3 col = base * (ambient + ndl) + spec + fres;
    o.color = col;
    o.ndl = ndl; o.spec = spec; o.fres = fres;
    return o;
  }
`

// Approximate normal perturbation for procedural relief. Tangent frames are
// built the same way around the object-space direction (used for sampling
// the height field) and the view-space normal (used for shading); because
// object->view is a rigid rotation the frames correspond closely enough for
// decorative noise bumps.
const BUMP_GLSL = /* glsl */ `
  void objTangents(vec3 sp, out vec3 t1, out vec3 t2) {
    vec3 up = abs(sp.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    t1 = normalize(cross(up, sp));
    t2 = cross(sp, t1);
  }
  vec3 bumpNormal(vec3 nView, float h0, float hx, float hy, float eps, float strength) {
    vec3 upV = abs(nView.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 t1v = normalize(cross(upV, nView));
    vec3 t2v = cross(nView, t1v);
    vec2 g = vec2(hx - h0, hy - h0) / eps;
    return normalize(nView - (t1v * g.x + t2v * g.y) * strength);
  }
`

function hexToVec3(hex: string): THREE.Color {
  return new THREE.Color(hex)
}

export function getPlanetMaterial(type: string, accentColor?: string) {
  switch (type) {
    case "graphics":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.5, 0.3, 0.9).normalize() },
            uAmbient: { value: 0.25 },
            uSpecPower: { value: 64.0 },
            uSpecStrength: { value: 0.35 },
            uRim: { value: 0.4 },
            uHueShift: { value: 0.9 },
            uBandFreq: { value: 2.0 },
            uFlakeScale: { value: 35.0 },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView; varying vec3 vObj;
            void main(){
              vUv = uv;
              vObj = normal;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vPos = wp.xyz;
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uRim, uHueShift, uBandFreq, uFlakeScale;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView, vObj;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vObj);
              float ndv = max(dot(n, v), 0.0);
              float film = pow(1.0 - ndv, 1.5);
              // Thin-film interference: per-channel phase offsets over the
              // optical thickness — soap-bubble pastels, not a raw hue wheel.
              float thick = film * 3.0 + 0.15 * sin(time * 0.3);
              vec3 iri = 0.5 + 0.5 * cos(6.28318 * (thick * vec3(0.90, 1.00, 1.15)) + vec3(0.0, 0.6, 1.2));
              iri = pow(iri, vec3(1.35));
              iri = mix(iri, vec3(1.0), 0.12);
              // Bands by latitude (continuous at poles)
              float bands = 0.5 + 0.5*sin(sp.y*3.14159*uBandFreq + time*0.8);
              vec3 bandCol = mix(vec3(0.8,0.1,0.5), vec3(0.0,1.0,0.6), bands);
              // Flake noise anchored to the planet body
              float flake = fbm(sp * uFlakeScale);
              vec3 base = mix(bandCol, iri, uHueShift) * (0.8 + 0.2*flake);
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, uRim, uAmbient);
              gl_FragColor = vec4(lo.color, 1.0);
            }
          `
          }
        />
      )

    case "algorithms":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(-0.3, 0.5, 0.8).normalize() },
            uAmbient: { value: 0.15 },
            uSpecPower: { value: 80.0 },
            uSpecStrength: { value: 0.5 },
            uVorScale: { value: 2.6 },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView; varying vec3 vObj;
            void main(){
              vUv = uv;
              vObj = normal;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vPos = wp.xyz;
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uVorScale;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView, vObj;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float h31s(vec3 p) {
              return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }
            vec3 h33(vec3 p) {
              p = vec3(
                dot(p, vec3(127.1, 311.7, 74.7)),
                dot(p, vec3(269.5, 183.3, 246.1)),
                dot(p, vec3(113.5, 271.9, 124.6))
              );
              return fract(sin(p) * 43758.5453);
            }

            // 3D voronoi — wraps seamlessly because we sample in 3D space
            vec3 voronoi3D(vec3 uvw) {
              vec3 id = floor(uvw);
              vec3 f  = fract(uvw);
              float d1 = 9999.0, d2 = 9999.0;
              vec3 cid = id;
              for (int z = -1; z <= 1; z++) {
                for (int y = -1; y <= 1; y++) {
                  for (int x = -1; x <= 1; x++) {
                    vec3 g   = vec3(float(x), float(y), float(z));
                    vec3 rnd = h33(id + g);
                    vec3 pt  = g + 0.5 + 0.42 * sin(time * 0.18 + 6.28318 * rnd);
                    float d  = length(f - pt);
                    if (d < d1) { d2 = d1; d1 = d; cid = id + g; }
                    else if (d < d2) { d2 = d; }
                  }
                }
              }
              return vec3(d1, d2, h31s(cid));
            }

            float isoline(float val, float freq, float w) {
              float s = fract(val * freq);
              return smoothstep(0.0, w, s) * (1.0 - smoothstep(w, w * 2.0, s));
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vObj);  // anchored to the planet, no seam

              // Voronoi cells (3D)
              vec3 vor = voronoi3D(sp * uVorScale);
              float edge     = 1.0 - smoothstep(0.0, 0.055, vor.y - vor.x);
              float edgeGlow = 1.0 - smoothstep(0.0, 0.15,  vor.y - vor.x);
              float ch        = vor.z;
              float cellPulse = step(0.45, ch) * (0.4 + 0.6 * sin(time * (0.2 + ch * 0.4) + ch * 6.28318));
              float cellFill  = clamp((0.5 - vor.x) * 2.0, 0.0, 1.0) * cellPulse;

              // FBM contour lines (3D)
              float n1 = fbm(sp * 3.0 + vec3(time * 0.05, 0.0, 0.0));
              float n2 = fbm(sp * 2.0 + vec3(0.4, time * 0.03, 0.0));
              float lines1   = isoline(n1, 10.0, 0.05);
              float lines2   = isoline(n2,  7.0, 0.06);
              float allLines = max(lines1 * 0.9, lines2 * 0.55);

              // Base color (anchored micro-noise too)
              float surf = fbm(sp * 12.0) * 0.03;
              vec3 col = vec3(0.01, 0.028, 0.016) + surf;
              col += vec3(0.0, 0.04, 0.022) * cellFill;
              vec3 lineCol = mix(vec3(0.0, 0.55, 0.32), vec3(0.15, 0.95, 0.55), n1);
              col = mix(col, lineCol, allLines * 0.88);
              col = mix(col, vec3(0.12, 0.95, 0.55), edge * 0.75);

              // Lighting
              LightOut lo = shade(n, v, l, col, uSpecPower, uSpecStrength, 0.0, uAmbient);

              // Emissive
              vec3 em = vec3(0.0);
              em += vec3(0.0,  0.65, 0.38) * allLines * 0.7;
              em += vec3(0.08, 0.9,  0.52) * edgeGlow * 0.4;
              em += vec3(0.2,  1.0,  0.65) * edge     * 0.55;
              em += vec3(0.0,  0.28, 0.16) * cellFill * 0.4;
              em += vec3(0.7,  1.0,  0.85) * allLines * edge * 2.0;
              float fres = pow(1.0 - max(dot(n, v), 0.0), 3.5);
              em += vec3(0.0, 0.9, 0.5) * fres;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "perception":
      // LiDAR mapping planet (Controls & Perception). A scan blade sweeps
      // around the body; a 3D point cloud lights up as the blade passes and
      // decays behind it — the world being SLAM-mapped in real time.
      // Samples object-space position: well-defined on the torus knot.
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.5, 0.8).normalize() },
            uAmbient: { value: 0.2 },
            uAccent: { value: hexToVec3(accentColor || "#4080ff") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
            void main() {
              vLocal = position;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient;
            uniform vec3 uLightDir, uAccent;
            varying vec3 vN, vView, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            vec3 h33p(vec3 p) {
              p = vec3(
                dot(p, vec3(127.1, 311.7, 74.7)),
                dot(p, vec3(269.5, 183.3, 246.1)),
                dot(p, vec3(113.5, 271.9, 124.6)));
              return fract(sin(p) * 43758.5453);
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 op = vLocal;

              // Scan blade sweeping around the body's Y axis. lag = how long
              // ago the blade passed this longitude (0 = just now).
              float lon = atan(op.z, op.x);
              float lag = fract((time * 0.11) - lon * 0.15915494);
              float afterglow = exp(-lag * 5.5);
              float blade = exp(-lag * 90.0);

              // Point cloud — jittered points on a 3D grid, revealed by the
              // blade and fading behind it like a radar afterimage.
              vec3 g = op * 7.5;
              vec3 id = floor(g);
              vec3 rnd = h33p(id);
              float has = step(0.3, rnd.x);
              float d = length(fract(g) - (0.25 + rnd * 0.5));
              float pt = smoothstep(0.3, 0.1, d) * has;

              // Unmapped world: near-black steel with faint structure
              float surf = fbm(op * 5.0);
              vec3 base = uAccent * 0.045 + vec3(0.008, 0.01, 0.016) + surf * 0.025;
              // The blade itself razors across the surface
              base += uAccent * 0.5 * blade;

              LightOut lo = shade(n, v, l, base, 60.0, 0.18, 0.0, uAmbient);

              // Mapped points: fresh hits ping white-hot, then cool into the
              // accent and fade until the next revolution re-paints them.
              vec3 em = uAccent * pt * afterglow * 1.1;
              em += mix(uAccent, vec3(0.85, 1.0, 1.0), 0.7) * pt * blade * 2.4;
              em += uAccent * 0.28 * blade;

              // Sensor-housing rim
              float fres = pow(1.0 - max(dot(n, v), 0.0), 3.5);
              em += uAccent * fres * 0.9;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "applied-ai":
      // Neural-network planet (Applied AI & Agentic Systems). Voronoi cells
      // are neurons: nuclei blink with activation, synapse edges glow, and
      // expanding activation waves ripple outward from firing neurons while
      // a slow attention wave washes across the whole network.
      // Samples object-space position: continuous across the dodecahedron's
      // flat facets (its normals are not).
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.5, 0.8).normalize() },
            uAmbient: { value: 0.2 },
            uAccent: { value: hexToVec3(accentColor || "#8b5cff") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
            void main() {
              vLocal = position;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient;
            uniform vec3 uLightDir, uAccent;
            varying vec3 vN, vView, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float h31n(vec3 p) {
              return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
            }
            vec3 h33n(vec3 p) {
              p = vec3(
                dot(p, vec3(127.1, 311.7, 74.7)),
                dot(p, vec3(269.5, 183.3, 246.1)),
                dot(p, vec3(113.5, 271.9, 124.6)));
              return fract(sin(p) * 43758.5453);
            }

            // 3D voronoi: x = dist to nearest neuron, y = second nearest,
            // z = nearest neuron's hash.
            vec3 neuronField(vec3 p) {
              vec3 id = floor(p);
              vec3 f = fract(p);
              float d1 = 9999.0, d2 = 9999.0;
              float ch = 0.0;
              for (int z = -1; z <= 1; z++)
              for (int y = -1; y <= 1; y++)
              for (int x = -1; x <= 1; x++) {
                vec3 g = vec3(float(x), float(y), float(z));
                vec3 rnd = h33n(id + g);
                vec3 pt = g + 0.22 + rnd * 0.56;
                float d = length(f - pt);
                if (d < d1) { d2 = d1; d1 = d; ch = h31n(id + g); }
                else if (d < d2) { d2 = d; }
              }
              return vec3(d1, d2, ch);
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 op = vLocal;

              vec3 net = neuronField(op * 2.4);
              float h = net.z;

              // Neuron activation — each cell fires on its own rhythm
              float act = 0.5 + 0.5 * sin(time * (0.5 + h * 1.6) + h * 6.28318);

              // Soma (nucleus) and synapse edges between cells
              float soma = 1.0 - smoothstep(0.08, 0.3, net.x);
              float edge = 1.0 - smoothstep(0.0, 0.07, net.y - net.x);
              float edgeSoft = 1.0 - smoothstep(0.0, 0.18, net.y - net.x);

              // Expanding activation wave radiating out of each neuron —
              // the signal firing down its synapses.
              float ringR = fract(time * (0.14 + h * 0.1) + h * 7.31) * 0.85;
              float ring = exp(-pow((net.x - ringR) * 14.0, 2.0));

              // Slow attention wave washing across the whole network
              float wave = 0.5 + 0.5 * sin(dot(op, vec3(0.9, 2.2, 0.55)) - time * 0.45);

              // Deep violet cortex with faint tissue texture
              vec3 base = uAccent * 0.10 + vec3(0.012, 0.006, 0.02) + fbm(op * 6.0) * 0.03;
              base = mix(base, uAccent * 0.5, edgeSoft * 0.35);
              base = mix(base, mix(uAccent, vec3(1.0), 0.45), soma * act);

              LightOut lo = shade(n, v, l, base, 48.0, 0.22, 0.0, uAmbient);

              // Emissive: firing nuclei, glowing synapses, travelling
              // signals, all breathing with the attention wave.
              vec3 em = vec3(0.0);
              em += mix(uAccent, vec3(1.0), 0.5) * soma * act * 1.2;
              em += uAccent * edge * (0.35 + 0.45 * wave);
              em += mix(uAccent, vec3(0.9, 0.8, 1.0), 0.4) * ring * edgeSoft * 1.6;
              em += uAccent * 0.1 * wave;

              // Halo — the network's ambient glow
              float fres = pow(1.0 - max(dot(n, v), 0.0), 3.2);
              em += uAccent * fres * 1.0;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "software-systems":
      // PCB planet, triplanar. Everything samples the object-space normal
      // (no vUv) so there is no wrap seam or pole pinch, and the pattern
      // rotates with the planet instead of swimming through world space.
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(-0.2, 0.5, 0.3).normalize() },
            uAmbient: { value: 0.28 },
            uSpecPower: { value: 120.0 },
            uSpecStrength: { value: 0.5 },
            uRim: { value: 0.4 },
            uCircuitScale: { value: 6.0 },
            uChipScale: { value: 2.2 },
            uDataSpeed: { value: 0.5 },
            uSubstrateCol: { value: new THREE.Color("#0a1a12") },
            uSiliconCol: { value: new THREE.Color("#1a3a2a") },
            uTraceCol: { value: new THREE.Color("#c9a060") },
            uDataCol: { value: new THREE.Color("#00ffcc") },
            uChipCol: { value: new THREE.Color("#2a2a2a") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vObj; varying vec3 vLocal;
            void main(){
              vObj = normal;
              vLocal = position;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uCircuitScale, uChipScale, uDataSpeed;
            uniform float uAmbient, uSpecPower, uSpecStrength, uRim;
            uniform vec3 uLightDir, uSubstrateCol, uSiliconCol, uTraceCol, uDataCol, uChipCol;
            varying vec3 vN, vView, vObj, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float hash21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            // One PCB layer in 2D: x=trace, y=chip+pins, z=pad, w=data packet
            vec4 pcbLayer(vec2 uv) {
              // Traces / pads / data share the fine grid
              vec2 tScaled = uv * uCircuitScale;
              vec2 tGrid  = floor(tScaled);
              vec2 tLocal = fract(tScaled);
              float pattern  = hash21(tGrid);
              float hasTrace = step(0.3, hash21(tGrid + 0.5));

              float hTrace = step(0.45, tLocal.y) * step(tLocal.y, 0.55);
              float vTrace = step(0.45, tLocal.x) * step(tLocal.x, 0.55);
              float trace  = mix(hTrace, vTrace, step(0.5, pattern)) * hasTrace;

              // Solder pads / vias
              float pad = smoothstep(0.12, 0.08, length(tLocal - 0.5)) * step(0.6, hash21(tGrid));

              // Data packets flowing along the traces
              float offset = hash21(tGrid + 1.5) * 6.28;
              float flow   = fract(time * uDataSpeed + offset);
              float hData  = step(abs(tLocal.y - flow), 0.08) * hTrace;
              float vData  = step(abs(tLocal.x - flow), 0.08) * vTrace;
              float data   = mix(hData, vData, step(0.5, pattern)) * hasTrace;

              // IC packages on the coarse grid, with pins on the sides
              vec2 cScaled = uv * uChipScale;
              vec2 cGrid  = floor(cScaled);
              vec2 cLocal = fract(cScaled) - 0.5;
              float hasChip = step(0.7, hash21(cGrid));
              vec2 chipSize = vec2(0.35, 0.28);
              vec2 d = abs(cLocal) - chipSize;
              float chip = step(max(d.x, d.y), 0.0);
              float pinSpacing = 0.08;
              float pinY = abs(mod(cLocal.y + pinSpacing * 0.5, pinSpacing) - pinSpacing * 0.5);
              float pins = step(pinY, 0.02) * step(chipSize.x, abs(cLocal.x)) * step(abs(cLocal.x), chipSize.x + 0.08);
              float chipAll = clamp(chip + pins, 0.0, 1.0) * hasChip;

              return vec4(trace, chipAll, pad, data);
            }

            // Triplanar blend — projection plane picked by the object-space
            // NORMAL, pattern sampled from the object-space POSITION. On the
            // cube body each face maps to exactly one clean PCB plane; on any
            // other shape it blends seam-free. Anchored: rotates with the body.
            vec4 pcbTriplanar(vec3 p, vec3 nrm) {
              vec3 w = pow(abs(nrm), vec3(8.0));
              w /= max(w.x + w.y + w.z, 1e-4);
              return pcbLayer(p.yz) * w.x + pcbLayer(p.xz) * w.y + pcbLayer(p.xy) * w.z;
            }

            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 op = vLocal;             // object-space position (flat faces vary)
              vec3 an = normalize(vObj);    // object-space normal (plane choice)

              vec4 pcb = pcbTriplanar(op, an);
              float traces = pcb.x, chips = pcb.y, pads = pcb.z, data = pcb.w;

              // Base PCB substrate (object-anchored micro noise)
              vec3 substrate = uSubstrateCol * (0.95 + 0.05 * fbm(op * 4.0));
              vec3 silicon    = mix(substrate, uSiliconCol, step(0.01, traces + pads));
              vec3 traceColor = uTraceCol * (0.9 + 0.1 * fbm(op * 16.0));
              vec3 withTraces = mix(silicon, traceColor, traces * 0.9);
              vec3 padColor   = mix(uTraceCol, vec3(0.8), 0.3);
              vec3 withPads   = mix(withTraces, padColor, pads);
              vec3 chipColor  = uChipCol * (0.95 + 0.05 * noise(op * 30.0));
              vec3 withChips  = mix(withPads, chipColor, chips);

              LightOut lo = shade(n, v, l, withChips, uSpecPower, uSpecStrength, uRim, uAmbient);

              // Emissive: data packets + soft chip shimmer. Boosted on the
              // shadow side so the board "lights up at night".
              float night = 1.0 + (1.0 - lo.ndl) * 0.9;
              vec3 dataGlow = uDataCol * data * 1.2;
              float chipActivity = chips * (0.5 + 0.5 * sin(time * 3.0 + dot(op, vec3(5.0, 7.0, 3.0))));
              vec3 chipGlow = uDataCol * 0.3 * chipActivity;

              gl_FragColor = vec4(lo.color + (dataGlow + chipGlow) * night, 1.0);
            }
          `
          }
        />
      )

    case "autonomy":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.3, 0.5, 0.8).normalize() },
            uAmbient: { value: 0.22 },
            uSpecPower: { value: 80.0 },
            uSpecStrength: { value: 0.4 },
            uGridScale: { value: 24.0 },
            uSweepSpeed: { value: 0.32 },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying vec3 vObj;
            void main(){
              vUv = uv;
              vObj = normal;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uGridScale, uSweepSpeed;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vView, vObj;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float h21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float latLonGrid(vec2 uv, float scale, float thickness) {
              vec2 g = abs(fract(uv * scale) - 0.5);
              float line = min(g.x, g.y);
              return smoothstep(thickness, 0.0, line);
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vObj);  // anchored — terrain rotates with the planet

              // Tactical relief — fbm "terrain" tint over a dark navy base
              float relief = fbm(sp * 3.2) * 0.4 + fbm(sp * 10.0) * 0.06;
              vec3 base = vec3(0.005, 0.025, 0.04) + vec3(0.0, 0.045, 0.07) * relief;

              // Lat/lon grid (minor + major)
              float gridMinor = latLonGrid(vUv, uGridScale, 0.012);
              float gridMajor = latLonGrid(vUv, uGridScale * 0.25, 0.018);
              base = mix(base, vec3(0.0, 0.32, 0.42), gridMinor * 0.18);
              base = mix(base, vec3(0.0, 0.55, 0.7),  gridMajor * 0.35);

              // Equator highlight
              float eq = smoothstep(0.012, 0.0, abs(vUv.y - 0.5));
              base += vec3(0.0, 0.18, 0.28) * eq;

              // Sweeping radar arm in longitude direction
              float sweepPhase = fract(vUv.x - time * uSweepSpeed);
              float sweep      = exp(-sweepPhase * 60.0) * 1.2;
              float sweepTail  = exp(-sweepPhase * 10.0) * 0.35;
              vec3  sweepColor = vec3(0.0, 0.85, 1.0) * (sweep + sweepTail);

              // Targets / blips — sparse random points that flash when sweep passes.
              // Wrap cellId.x mod 14 so the longitude seam is invisible.
              vec2 cellCoord  = vUv * 14.0;
              vec2 cellId     = floor(cellCoord);
              vec2 wrapId     = vec2(mod(cellId.x, 14.0), cellId.y);
              float cellRand  = h21(wrapId);
              float hasBlip   = step(0.88, cellRand);
              vec2  cellLocal = fract(cellCoord) - 0.5;
              vec2  blipOff   = (vec2(h21(wrapId + 1.3), h21(wrapId + 2.7)) - 0.5) * 0.6;
              float blipDist  = length(cellLocal - blipOff);
              float blipShape = smoothstep(0.06, 0.018, blipDist);

              // Activation: blip pulses when the sweep arm is near its longitude
              float blipLon   = (wrapId.x + 0.5 + blipOff.x) / 14.0;
              float lonDelta  = fract(blipLon - (1.0 - fract(time * uSweepSpeed)));
              float sweepHit  = exp(-pow(lonDelta * 18.0, 2.0));
              float bgPulse   = 0.4 + 0.6 * sin(time * (1.0 + cellRand * 1.5) + cellRand * 6.28318);
              float blip      = blipShape * hasBlip * (sweepHit + 0.18 * bgPulse);
              vec3  blipColor = mix(vec3(0.6, 1.0, 1.0), vec3(0.0, 0.9, 1.0), 0.4) * blip;

              // CRT-ish micro scanlines
              float scanline = 0.5 + 0.5 * sin(vUv.y * 380.0);
              base += vec3(0.0, 0.04, 0.06) * smoothstep(0.95, 1.0, scanline) * 0.25;

              // Lighting
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, 0.0, uAmbient);

              // Emissive layers
              vec3 em = vec3(0.0);
              em += vec3(0.0, 0.42, 0.55) * gridMajor * 0.55;
              em += vec3(0.0, 0.22, 0.32) * gridMinor * 0.30;
              em += sweepColor * 0.85;
              em += blipColor * 1.4;

              // Fresnel rim (atmospheric haze)
              float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
              em += vec3(0.0, 0.55, 0.75) * fres * 0.9;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "cat":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.3, 0.5, 0.85).normalize() },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView; varying vec3 vObj;
            void main() {
              vUv = uv;
              vObj = normal;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vPos = wp.xyz;
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView, vObj;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            // Anti-aliased line segment between a..b at point p, with thickness w.
            float lineSeg(vec2 p, vec2 a, vec2 b, float w) {
              vec2 pa = p - a, ba = b - a;
              float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
              float d = length(pa - ba * h);
              return 1.0 - smoothstep(w, w * 1.8, d);
            }

            void main() {
              vec3 n = normalize(vN);
              vec3 v = normalize(vView);
              vec3 sp = normalize(vObj);

              // Black-fur base with subtle blue undertone + fur noise
              float fur = fbm(sp * 14.0) * 0.05;
              vec3 base = vec3(0.035, 0.035, 0.055) + vec3(fur);

              // Cat face only on the camera-facing hemisphere. Using view-space
              // normal so the face follows the camera as the planet rotates.
              float frontMask = smoothstep(0.05, 0.5, n.z);

              if (frontMask > 0.0) {
                vec2 face = n.xy;

                // Eyes
                vec2 eyeL = vec2(-0.22, 0.10);
                vec2 eyeR = vec2( 0.22, 0.10);

                // Periodic blink — closed for ~0.16s every 3.6s
                float bt = mod(time, 3.6);
                float blink = max(0.0, smoothstep(3.30, 3.38, bt) - smoothstep(3.46, 3.54, bt));
                float openY = mix(1.0, 0.06, blink);

                float dL = length((face - eyeL) / vec2(0.10, 0.13 * openY));
                float dR = length((face - eyeR) / vec2(0.10, 0.13 * openY));
                float eyeWhite = (1.0 - smoothstep(0.85, 1.0, dL))
                               + (1.0 - smoothstep(0.85, 1.0, dR));
                eyeWhite = clamp(eyeWhite, 0.0, 1.0);

                // Bright green iris with a hint of glow
                vec3 eyeCol = vec3(0.35, 1.0, 0.45);
                base = mix(base, eyeCol, eyeWhite * frontMask);

                // Iris glow
                float eyeGlow = (exp(-dL * dL * 4.0) + exp(-dR * dR * 4.0)) * (1.0 - blink);
                base += vec3(0.05, 0.35, 0.12) * eyeGlow * frontMask;

                // Vertical slit pupil
                float pL = length((face - eyeL) / vec2(0.012, 0.10));
                float pR = length((face - eyeR) / vec2(0.012, 0.10));
                float pupil = ((1.0 - smoothstep(0.85, 1.0, pL))
                            + (1.0 - smoothstep(0.85, 1.0, pR)))
                            * (1.0 - blink);
                base = mix(base, vec3(0.0, 0.02, 0.0), pupil * frontMask);

                // Whiskers — 3 thin lines per cheek, slight downward angle
                float whisker = 0.0;
                vec2 cheekL = vec2(-0.13, -0.05);
                vec2 cheekR = vec2( 0.13, -0.05);
                for (int i = 0; i < 3; i++) {
                  float yOff = (float(i) - 1.0) * 0.05;
                  vec2 endL = cheekL + vec2(-0.30, yOff);
                  vec2 endR = cheekR + vec2( 0.30, yOff);
                  whisker += lineSeg(face, cheekL, endL, 0.0035);
                  whisker += lineSeg(face, cheekR, endR, 0.0035);
                }
                whisker = clamp(whisker, 0.0, 1.0);
                base = mix(base, vec3(0.85, 0.85, 0.92), whisker * 0.78 * frontMask);

                // Tiny pink nose
                vec2 nose = vec2(0.0, -0.04);
                float dNose = length((face - nose) / vec2(0.045, 0.030));
                float noseMask = (1.0 - smoothstep(0.85, 1.0, dNose));
                base = mix(base, vec3(0.95, 0.55, 0.6), noseMask * frontMask);
              }

              // Soft lighting — gentle, diffuse so she reads as fur
              LightOut lo = shade(n, v, normalize(uLightDir), base, 12.0, 0.15, 0.0, 0.55);

              // Subtle ear-tip rim glow on the upper edge so the silhouette
              // doesn't disappear into the background
              float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
              vec3 em = vec3(0.06, 0.10, 0.18) * fres;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "philosophy":
      // Ink diffusing in still water — domain-warped fbm marbling in the
      // planet's accent, with pale parchment veins and soft relief.
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.6, 0.8).normalize() },
            uAmbient: { value: 0.3 },
            uSpecPower: { value: 40.0 },
            uSpecStrength: { value: 0.25 },
            uBaseColor: { value: hexToVec3(accentColor || "#a070ff") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
            void main() {
              vLocal = position;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient, uSpecPower, uSpecStrength;
            uniform vec3 uLightDir, uBaseColor;
            varying vec3 vN, vView, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            ${BUMP_GLSL}

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              // Direction of the object-space POSITION — continuous across
              // the icosahedron's flat facets (its normals are not).
              vec3 sp = normalize(vLocal);

              // Two-stage domain warp — the slow drift is the ink diffusing
              vec3 q = vec3(
                fbm(sp * 2.0 + vec3(0.0, 0.0, time * 0.015)),
                fbm(sp * 2.0 + vec3(5.2, 1.3, 0.0)),
                fbm(sp * 2.0 + vec3(1.7, 9.2, 0.0)));
              vec3 r = vec3(
                fbm(sp * 2.0 + 2.6 * q + vec3(1.7, 9.2, time * 0.02)),
                fbm(sp * 2.0 + 2.6 * q + vec3(8.3, 2.8, 0.0)),
                fbm(sp * 2.0 + 2.6 * q + vec3(3.1, 6.9, 0.0)));
              float ink = fbm(sp * 2.4 + 3.2 * r);

              // Abyssal ink -> accent body -> pale parchment veins
              vec3 deep = uBaseColor * 0.10 + vec3(0.008, 0.006, 0.02);
              vec3 mid  = uBaseColor * 0.75;
              vec3 vein = mix(uBaseColor, vec3(0.96, 0.94, 0.90), 0.75);
              vec3 base = mix(deep, mid, smoothstep(0.25, 0.62, ink));
              float veins = smoothstep(0.58, 0.72, ink) * (1.0 - smoothstep(0.72, 0.86, ink));
              base = mix(base, vein, veins * 0.85);

              // Fine marble filaments riding the warp field
              float fil = abs(sin((ink + q.x) * 24.0));
              base += uBaseColor * 0.12 * (1.0 - smoothstep(0.0, 0.25, fil));

              // Relief from the ink field (warp frozen for the offset taps)
              vec3 t1o, t2o; objTangents(sp, t1o, t2o);
              float e = 0.02;
              float hx = fbm((sp + t1o * e) * 2.4 + 3.2 * r);
              float hy = fbm((sp + t2o * e) * 2.4 + 3.2 * r);
              vec3 nb = bumpNormal(n, ink, hx, hy, e, 0.35);

              LightOut lo = shade(nb, v, l, base, uSpecPower, uSpecStrength, 0.0, uAmbient);

              // Veins hold a faint glow; soft accent rim
              float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
              vec3 em = vein * veins * 0.15 + uBaseColor * fres * 0.55;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "media":
      // A UV-free signal organism built for the Media planet's torus-knot
      // topology. Every pattern is sampled in object-space 3D, so it crosses
      // the geometry without seams. The vertex stage also physically deforms
      // the knot: this is a living waveform, not a texture wrapped on a ball.
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.35, 0.55, 0.85).normalize() },
            uAmbient: { value: 0.3 },
            uBaseColor: { value: hexToVec3(accentColor || "#b6ff00") },
          }}
          vertexShader={
            /* glsl */ `
            uniform float time;
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;

            void main() {
              // Three inherited carriers share the same body but arrive with
              // different phase, direction, and frequency. Their interference
              // actually pushes the mesh outward along its normal.
              float ancestor = sin(dot(position, vec3(5.2, 7.1, 3.7)) + time * 0.72);
              float descendant = sin(dot(position, vec3(-8.3, 4.4, 6.6)) - time * 0.94 + 1.7);
              float ghost = sin(dot(position, vec3(11.0, -5.6, 8.8)) + time * 0.43 + 3.1);
              float beat = pow(0.5 + 0.5 * sin(length(position) * 18.0 - time * 1.8), 7.0);
              float displacement = ancestor * 0.042 + descendant * 0.024 + ghost * 0.012 + beat * 0.038;
              vec3 displaced = position + normal * displacement;

              vLocal = displaced;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(displaced, 1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient;
            uniform vec3 uLightDir, uBaseColor;
            varying vec3 vN, vView, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float carrier(vec3 p, vec3 axis, float frequency, float phase, float width) {
              float wave = abs(sin(dot(p, normalize(axis)) * frequency + phase));
              return 1.0 - smoothstep(width, width + 0.12, wave);
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 p = vLocal;

              // No UVs, latitude, or normal mapping: continuous 3D fields
              // make the traces genuinely seamless around every knot turn.
              float parentTrace = carrier(p, vec3(1.0, 0.42, -0.28), 13.0, time * 0.58, 0.055);
              float childTrace = carrier(p, vec3(-0.35, 1.0, 0.52), 17.0, -time * 0.76 + 1.4, 0.045);
              float echoTrace = carrier(p, vec3(0.48, -0.31, 1.0), 23.0, time * 0.41 + 2.8, 0.04);

              float memory = fbm(p * 2.8 + vec3(time * 0.025, -time * 0.014, time * 0.018));
              float archive = fbm(p * 6.2 - vec3(time * 0.012, 0.0, time * 0.01));
              vec3 deep = vec3(0.0015, 0.007, 0.009) + uBaseColor * memory * 0.045;
              vec3 cyan = vec3(0.0, 0.94, 1.0);
              vec3 magenta = vec3(1.0, 0.05, 0.72);
              vec3 base = deep;
              base += uBaseColor * parentTrace * (0.72 + memory * 0.45);
              base += cyan * childTrace * (0.58 + archive * 0.38);
              base += magenta * echoTrace * 0.52;

              // Shared source material becomes white-hot only where lineages
              // intersect. A spherical sonar pulse reveals buried layers.
              float overlap = parentTrace * childTrace + childTrace * echoTrace + echoTrace * parentTrace;
              float node = smoothstep(0.16, 0.72, overlap);
              float sonar = 1.0 - smoothstep(0.035, 0.14, abs(sin(length(p) * 20.0 - time * 1.65)));
              base += vec3(1.0, 0.96, 0.84) * node * 0.82;
              base += mix(cyan, uBaseColor, memory) * sonar * smoothstep(0.48, 0.88, archive) * 0.32;

              LightOut lo = shade(n, v, l, base, 84.0, 0.28, 0.0, uAmbient);
              float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);
              float phase = 0.5 + 0.5 * sin(dot(p, vec3(2.1, 3.4, -2.7)) + time * 1.25);
              vec3 rim = mix(cyan, magenta, phase) * fres * (0.62 + sonar * 0.7);

              gl_FragColor = vec4(lo.color + rim * 0.92 + node * uBaseColor * 0.34, 1.0);
            }
          `
          }
        />
      )

    case "film":
      // Silver-screen planet: slowly morphing monochrome imagery washed in
      // warm projector light, with grain, flicker, scratches, a drifting
      // anamorphic streak, and a reel-change cue dot.
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.5, 0.85).normalize() },
            uAmbient: { value: 0.5 },
            uBaseColor: { value: hexToVec3(accentColor || "#ffaa55") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
            void main() {
              vLocal = position;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient;
            uniform vec3 uLightDir, uBaseColor;
            varying vec3 vN, vView, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              // Raw object position for the fields (well-defined on the torus
              // body), direction only for longitude/latitude effects.
              vec3 op = vLocal;
              vec3 nd = normalize(vLocal);

              // Soft monochrome "imagery" slowly morphing across the surface
              float scene  = fbm(op * 1.6 + vec3(0.0, time * 0.012, 0.0));
              float scene2 = fbm(op * 3.2 - vec3(time * 0.008, 0.0, 0.0));
              float lumi = smoothstep(0.2, 0.85, scene * 0.7 + scene2 * 0.3);
              vec3 silver = mix(vec3(0.04, 0.04, 0.05), vec3(0.92, 0.90, 0.86), lumi);
              vec3 base = silver * mix(vec3(1.0), uBaseColor * 1.35, 0.35);

              // Projector flicker — small global luminance wobble
              float flick = 0.92 + 0.08 * noise(vec3(time * 12.0, 3.7, 9.1));
              base *= flick;

              // Film grain, re-rolled at 24 fps
              float grain = hash(op * 550.0 + floor(time * 24.0));
              base += (grain - 0.5) * 0.09;

              // Occasional vertical scratch at a random longitude
              float lon = atan(nd.z, nd.x) * 0.15915494 + 0.5;
              float scratchSeed = floor(time * 0.8);
              float scratchLon  = hash(vec3(scratchSeed, 1.7, 4.2));
              float scratchOn   = step(0.55, hash(vec3(scratchSeed, 9.1, 2.3)));
              float dLon = abs(fract(lon - scratchLon + 0.5) - 0.5);
              base += vec3(0.9) * smoothstep(0.0035, 0.0, dLon) * scratchOn * 0.5;

              // Reel-change cue dot — blinks in one spot every ~9s
              float cue = step(0.955, fract(time / 9.0));
              float cueDot = smoothstep(0.994, 0.9965, dot(nd, normalize(vec3(0.55, 0.6, 0.58)))) * cue;
              base = mix(base, vec3(0.35, 0.2, 0.1), cueDot * 0.9);

              LightOut lo = shade(n, v, l, base, 30.0, 0.12, 0.0, uAmbient);

              // Drifting anamorphic lens streak + warm projector halo
              float streakY = sin(time * 0.1) * 0.35;
              float streak = exp(-pow((nd.y - streakY) * 9.0, 2.0))
                           * exp(-pow((fract(lon - time * 0.02) - 0.5) * 4.0, 2.0));
              float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
              vec3 em = vec3(0.35, 0.55, 1.0) * streak * 0.35 + uBaseColor * fres * 0.6;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "nature":
      // A living planet: fbm continents over depth-shaded oceans, ice caps,
      // drifting cloud layer, terrain relief, and specular glint on water.
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.5, 0.8).normalize() },
            uAmbient: { value: 0.3 },
            uBaseColor: { value: hexToVec3(accentColor || "#80e060") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
            void main() {
              vLocal = position;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient;
            uniform vec3 uLightDir, uBaseColor;
            varying vec3 vN, vView, vLocal;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            ${BUMP_GLSL}

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vLocal);

              float elev = fbm(sp * 2.3) * 0.75 + fbm(sp * 5.5) * 0.25;
              float seaLevel = 0.48;
              float landMask = smoothstep(seaLevel, seaLevel + 0.015, elev);

              // Ocean with depth falloff
              float depth = smoothstep(seaLevel, 0.15, elev);
              vec3 ocean = mix(vec3(0.05, 0.32, 0.42), vec3(0.008, 0.09, 0.18), depth);

              // Land: beach -> lush accent lowland -> highland -> snow peak
              float landH = clamp((elev - seaLevel) / (1.0 - seaLevel), 0.0, 1.0);
              vec3 land = mix(vec3(0.75, 0.68, 0.5), uBaseColor * 0.55, smoothstep(0.0, 0.12, landH));
              land = mix(land, vec3(0.42, 0.34, 0.24), smoothstep(0.3, 0.55, landH));
              land = mix(land, vec3(0.92, 0.94, 0.96), smoothstep(0.6, 0.75, landH));
              land *= 0.92 + 0.16 * fbm(sp * 14.0);

              // Polar ice caps with a noisy edge
              float cap = smoothstep(0.78, 0.86, abs(sp.y) + fbm(sp * 6.0) * 0.06);
              vec3 surfCol = mix(ocean, land, landMask);
              surfCol = mix(surfCol, vec3(0.93, 0.96, 1.0), cap);

              // Cloud layer drifting independently of the surface
              float ca = cos(time * 0.01), sa2 = sin(time * 0.01);
              vec3 cp = vec3(sp.x * ca - sp.z * sa2, sp.y, sp.x * sa2 + sp.z * ca);
              float cloud = smoothstep(0.52, 0.72, fbm(cp * 3.4 + vec3(0.0, time * 0.004, 0.0)));
              surfCol = mix(surfCol, vec3(0.98), cloud * 0.85);

              // Terrain relief on land, flattened under cloud
              vec3 t1o, t2o; objTangents(sp, t1o, t2o);
              float e = 0.03;
              float hx = fbm((sp + t1o * e) * 2.3) * 0.75 + fbm((sp + t1o * e) * 5.5) * 0.25;
              float hy = fbm((sp + t2o * e) * 2.3) * 0.75 + fbm((sp + t2o * e) * 5.5) * 0.25;
              vec3 nb = bumpNormal(n, elev, hx, hy, e, 0.55 * landMask * (1.0 - cloud * 0.8));

              // Specular glint on open water only
              float specStr = mix(0.55, 0.04, max(landMask, cloud));
              LightOut lo = shade(nb, v, l, surfCol, 90.0, specStr, 0.0, uAmbient);

              // Atmosphere — soft blue limb
              float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
              vec3 em = vec3(0.25, 0.5, 0.9) * fres * 0.5;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "personal":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.6, 0.8).normalize() },
            uAmbient: { value: 0.32 },
            uSpecPower: { value: 28.0 },
            uSpecStrength: { value: 0.18 },
            uBaseColor: { value: hexToVec3(accentColor || "#a070ff") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView; varying vec3 vObj;
            void main() {
              vUv = uv;
              vObj = normal;
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position,1.0);
              vPos = wp.xyz;
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient, uSpecPower, uSpecStrength;
            uniform vec3  uLightDir, uBaseColor;
            varying vec2 vUv; varying vec3 vN, vPos, vView, vObj;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vObj);  // anchored to planet body

              // Two slow-flowing noise fields drive aurora-like bands of color
              vec3 p1 = sp * 2.4 + vec3(time * 0.05, time * 0.02, 0.0);
              vec3 p2 = sp * 4.6 + vec3(0.0, time * 0.03, time * 0.04);
              float band1 = fbm(p1);
              float band2 = fbm(p2);
              float swirl = 0.5 + 0.5 * sin((band1 - band2) * 7.5 + time * 0.35);

              // Palette: dark / mid / bright variations of uBaseColor
              vec3 dark   = uBaseColor * 0.28;
              vec3 mid    = uBaseColor * 0.85;
              vec3 bright = mix(uBaseColor, vec3(1.0), 0.55);

              vec3 base = mix(dark, mid, smoothstep(0.15, 0.75, band1));
              base = mix(base, bright, smoothstep(0.45, 0.9, swirl) * 0.7);

              // Soft cell-like texture overlay (anchored)
              float micro = fbm(sp * 11.0);
              base += uBaseColor * micro * 0.05;

              // Lighting (low spec, high ambient — soft look)
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, 0.0, uAmbient);

              // Gentle rim glow + subtle twinkle specks (also anchored)
              float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
              vec3 em = uBaseColor * fres * 0.8;
              float specks = pow(noise(sp * 90.0), 8.0);
              em += vec3(1.0) * specks * 0.35;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )

    case "pill":
      // Traditional two-tone pill capsule. Red top, yellow bottom — reads
      // as a classic medication caplet. Sharp seam at object-space y = 0
      // with a tiny dark band so the two halves read as separate caps.
      // Glossy Phong finish. Colors hardcoded so the pill always looks
      // like a pill regardless of the planet's accent color.
      return (
        <shaderMaterial
          uniforms={{
            uLightDir: { value: new THREE.Vector3(0.4, 0.6, 0.8).normalize() },
            uAmbient: { value: 0.42 },
            uSpecPower: { value: 64.0 },
            uSpecStrength: { value: 0.5 },
            uRim: { value: 0.18 },
            uColorTop: { value: hexToVec3("#dc2626") },     // red
            uColorBottom: { value: hexToVec3("#fbbf24") },  // yellow
          }}
          vertexShader={
            /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
            void main() {
              vLocal = position;             // object-space position drives the split
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vec4 mv = viewMatrix * wp;
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `
          }
          fragmentShader={
            /* glsl */ `
            uniform float uAmbient, uSpecPower, uSpecStrength, uRim;
            uniform vec3  uLightDir, uColorTop, uColorBottom;
            varying vec3 vN, vView, vLocal;
            ${LIGHTING_GLSL}
            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              // Crisp split at y = 0. Tiny smoothstep keeps the seam from
              // aliasing without making it look fuzzy.
              float t = smoothstep(-0.025, 0.025, vLocal.y);
              vec3 base = mix(uColorBottom, uColorTop, t);
              // Faint dark band at the seam — printed-line look.
              float seam = exp(-pow(vLocal.y / 0.05, 2.0));
              base *= 1.0 - seam * 0.20;
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, uRim, uAmbient);
              gl_FragColor = vec4(lo.color, 1.0);
            }
          `
          }
        />
      )

    default:
      return <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
  }
}
