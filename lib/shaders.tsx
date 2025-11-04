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

const BASE_VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vPos;
  varying vec3 vView;
  varying mat4 vModelMatrix;
  
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPos = worldPosition.xyz;
    vModelMatrix = modelMatrix;
    vec4 modelViewPosition = viewMatrix * worldPosition;
    vView = normalize(-modelViewPosition.xyz);
    gl_Position = projectionMatrix * modelViewPosition;
  }
`

// Update each case to use the new vertex shader and modified fragment shaders
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
          vertexShader={BASE_VERTEX_SHADER}
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
            uLightDir: { value: new THREE.Vector3(-0.3, 0.4, 0.7).normalize() },
            uAmbient: { value: 0.2 },
            uSpecPower: { value: 32.0 },
            uSpecStrength: { value: 0.2 },
            uRim: { value: 0.35 },
            uGlow: { value: 1.3 },
            uColA: { value: new THREE.Color("#003300") },
            uColB: { value: new THREE.Color("#00ff66") },
          }}
          vertexShader={BASE_VERTEX_SHADER}
          fragmentShader={
            /* glsl */ `
            uniform float time, uAmbient, uSpecPower, uSpecStrength, uRim, uGlow;
            uniform vec3 uLightDir, uColA, uColB;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453123); }
            float columnMask(vec2 uv){
              uv *= vec2(42.0, 28.0);
              vec2 id = floor(uv);
              vec2 f = fract(uv);
              float colSel = step(0.5, rnd(id*0.73));
              float head = fract(time*0.6 + rnd(id)*10.0);
              float tapered = smoothstep(0.0, 0.12, abs(f.y-head));
              float glyph = (1.0 - tapered) * colSel;
              float gaps = step(0.15, rnd(id+3.7));
              return glyph * gaps;
            }
            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 base = mix(uColA, uColB, 0.25);
              float rain = columnMask(vUv);
              float scan = 0.5 + 0.5*sin(vUv.y*3.14159*480.0);
              float glow = rain * (0.8 + 0.2*scan);
              float smear = fbm(vec3(vUv.x*30.0, vUv.y*200.0 - time*5.0, 0.0));
              glow *= 0.7 + 0.3*smear;
              vec3 emissive = mix(vec3(0.0), uColB, glow) * uGlow;
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, uRim, uAmbient);
              gl_FragColor = vec4(lo.color + emissive, 1.0);
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
            uLightDir: { value: new THREE.Vector3(0.2, 0.6, 0.5).normalize() },
            uAmbient: { value: 0.3 },
            uSpecPower: { value: 48.0 },
            uSpecStrength: { value: 0.4 },
            uRim: { value: 0.5 },
            uNodeDensity: { value: 8.0 },
            uPulseSpeed: { value: 1.5 },
            uPrimaryCol: { value: new THREE.Color("#00d9ff") },
            uSecondaryCol: { value: new THREE.Color("#ff006e") },
            uBgCol: { value: new THREE.Color("#0a0a1f") },
          }}
          vertexShader={BASE_VERTEX_SHADER}
          fragmentShader={
            /* glsl */ `
            varying vec2 vUv;
            varying vec3 vN;
            varying vec3 vPos;
            varying vec3 vView;
            varying mat4 vModelMatrix;
            
            uniform float time, uNodeDensity, uPulseSpeed;
            uniform float uAmbient, uSpecPower, uSpecStrength, uRim;
            uniform vec3 uLightDir, uPrimaryCol, uSecondaryCol, uBgCol;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            float hash21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            vec2 hash22(vec2 p) {
              p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
              return fract(sin(p) * 43758.5453);
            }

            float neuralNetwork(vec2 uv) {
              float result = 0.0;
              vec2 grid = floor(uv * uNodeDensity);
              vec2 localUv = fract(uv * uNodeDensity);
              
              // Check current and neighboring cells
              for(float y = -1.0; y <= 1.0; y++) {
                for(float x = -1.0; x <= 1.0; x++) {
                  vec2 neighbor = grid + vec2(x, y);
                  vec2 nodeOffset = hash22(neighbor);
                  
                  // Animate node position slightly
                  nodeOffset += 0.1 * sin(time * 0.5 + nodeOffset * 6.28);
                  
                  vec2 nodePos = vec2(x, y) + nodeOffset;
                  vec2 toNode = nodePos - localUv;
                  float distToNode = length(toNode);
                  
                  // Create pulsing nodes
                  float pulse = 0.5 + 0.5 * sin(time * uPulseSpeed + hash21(neighbor) * 6.28);
                  float node = smoothstep(0.15, 0.05, distToNode) * pulse;
                  result += node * 2.0;
                  
                  // Create connections between nearby nodes
                  for(float ny = -1.0; ny <= 1.0; ny++) {
                    for(float nx = -1.0; nx <= 1.0; nx++) {
                      if(nx == 0.0 && ny == 0.0) continue;
                      
                      vec2 otherNeighbor = neighbor + vec2(nx, ny);
                      vec2 otherOffset = hash22(otherNeighbor);
                      otherOffset += 0.1 * sin(time * 0.5 + otherOffset * 6.28);
                      vec2 otherPos = vec2(x + nx, y + ny) + otherOffset;
                      
                      // Draw line between nodes
                      vec2 toOther = otherPos - nodePos;
                      float lineLen = length(toOther);
                      
                      if(lineLen < 1.8) { // Only connect nearby nodes
                        vec2 lineDir = normalize(toOther);
                        vec2 toPoint = localUv - nodePos;
                        float alongLine = dot(toPoint, lineDir);
                        
                        if(alongLine > 0.0 && alongLine < lineLen) {
                          vec2 closestPoint = nodePos + lineDir * alongLine;
                          float distToLine = length(localUv - closestPoint);
                          
                          // Animate signal traveling along connection
                          float signal = fract(alongLine / lineLen - time * 0.8 + hash21(neighbor + otherNeighbor));
                          signal = smoothstep(0.9, 1.0, signal);
                          
                          float connection = smoothstep(0.04, 0.0, distToLine) * 0.3;
                          result += connection + signal * 0.8;
                        }
                      }
                    }
                  }
                }
              }
              
              return clamp(result, 0.0, 1.0);
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              
              // Generate neural network pattern
              float network = neuralNetwork(vUv);
              
              // Add subtle noise texture
              float noiseLayer = fbm(vPos * 4.0) * 0.15;
              
              // Mix colors based on activity
              vec3 baseColor = mix(uBgCol, uPrimaryCol, network * 0.7);
              baseColor = mix(baseColor, uSecondaryCol, network * network * 0.4);
              baseColor += noiseLayer;
              
              // Apply lighting
              LightOut lo = shade(n, v, l, baseColor, uSpecPower, uSpecStrength, uRim, uAmbient);
              
              // Add glow for active areas
              vec3 glow = mix(uPrimaryCol, uSecondaryCol, network) * network * 0.6;
              
              gl_FragColor = vec4(lo.color + glow, 1.0);
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
          vertexShader={BASE_VERTEX_SHADER}
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
