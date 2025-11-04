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
            uLightDir: { value: new THREE.Vector3(-0.3, 0.4, 0.7).normalize() },
            uAmbient: { value: 0.2 },
            uSpecPower: { value: 32.0 },
            uSpecStrength: { value: 0.2 },
            uRim: { value: 0.35 },
            uGlow: { value: 1.3 },
            uColA: { value: new THREE.Color("#003300") },
            uColB: { value: new THREE.Color("#00ff66") },
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
            uAmbient: { value: 0.25 },
            uSpecPower: { value: 48.0 },
            uSpecStrength: { value: 0.3 },
            uRim: { value: 0.45 },
            uPulseSpeed: { value: 2.0 },
            uNeuronColor: { value: new THREE.Color("#00ffbb") },
            uSynapseColor: { value: new THREE.Color("#4411ff") },
            uEnergyColor: { value: new THREE.Color("#ff00ff") },
            uBgColor: { value: new THREE.Color("#000620") },
            uNeuronDensity: { value: 15.0 },
            uSynapseRange: { value: 0.3 },
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
            uniform float time, uPulseSpeed, uNeuronDensity, uSynapseRange;
            uniform float uAmbient, uSpecPower, uSpecStrength, uRim;
            uniform vec3 uLightDir, uNeuronColor, uSynapseColor, uEnergyColor, uBgColor;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}

            vec2 neuronPos(vec2 id) {
              return id + 0.5 + vec2(
                0.4 * hash(vec3(id, time * 0.1)),
                0.4 * hash(vec3(id + 1.3, time * 0.1))
              );
            }

            float neuralField(vec2 p) {
              float field = 0.0;
              vec2 grid = floor(p * uNeuronDensity);
              vec2 gPos = fract(p * uNeuronDensity) - 0.5;
              
              for(float y = -1.0; y <= 1.0; y++) {
                for(float x = -1.0; x <= 1.0; x++) {
                  vec2 offset = vec2(x, y);
                  vec2 id = grid + offset;
                  vec2 neuron = neuronPos(id);
                  vec2 rel = offset + neuron - gPos;
                  
                  // Neuron core
                  float neuronCore = exp(-length(rel) * 8.0);
                  
                  // Synaptic connections
                  float angle = hash(vec3(id, 2.3)) * 6.28;
                  vec2 dir = vec2(cos(angle), sin(angle));
                  float synapse = smoothstep(0.5, 0.0, abs(dot(normalize(rel), dir)));
                  synapse *= exp(-length(rel) * 2.0) * step(length(rel), uSynapseRange);
                  
                  // Energy pulse
                  float pulse = sin(time * uPulseSpeed + hash(vec3(id, 0.0)) * 6.28);
                  pulse = 0.5 + 0.5 * pulse;
                  
                  field += neuronCore * 1.5;
                  field += synapse * pulse * 0.5;
                }
              }
              return min(field, 1.0);
            }

            void main() {
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              
              // Generate neural activity
              float field = neuralField(vUv);
              float energy = neuralField(vUv + vec2(time * 0.1));
              
              // Compose colors
              vec3 neuralColor = mix(uBgColor, uNeuronColor, field);
              vec3 synapticEnergy = uEnergyColor * energy * 0.5;
              vec3 base = neuralColor + synapticEnergy;
              
              // Apply lighting
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, uRim, uAmbient);
              vec3 final = lo.color + synapticEnergy * 0.5;
              
              gl_FragColor = vec4(final, 1.0);
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
            uAmbient: { value: 0.22 },
            uSpecPower: { value: 96.0 },
            uSpecStrength: { value: 0.35 },
            uRim: { value: 0.32 },
            uTraceScale: { value: 14.0 },
            uViaScale: { value: 6.0 },
            uFlow: { value: 1.0 },
            uMaskCol: { value: new THREE.Color("#0b2e21") },
            uCopperCol: { value: new THREE.Color("#ffb45c") },
            uFlowCol: { value: new THREE.Color("#ffe082") },
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
            uniform float time, uTraceScale, uViaScale, uFlow, uAmbient, uSpecPower, uSpecStrength, uRim;
            uniform vec3 uLightDir, uMaskCol, uCopperCol, uFlowCol;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            float traces(vec2 uv, float scale){
              uv *= scale;
              vec2 g = fract(uv) - 0.5;
              vec2 d = abs(g);
              float line = min(d.x, d.y);
              float t = 1.0 - smoothstep(0.0, 0.06, line);
              float breaks = step(0.55, fbm(vec3(floor(uv), 0.0)));
              return t * breaks;
            }
            float vias(vec2 uv, float scale){
              vec2 p = fract(uv*scale) - 0.5;
              float r = length(p);
              return 1.0 - smoothstep(0.18, 0.22, r);
            }
            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 base = uMaskCol * (0.9 + 0.1*fbm(vPos*1.2));
              float tr = traces(vUv, uTraceScale);
              float vi = vias(vUv, uViaScale);
              float flow = sin(vUv.x*40.0 - time*4.0)*sin(vUv.y*36.0 - time*3.0);
              flow = smoothstep(0.6, 1.0, flow) * tr * uFlow;
              vec3 copper = uCopperCol * (0.8 + 0.2*fbm(vPos*3.0));
              vec3 coat = mix(base, copper, clamp(tr*0.95 + vi, 0.0, 1.0));
              vec3 emissive = uFlowCol * flow * 0.9;
              LightOut lo = shade(n, v, l, coat, uSpecPower, uSpecStrength, uRim, uAmbient);
              gl_FragColor = vec4(lo.color + emissive, 1.0);
            }
          `
          }
        />
      )

    default:
      return <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
  }
}
