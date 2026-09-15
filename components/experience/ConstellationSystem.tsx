import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function ConstellationSystem({
  progress,
  reduced,
  paused,
  count,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
  count: number;
}) {
  const points = useRef<THREE.Points>(null),
    ring = useRef<THREE.Group>(null);
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 5 + Math.sin(i * 19.13) * 0.8;
      positions.set(
        [Math.cos(a) * r, Math.sin(a) * r, Math.sin(i * 7.17) * 4],
        i * 3,
      );
    }
    return positions;
  }, [count]);
  useFrame((_, delta) => {
    const p = progress.current;
    if (points.current) {
      const geometry = points.current.geometry,
        attr = geometry.attributes.position;
      const expand = Math.sin(smooth((p - 0.54) / 0.14) * Math.PI);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const r = 5.3 + Math.sin(i * 19.13) * (0.15 + expand * 7);
        attr.setXYZ(
          i,
          Math.cos(a) * r,
          Math.sin(a) * r + 1,
          Math.sin(i * 7.17) * (1 + expand * 15) - 3,
        );
      }
      attr.needsUpdate = true;
      (points.current.material as THREE.PointsMaterial).opacity =
        smooth((p - 0.49) / 0.06) * (1 - smooth((p - 0.76) / 0.02));
      if (!paused && !reduced) points.current.rotation.z += delta * 0.017;
    }
    if (ring.current) {
      const scale =
        smooth((p - 0.67) / 0.023) * (1 - smooth((p - 0.76) / 0.025));
      ring.current.scale.setScalar(Math.max(0.001, scale));
      ring.current.visible = scale > 0.001;
      ring.current.rotation.z = reduced ? 0 : p * 2;
    }
  });
  return (
    <>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          color="#ffcfdf"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <group ref={ring} position={[0, 1, 0]}>
        {[5.2, 5.32, 5.7].map((r, i) => (
          <mesh key={i} rotation={[0, 0, i * 0.1]}>
            <torusGeometry args={[r, i === 1 ? 0.014 : 0.045, 10, 160]} />
            {i === 1 ? (
              <meshBasicMaterial color="#f4c3a8" />
            ) : (
              <meshStandardMaterial
                color="#d7c6a5"
                metalness={1}
                roughness={0.13}
              />
            )}
          </mesh>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI) / 6) * 5.52,
              Math.sin((i * Math.PI) / 6) * 5.52,
              0,
            ]}
            rotation={[0, 0, (-i * Math.PI) / 6]}
          >
            <octahedronGeometry args={[0.08]} />
            <meshBasicMaterial color="#f5dbb7" />
          </mesh>
        ))}
      </group>
    </>
  );
}
