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

export function getPlanetMaterial(type: string) {
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
            uBandFreq: { value: 4.0 },
            uFlakeScale: { value: 35.0 },
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
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uRim, uHueShift, uBandFreq, uFlakeScale;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            vec3 hsv2rgb(vec3 c){
              vec3 p = abs(fract(c.xxx + vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);
              return c.z * mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y);
            }
            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              float ndv = max(dot(n, v), 0.0);
              float film = pow(1.0 - ndv, 1.5);
              float hue = fract(film * 1.5 + 0.05 * sin(time*0.5));
              vec3 iri = hsv2rgb(vec3(hue, 0.9, 1.0));
              float bands = 0.5 + 0.5*sin(vUv.y*3.14159*uBandFreq + time*0.8);
              vec3 bandCol = mix(vec3(0.8,0.1,0.5), vec3(0.0,1.0,0.6), bands);
              float flake = fbm(vPos * uFlakeScale);
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
            uVorScale: { value: 5.5 },
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
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uVorScale;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float h21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            vec2 h22(vec2 p) {
              p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
              return fract(sin(p) * 43758.5453);
            }

            vec3 voronoi(vec2 uv) {
              vec2 id = floor(uv);
              vec2 f  = fract(uv);
              float d1 = 9999.0, d2 = 9999.0;
              vec2 cid = id;
              for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                  vec2 g   = vec2(float(x), float(y));
                  vec2 rnd = h22(id + g);
                  vec2 pt  = g + 0.5 + 0.42 * sin(time * 0.18 + 6.28318 * rnd);
                  float d  = length(f - pt);
                  if (d < d1) { d2 = d1; d1 = d; cid = id + g; }
                  else if (d < d2) { d2 = d; }
                }
              }
              return vec3(d1, d2, h21(cid));
            }

            float isoline(float val, float freq, float w) {
              float s = fract(val * freq);
              return smoothstep(0.0, w, s) * (1.0 - smoothstep(w, w * 2.0, s));
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);

              // Voronoi cells
              vec3 vor = voronoi(vUv * uVorScale);
              float edge     = 1.0 - smoothstep(0.0, 0.055, vor.y - vor.x);
              float edgeGlow = 1.0 - smoothstep(0.0, 0.15,  vor.y - vor.x);
              float ch        = vor.z;
              float cellPulse = step(0.45, ch) * (0.4 + 0.6 * sin(time * (0.2 + ch * 0.4) + ch * 6.28318));
              float cellFill  = clamp((0.5 - vor.x) * 2.0, 0.0, 1.0) * cellPulse;

              // FBM contour lines
              float n1 = fbm(vec3(vUv * 3.0, time * 0.05));
              float n2 = fbm(vec3(vUv * 2.0 + 0.4, time * 0.03));
              float lines1   = isoline(n1, 10.0, 0.05);
              float lines2   = isoline(n2,  7.0, 0.06);
              float allLines = max(lines1 * 0.9, lines2 * 0.55);

              // Base color
              float surf = fbm(vPos * 2.5) * 0.03;
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
            uHexScaleLarge: { value: 7.0 },
            uHexScaleSmall: { value: 21.0 },
          }}
          vertexShader={
            /* glsl */ `
            varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vView;
            void main() {
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
            uniform float time, uAmbient, uSpecPower, uSpecStrength;
            uniform float uHexScaleLarge, uHexScaleSmall;
            uniform vec3 uLightDir;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
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

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);

              // Dark navy base with micro surface texture
              float surf = fbm(vPos * 3.0) * 0.035;
              vec3 col = vec3(0.039, 0.078, 0.157) + surf;

              // Two-scale hex lattice
              vec4 hL = hexLayer(vUv, uHexScaleLarge, 0.04);
              vec4 hS = hexLayer(vUv, uHexScaleSmall, 0.025);

              // Pulsing active cell fills
              col += vec3(0.01, 0.045, 0.12) * hL.z * 0.6;
              col += vec3(0.005, 0.02, 0.06) * hS.z * 0.3;

              // Hex grid lines
              float edges = max(hL.x * 0.75, hS.x * 0.4);
              col = mix(col, vec3(0.12, 0.38, 0.62), edges);

              // Bright center nodes
              float nodes = max(hL.y * 0.95, hS.y * 0.55);
              col = mix(col, vec3(0.3, 0.72, 1.0), nodes);

              // Scan ring sweeping along longitude
              float scanPhase = fract(vUv.x - time * 0.06);
              float scan = exp(-scanPhase * scanPhase * 4000.0) * 0.3;
              col += vec3(0.0, 0.5, 1.0) * scan;

              // Fine latitude micro-lines
              float latGrid = 0.5 + 0.5 * sin(vUv.y * 251.0);
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

    default:
      return <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
  }
}
