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
            vec3 hsv2rgb(vec3 c){
              vec3 p = abs(fract(c.xxx + vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);
              return c.z * mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y);
            }
            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vObj);
              float ndv = max(dot(n, v), 0.0);
              float film = pow(1.0 - ndv, 1.5);
              float hue = fract(film * 1.5 + 0.05 * sin(time*0.5));
              vec3 iri = hsv2rgb(vec3(hue, 0.9, 1.0));
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

    case "ai-controls":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(0.4, 0.5, 0.8).normalize() },
            uAmbient: { value: 0.18 },
            uSpecPower: { value: 96.0 },
            uSpecStrength: { value: 0.55 },
            uHexScaleLarge: { value: 4.0 },
            uHexScaleSmall: { value: 12.0 },
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
            uniform float uHexScaleLarge, uHexScaleSmall;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView, vObj;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float h21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float hexDist(vec2 p) {
              p = abs(p);
              return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
            }

            // Returns x=edge, y=center dot, z=active fill, w=cellHash
            vec4 hexLayer(vec2 uv, float scale, float edgeThick) {
              uv *= scale;
              vec2 r = vec2(1.0, 1.7320508);
              vec2 h = r * 0.5;
              vec2 a = mod(uv, r) - h;
              vec2 b = mod(uv - h, r) - h;
              vec2 gv = dot(a, a) < dot(b, b) ? a : b;
              vec2 id = uv - gv;

              float hd = hexDist(gv);
              float edge = smoothstep(0.5, 0.5 - edgeThick, hd);
              float center = smoothstep(0.08, 0.03, length(gv));

              float ch = h21(id);
              float isActive = step(0.55, ch);
              float phase = h21(id + 0.73) * 6.28318;
              float speed = 0.2 + h21(id + 1.1) * 0.35;
              float activity = isActive * (0.5 + 0.5 * sin(time * speed + phase));
              float fill = clamp(1.0 - hd * 2.0, 0.0, 1.0) * activity;

              return vec4(edge, center, fill, ch);
            }

            // Triplanar wrapper — projects onto 3 planes and blends by which axis the normal favours.
            // No UV seam, hex pattern is anchored to the planet body.
            vec4 hexTriplanar(vec3 p, float scale, float edgeThick) {
              vec3 absN = abs(p);
              vec3 w = pow(absN, vec3(8.0));
              w /= max(w.x + w.y + w.z, 1e-4);
              vec4 hX = hexLayer(p.yz, scale, edgeThick);
              vec4 hY = hexLayer(p.xz, scale, edgeThick);
              vec4 hZ = hexLayer(p.xy, scale, edgeThick);
              return hX * w.x + hY * w.y + hZ * w.z;
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 sp = normalize(vObj);  // anchored to planet body, no seam

              // Dark navy base with micro surface texture (also seam-free)
              float surf = fbm(sp * 8.0) * 0.035;
              vec3 col = vec3(0.039, 0.078, 0.157) + surf;

              // Two-scale hex lattice via triplanar projection
              vec4 hL = hexTriplanar(sp, uHexScaleLarge, 0.04);
              vec4 hS = hexTriplanar(sp, uHexScaleSmall, 0.025);

              // Pulsing active cell fills
              col += vec3(0.01, 0.045, 0.12) * hL.z * 0.6;
              col += vec3(0.005, 0.02, 0.06) * hS.z * 0.3;

              // Hex grid lines
              float edges = max(hL.x * 0.75, hS.x * 0.4);
              col = mix(col, vec3(0.12, 0.38, 0.62), edges);

              // Bright center nodes
              float nodes = max(hL.y * 0.95, hS.y * 0.55);
              col = mix(col, vec3(0.3, 0.72, 1.0), nodes);

              // Scan ring sweeping around the planet's Y axis (anchored, seam-free)
              float lon = atan(sp.z, sp.x);
              float scanPhase = fract(lon * 0.15915494 - time * 0.06);
              float scan = exp(-scanPhase * scanPhase * 4000.0) * 0.3;
              col += vec3(0.0, 0.5, 1.0) * scan;

              // Fine latitude micro-lines (lat = sp.y, [-1, 1])
              float latGrid = 0.5 + 0.5 * sin(sp.y * 80.0);
              col += vec3(0.04, 0.16, 0.4) * smoothstep(0.97, 1.0, latGrid) * 0.1;

              // Lighting
              LightOut lo = shade(n, v, l, col, uSpecPower, uSpecStrength, 0.0, uAmbient);

              // Emissive glow layers
              vec3 em = vec3(0.0);
              em += vec3(0.1, 0.42, 0.82) * edges * 0.45;
              em += vec3(0.32, 0.72, 1.0) * nodes * 1.3;
              em += vec3(0.01, 0.1, 0.32) * (hL.z + hS.z * 0.5) * 0.35;
              em += vec3(0.0, 0.55, 1.0) * scan * 0.6;

              // Fresnel rim — electric blue
              float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
              em += vec3(0.05, 0.22, 1.0) * fres * 1.0;

              gl_FragColor = vec4(lo.color + em, 1.0);
            }
          `
          }
        />
      )
    case "software-systems":
      return (
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            uLightDir: { value: new THREE.Vector3(-0.2, 0.5, 0.3).normalize() },
            uAmbient: { value: 0.28 },
            uSpecPower: { value: 120.0 },
            uSpecStrength: { value: 0.5 },
            uRim: { value: 0.4 },
            uCircuitScale: { value: 12.0 },
            uChipScale: { value: 4.0 },
            uDataSpeed: { value: 2.0 },
            uSubstrateCol: { value: new THREE.Color("#0a1a12") },
            uSiliconCol: { value: new THREE.Color("#1a3a2a") },
            uTraceCol: { value: new THREE.Color("#c9a060") },
            uDataCol: { value: new THREE.Color("#00ffcc") },
            uChipCol: { value: new THREE.Color("#2a2a2a") },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView;
            void main(){
              vUv = uv;
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
            uniform float time, uCircuitScale, uChipScale, uDataSpeed;
            uniform float uAmbient, uSpecPower, uSpecStrength, uRim;
            uniform vec3 uLightDir, uSubstrateCol, uSiliconCol, uTraceCol, uDataCol, uChipCol;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float hash21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            // Create circuit traces (horizontal and vertical lines)
            float circuitTraces(vec2 uv, float scale) {
              vec2 scaled = uv * scale;
              vec2 grid = floor(scaled);
              vec2 local = fract(scaled);
              
              // Random pattern for trace direction
              float pattern = hash21(grid);
              
              // Horizontal or vertical traces
              float hTrace = step(0.45, local.y) * step(local.y, 0.55);
              float vTrace = step(0.45, local.x) * step(local.x, 0.55);
              
              // Mix based on pattern
              float trace = mix(hTrace, vTrace, step(0.5, pattern));
              
              // Add some gaps
              float hasTrace = step(0.3, hash21(grid + 0.5));
              
              return trace * hasTrace;
            }

            // Create chip/IC packages
            float chipPackages(vec2 uv, float scale) {
              vec2 scaled = uv * scale;
              vec2 grid = floor(scaled);
              vec2 local = fract(scaled) - 0.5;
              
              // Only place chips at certain grid positions
              float hasChip = step(0.7, hash21(grid));
              
              // Rectangular chip shape
              vec2 chipSize = vec2(0.35, 0.28);
              vec2 d = abs(local) - chipSize;
              float chip = step(max(d.x, d.y), 0.0);
              
              // Add pins on sides
              float pinSpacing = 0.08;
              float pinWidth = 0.02;
              float pinY = abs(mod(local.y + pinSpacing * 0.5, pinSpacing) - pinSpacing * 0.5);
              float pins = step(pinY, pinWidth) * step(chipSize.x, abs(local.x)) * step(abs(local.x), chipSize.x + 0.08);
              
              return (chip + pins) * hasChip;
            }

            // Create solder pads/vias
            float solderPads(vec2 uv, float scale) {
              vec2 scaled = uv * scale;
              vec2 local = fract(scaled) - 0.5;
              
              float dist = length(local);
              float pad = smoothstep(0.12, 0.08, dist);
              
              // Only some positions have pads
              float hasPad = step(0.6, hash21(floor(scaled)));
              
              return pad * hasPad;
            }

            // Animated data packets flowing through traces
            float dataFlow(vec2 uv, float scale, float speed) {
              vec2 scaled = uv * scale;
              vec2 grid = floor(scaled);
              vec2 local = fract(scaled);
              
              float pattern = hash21(grid);
              float offset = hash21(grid + 1.5) * 6.28;
              
              // Data moving along traces
              float flow = fract(time * speed + offset);
              
              float hData = step(abs(local.y - flow), 0.08) * step(0.45, local.y) * step(local.y, 0.55);
              float vData = step(abs(local.x - flow), 0.08) * step(0.45, local.x) * step(local.x, 0.55);
              
              float data = mix(hData, vData, step(0.5, pattern));
              float hasTrace = step(0.3, hash21(grid + 0.5));
              
              return data * hasTrace;
            }

            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              
              // Layer the circuit elements
              float traces = circuitTraces(vUv, uCircuitScale);
              float chips = chipPackages(vUv, uChipScale);
              float pads = solderPads(vUv, uCircuitScale);
              float data = dataFlow(vUv, uCircuitScale, uDataSpeed);
              
              // Base PCB substrate with texture
              vec3 substrate = uSubstrateCol * (0.95 + 0.05 * fbm(vPos * 2.0));
              
              // Silicon substrate visible around traces
              vec3 silicon = mix(substrate, uSiliconCol, step(0.01, traces + pads));
              
              // Copper/gold traces
              vec3 traceColor = uTraceCol * (0.9 + 0.1 * fbm(vPos * 8.0));
              vec3 withTraces = mix(silicon, traceColor, traces * 0.9);
              
              // Solder pads (shinier)
              vec3 padColor = mix(uTraceCol, vec3(0.8), 0.3);
              vec3 withPads = mix(withTraces, padColor, pads);
              
              // Chip packages (dark plastic)
              vec3 chipColor = uChipCol * (0.95 + 0.05 * noise(vPos * 15.0));
              vec3 withChips = mix(withPads, chipColor, chips);
              
              // Apply lighting
              LightOut lo = shade(n, v, l, withChips, uSpecPower, uSpecStrength, uRim, uAmbient);
              
              // Add glowing data flowing through traces
              vec3 dataGlow = uDataCol * data * 1.2;
              
              // Subtle chip activity glow
              float chipActivity = chips * (0.5 + 0.5 * sin(time * 3.0 + hash21(floor(vUv * uChipScale)) * 6.28));
              vec3 chipGlow = mix(vec3(0.0), uDataCol * 0.3, chipActivity);
              
              vec3 final = lo.color + dataGlow + chipGlow;
              
              gl_FragColor = vec4(final, 1.0);
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
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView;
            void main(){
              vUv = uv;
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
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uGridScale, uSweepSpeed;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
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

              // Tactical relief — fbm "terrain" tint over a dark navy base
              float relief = fbm(vPos * 1.6) * 0.4 + fbm(vPos * 5.0) * 0.06;
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

    default:
      return <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
  }
}
