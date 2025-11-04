"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

export default function StarField() {
  const starGroupsRef = useRef<THREE.Group[]>([])

  const starClusters = useMemo(() => {
    const clusters = []
    const numClusters = 8

    for (let cluster = 0; cluster < numClusters; cluster++) {
      const starsInCluster = 200 + Math.floor(Math.random() * 100)
      const positions = new Float32Array(starsInCluster * 3)
      const colors = new Float32Array(starsInCluster * 3)
      const sizes = new Float32Array(starsInCluster)

      // Random cluster properties
      const blinkRate = 0.5 + Math.random() * 2
      const blinkOffset = Math.random() * Math.PI * 2

      for (let i = 0; i < starsInCluster; i++) {
        // Random positions in a large sphere
        const radius = 100 + Math.random() * 200
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = radius * Math.cos(phi)

        // Random colors (mostly white/blue/yellow)
        const colorChoice = Math.random()
        if (colorChoice < 0.7) {
          colors[i * 3] = 1
          colors[i * 3 + 1] = 1
          colors[i * 3 + 2] = 1
        } else if (colorChoice < 0.85) {
          colors[i * 3] = 0.8
          colors[i * 3 + 1] = 0.9
          colors[i * 3 + 2] = 1
        } else {
          colors[i * 3] = 1
          colors[i * 3 + 1] = 1
          colors[i * 3 + 2] = 0.8
        }

        sizes[i] = Math.random() * 4 + 1
      }

      clusters.push({
        positions,
        colors,
        sizes,
        count: starsInCluster,
        blinkRate,
        blinkOffset,
      })
    }

    return clusters
  }, [])

  useFrame((state) => {
    starGroupsRef.current.forEach((group, index) => {
      if (group) {
        const cluster = starClusters[index]
        const material = group.children[0]?.material as THREE.PointsMaterial
        if (material) {
          const opacity = 0.3 + Math.sin(state.clock.elapsedTime * cluster.blinkRate + cluster.blinkOffset) * 0.4
          material.opacity = Math.max(0.1, opacity)
        }
      }
    })
  })

  // Create star shape geometry
  const starShape = useMemo(() => {
    const shape = new THREE.Shape()
    const outerRadius = 1
    const innerRadius = 0.4
    const spikes = 5

    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()

    return new THREE.ShapeGeometry(shape)
  }, [])

  return (
    <group>
      {starClusters.map((cluster, index) => (
        <group
          key={index}
          ref={(el) => {
            if (el) starGroupsRef.current[index] = el
          }}
        >
          <points>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={cluster.count}
                array={cluster.positions}
                itemSize={3}
              />
              <bufferAttribute attach="attributes-color" count={cluster.count} array={cluster.colors} itemSize={3} />
              <bufferAttribute attach="attributes-size" count={cluster.count} array={cluster.sizes} itemSize={1} />
            </bufferGeometry>
            <pointsMaterial
              size={3}
              sizeAttenuation={true}
              vertexColors={true}
              transparent={true}
              opacity={0.8}
              map={(() => {
                const canvas = document.createElement("canvas")
                canvas.width = 32
                canvas.height = 32
                const ctx = canvas.getContext("2d")!

                // Draw a sparkly star shape
                ctx.fillStyle = "white"
                ctx.beginPath()
                const centerX = 16,
                  centerY = 16
                const spikes = 4
                const outerRadius = 15
                const innerRadius = 6

                for (let i = 0; i < spikes * 2; i++) {
                  const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
                  const radius = i % 2 === 0 ? outerRadius : innerRadius
                  const x = centerX + Math.cos(angle) * radius
                  const y = centerY + Math.sin(angle) * radius

                  if (i === 0) ctx.moveTo(x, y)
                  else ctx.lineTo(x, y)
                }
                ctx.closePath()
                ctx.fill()

                const texture = new THREE.CanvasTexture(canvas)
                return texture
              })()}
            />
          </points>
        </group>
      ))}
    </group>
  )
}
