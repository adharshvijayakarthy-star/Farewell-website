import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function DawnEnvironment({
  progress,
}: {
  progress: RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const geometries = useMemo(
    () =>
      Array.from({ length: 4 }, (_, k) => {
        const g = new THREE.PlaneGeometry(140, 25, 100, 1);
        const attr = g.attributes.position;
        for (let i = 0; i <= 100; i++) {
          const x = attr.getX(i);
          attr.setY(
            i,
            Math.sin(x * 0.07 + k * 1.7) * 2 + Math.sin(x * 0.13 + k) * 1.6,
          );
        }
        g.computeVertexNormals();
        return g;
      }),
    [],
  );
  useFrame(() => {
    if (!group.current) return;
    const p = progress.current;
    group.current.visible = p > 0.825 && p < 0.991;
    const appear = smooth((p - 0.825) / 0.05),
      end = 1 - smooth((p - 0.965) / 0.026);
    group.current.scale.setScalar(Math.max(0.001, appear * end));
    group.current.position.y = -2 - (1 - appear) * 8;
  });
  return (
    <group ref={group}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, -i * 0.7, -22 + i * 3]}>
          <meshBasicMaterial
            color={["#71404f", "#493145", "#29243c", "#141b30"][i]}
          />
        </mesh>
      ))}
      <mesh position={[0, -1.6, -25]}>
        <torusGeometry args={[5.3, 0.012, 8, 160, Math.PI]} />
        <meshBasicMaterial color="#e7b690" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, -6, 3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial
          color="#292239"
          metalness={0.8}
          envMapIntensity={0.08}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}
