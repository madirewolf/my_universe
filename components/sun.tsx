"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Mesh } from "three"
import { LIGHTING } from "@/lib/constants"

interface SunProps {
  position: [number, number, number]
}

/**
 * Notes
 * - Only use the single `state` arg in useFrame. Don’t destructure.
 * - No external libs, just three + @react-three/fiber.
 * - Inline shaders for v0 compatibility.
 */
export default function Sun({ position }: SunProps) {
  const sunRef = useRef<Mesh>(null)
  const coronaRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)

  // --- Shaders: tiny, self-contained noise + fresnel ---

  // Vertex shader: pass position/normal + view-space position for Fresnel
  const sunVertex = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;

      vec4 mvPosition = viewMatrix * worldPos;
      vViewDir = normalize(-mvPosition.xyz);

      gl_Position = projectionMatrix * mvPosition;
    }
  `

  // Minimal 3D value noise (fast, good-enough for surface boiling)
  const noiseGLSL = /* glsl */ `
    // hash & noise by inigo quilez-ish (trimmed)
    float hash(vec3 p) { 
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
      float a = 0.0;
      float amp = 0.5;
      for(int i=0;i<5;i++){
        a += amp * noise(p);
        p *= 2.1;
        amp *= 0.5;
      }
      return a;
    }
  `

  // Fragment shader: animated convection + hot spots + Fresnel rim + slight limb darkening
  const sunFragment = /* glsl */ `
    uniform float uTime;
    uniform vec3  uColorA;    // deep orange
    uniform vec3  uColorB;    // bright yellow/white
    uniform float uEmissive;  // base brightness
    uniform float uGranScale; // surface noise scale
    uniform float uHotSpot;   // hot spot strength

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;

    ${noiseGLSL}

    void main() {
      // Convection granulation – move noise over time
      vec3 p = vWorldPos * uGranScale;
      float t = uTime * 0.15;
      float g1 = fbm(p + vec3( t, 0.0, 0.0));
      float g2 = fbm(p * 0.7 + vec3(0.0, t*1.3, 0.0));
      float gran = smoothstep(0.2, 0.95, (g1*0.7 + g2*0.6));

      // Hotter cells pop; cooler ones recede
      float hotspots = pow(gran, 3.0) * uHotSpot;

      // Limb darkening: surfaces at grazing angles appear dimmer
      float ndotv = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
      float limb = pow(ndotv, 0.6);

      // Fresnel rim-glow to hint at the chromosphere just at the edge
      float fres = pow(1.0 - ndotv, 2.0);

      // Color blend
      vec3 baseCol = mix(uColorA, uColorB, clamp(gran*1.2 + hotspots, 0.0, 1.0));
      float glow = uEmissive * (0.6 + 0.4*limb) + fres * 0.7;

      vec3 col = baseCol * glow;

      // Pure emission (stars light themselves)
      gl_FragColor = vec4(col, 1.0);
      #ifdef OES_standard_derivatives
      // keep it straightforward; no extra effects here to stay WebGL1-friendly
      #endif
    }
  `

  // Corona: radial falloff with turbulent edge; additive & billboarded
  const coronaVertex = /* glsl */ `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `
  const coronaFragment = /* glsl */ `
    uniform float uTime;
    uniform vec3  uCoronaCol;
    uniform float uIntensity;

    varying vec2 vUv;

    ${noiseGLSL}

    void main(){
      // radial coord
      vec2 uv = vUv * 2.0 - 1.0;
      float r = length(uv);

      // turbulent edge
      float edge = 1.0 - smoothstep(0.55, 1.0, r + (fbm(vec3(uv*2.0, uTime*0.15))*0.18));

      // inner falloff
      float inner = smoothstep(1.0, 0.0, r);

      float a = clamp(edge * inner, 0.0, 1.0);

      gl_FragColor = vec4(uCoronaCol * uIntensity, a);
    }
  `

  // Materials/uniform refs
  const sunMatRef = useRef<THREE.ShaderMaterial>(null)
  const coronaMatRef = useRef<THREE.ShaderMaterial>(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (sunMatRef.current) sunMatRef.current.uniforms.uTime.value = t
    if (coronaMatRef.current) coronaMatRef.current.uniforms.uTime.value = t

    // Subtle breathing glow by scaling the outer glow sphere
    if (glowRef.current) {
      const scale = 1 + Math.sin(t * 1.8) * 0.05
      glowRef.current.scale.setScalar(scale)
    }

    // Make the corona face the camera (billboard)
    if (coronaRef.current) {
      coronaRef.current.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <group position={position}>
      {/* Star body (pure emission via shader) */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[2.0, 64, 64]} />
        <shaderMaterial
          ref={sunMatRef}
          transparent={false}
          depthWrite={true}
          depthTest
          blending={THREE.NormalBlending}
          uniforms={{
            uTime: { value: 0 },
            uColorA: { value: new THREE.Color("#FF6B00") }, // deep orange
            uColorB: { value: new THREE.Color("#FFDFA0") }, // hot yellow/white
            uEmissive: { value: 1.9 },
            uGranScale: { value: 0.7 }, // tweak granulation size (lower = larger cells)
            uHotSpot: { value: 0.9 },
          }}
          vertexShader={sunVertex}
          fragmentShader={sunFragment}
        />
      </mesh>

      {/* Subtle outer glow shell (cheap, transparent) */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.25, 48, 48]} />
        <meshBasicMaterial
          color={"#FFB347"}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Camera-facing corona plane with turbulent edge */}
      <mesh ref={coronaRef} renderOrder={-1} position={[0, 0, 0]}>
        <planeGeometry args={[7.5, 7.5, 1, 1]} />
        <shaderMaterial
          ref={coronaMatRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uCoronaCol: { value: new THREE.Color("#FFD37A") },
            uIntensity: { value: 1.2 },
          }}
          vertexShader={coronaVertex}
          fragmentShader={coronaFragment}
        />
      </mesh>

      {/* Point light so the sun still lights up nearby objects */}
      <pointLight
        intensity={LIGHTING.sunIntensity}
        distance={LIGHTING.sunDistance}
        decay={LIGHTING.sunDecay}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
    </group>
  )
}
