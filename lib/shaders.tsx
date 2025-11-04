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
            uAmbient: { value: 0.22 },
            uSpecPower: { value: 48.0 },
            uSpecStrength: { value: 0.25 },
            uRim: { value: 0.45 },
            uGlow: { value: 1.15 },
            uBg: { value: new THREE.Color("#0d1a2b") },
            uNodeCol: { value: new THREE.Color("#7ae1ff") },
            uLinkCol: { value: new THREE.Color("#2bb3ff") },
            uNodeSize: { value: 0.0035 },
            uLinkWidth: { value: 0.002 },
            uCrossing: { value: 0.35 },
            uLayersSpread: { value: 0.0084 },
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
            uniform float time, uGlow, uNodeSize, uLinkWidth, uCrossing, uLayersSpread;
            uniform vec3 uLightDir, uBg, uNodeCol, uLinkCol;
            uniform float uAmbient, uSpecPower, uSpecStrength, uRim;
            varying vec2 vUv; varying vec3 vN, vPos, vView;
            ${NOISE_GLSL}
            ${LIGHTING_GLSL}
            const int LAYERS = 5;
            const int NODES  = 8;
            const int SAMPLES = 8;
            float rnd(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.97)))*182437.54); }
            vec2 nodePos(int i, int j){
              float li = float(i), lj = float(j);
              float x0 = 0.5 - 0.5*uLayersSpread;
              float x1 = 0.5 + 0.5*uLayersSpread;
              float x = mix(x0, x1, (li+0.5)/float(LAYERS));
              float y = (lj+0.5)/float(NODES);
              float jx = (rnd(vec2(li, lj))*2.0-1.0) * 0.012;
              float jy = (rnd(vec2(li+3.7, lj))*2.0-1.0) * 0.012;
              return vec2(x + jx, y + jy);
            }
            float curveDist(vec2 p, vec2 a, vec2 b, vec2 c){
              float d = 1e9;
              for(int s=0; s<SAMPLES; s++){
                float t = float(s)/float(SAMPLES-1);
                vec2 q = mix(mix(a, b, t), mix(b, c, t), t);
                d = min(d, length(p - q));
              }
              return d;
            }
            float layerLinks(vec2 p, int i, int j){
              float acc = 0.0;
              vec2 a = nodePos(i, j);
              for(int t=0; t<2; t++){
                float pick = rnd(vec2(float(i)*13.0 + float(j)*7.0 + float(t)*3.0, 9.1));
                int k = int(floor(pick * float(NODES)));
                if (t == 0) { k = int(clamp(float(j) + floor(pick*3.0)-1.0, 0.0, float(NODES-1))); }
                vec2 c = nodePos(i+1, k);
                float signY = (rnd(vec2(float(i), float(j)+float(t))) > 0.5) ? 1.0 : -1.0;
                float bow = uCrossing * (0.35 + 0.65*rnd(vec2(float(i)+5.0, float(k))));
                float wob = 0.08 * sin(time*0.9 + float(j)*0.7 + float(t));
                vec2 b = mix(a, c, 0.5) + vec2(0.0, signY * (bow + wob));
                float d = curveDist(p, a, b, c);
                float w = uLinkWidth * (0.85 + 0.15*sin(time*2.0 + float(j)*1.7));
                float line = 1.0 - smoothstep(w, w*1.8, d);
                float x0 = min(a.x, c.x);
                float x1 = max(a.x, c.x);
                float tflow = clamp((p.x - x0)/(x1 - x0 + 1e-4), 0.0, 1.0);
                float pulse = 0.6 + 0.4*sin(tflow*18.0 - time*5.0 + float(j)*0.9);
                acc += line * pulse;
              }
              return acc;
            }
            float nodeDisc(vec2 p, vec2 c, float r){
              return 1.0 - smoothstep(r, r*1.6, length(p - c));
            }
            void main(){
              vec3 n = normalize(vN), l = normalize(uLightDir), v = normalize(vView);
              vec3 base = uBg * (0.92 + 0.08*fbm(vPos*0.8));
              float links = 0.0;
              for(int i=0; i<LAYERS-1; i++){
                for(int j=0; j<NODES; j++){
                  links += layerLinks(vUv, i, j);
                }
              }
              links = clamp(links, 0.0, 2.0);
              float nodes = 0.0;
              for(int i=0; i<LAYERS; i++){
                for(int j=0; j<NODES; j++){
                  nodes += nodeDisc(vUv, nodePos(i,j), uNodeSize);
                }
              }
              nodes = clamp(nodes, 0.0, 1.0);
              vec3 emissive = uLinkCol * links + uNodeCol * nodes;
              emissive *= uGlow;
              LightOut lo = shade(n, v, l, base, uSpecPower, uSpecStrength, uRim, uAmbient);
              gl_FragColor = vec4(lo.color + emissive, 1.0);
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
