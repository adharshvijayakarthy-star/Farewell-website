import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function CelestialBook({
  progress,
}: {
  progress: RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null),
    page = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.6, 4.7, 28, 1);
    g.translate(1.8, 0, 0);
    return g;
  }, []);
  useFrame(() => {
    if (!group.current || !page.current) return;
    const p = progress.current;
    const enter = smooth((p - 0.755) / 0.025),
      exit = smooth((p - 0.856) / 0.02);
    group.current.visible = p > 0.75 && p < 0.876;
    group.current.scale.setScalar(Math.max(0.001, enter * (1 - exit) * 1.1));
    group.current.rotation.x = -0.45 + enter * 0.3;
    group.current.rotation.z = 0.05;
    const turn = smooth((p - 0.829) / 0.033);
    page.current.rotation.y = -turn * Math.PI;
    const attr = geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const x = ((i % 29) / 28) * 3.6;
      attr.setZ(
        i,
        Math.sin((x / 3.6) * Math.PI) * Math.sin(turn * Math.PI) * 0.8,
      );
    }
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
  });
  return (
    <group ref={group} position={[0, 0, 2]} rotation={[-0.5, 0, 0]}>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 1.86, 0, 0]}
          rotation={[0, side * 0.08, 0]}
        >
          <mesh>
            <boxGeometry args={[3.75, 4.9, 0.14]} />
            <meshStandardMaterial
              color="#a08a62"
              metalness={0.85}
              roughness={0.21}
            />
          </mesh>
          <mesh position={[0, 0, 0.11]}>
            <boxGeometry args={[3.55, 4.7, 0.13]} />
            <meshStandardMaterial
              color="#e4d9d1"
              metalness={0.28}
              roughness={0.33}
            />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[0, 0.8 - i * 0.23, 0.185]}>
              <planeGeometry args={[2.7 - (i % 3) * 0.4, 0.008]} />
              <meshBasicMaterial color="#a89296" transparent opacity={0.45} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh ref={page} geometry={geometry} position={[0, 0, 0.23]}>
        <meshStandardMaterial
          color="#f4dfda"
          metalness={0.35}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <cylinderGeometry args={[0.11, 0.11, 4.9, 12]} />
        <meshStandardMaterial color="#c7ab71" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}
