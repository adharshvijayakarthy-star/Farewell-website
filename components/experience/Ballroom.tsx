import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function Ballroom({
  progress,
  mobile,
}: {
  progress: RefObject<number>;
  mobile: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const p = progress.current;
    const scale = smooth((p - 0.25) / 0.09) * (1 - smooth((p - 0.65) / 0.03));
    group.current.visible = scale > 0.001;
    group.current.scale.setScalar(Math.max(0.001, scale));
  });
  return (
    <group ref={group}>
      {Array.from({ length: mobile ? 5 : 8 }, (_, i) => (
        <group key={i} position={[0, 0, -9 - i * 4]}>
          <mesh position={[0, 1, 0]}>
            <torusGeometry args={[7.4, 0.065, 10, 96, Math.PI]} />
            <meshStandardMaterial
              color="#c6b7d3"
              metalness={0.94}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, 1, -0.02]}>
            <torusGeometry args={[7.6, 0.015, 8, 96, Math.PI]} />
            <meshBasicMaterial color={i % 2 ? "#df9acf" : "#a5c9ef"} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 7.4, -1, 0]}>
              <mesh>
                <cylinderGeometry args={[0.07, 0.1, 4, 10]} />
                <meshStandardMaterial
                  color="#b4a1cd"
                  metalness={1}
                  roughness={0.18}
                />
              </mesh>
              <mesh position={[0, -1.8, 0]}>
                <cylinderGeometry args={[0.3, 0.45, 0.4, 16]} />
                <meshStandardMaterial
                  color="#c8bba4"
                  metalness={0.85}
                  roughness={0.18}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
