import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { DiscoBall } from "./DiscoEnvironment";
import { HeroAsset } from "./HeroAssets";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function MemoryUniverse({
  progress,
}: {
  progress: RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const p = progress.current;
    const scale =
      smooth((p - 0.949) / 0.012) * (1 - smooth((p - 0.967) / 0.022));
    ref.current.visible = scale > 0.001;
    ref.current.scale.setScalar(Math.max(0.001, scale));
    ref.current.rotation.y = (p - 0.95) * 4;
  });
  return (
    <group ref={ref} position={[0, -3, -3]}>
      <DiscoBall position={[0, 2, 0]} scale={2} />
      {[4, 4.5, 5].map((r, i) => (
        <mesh key={i} rotation={[i * 0.2, 0.2, 0]}>
          <torusGeometry args={[r, 0.035, 8, 120]} />
          <meshStandardMaterial color="#dcc8b9" metalness={1} roughness={0.2} />
        </mesh>
      ))}
      <group position={[-4, 0, 0]} rotation={[1.3, 0, 0]} scale={0.8}>
        <HeroAsset file="/models/celestial-flower.glb" fallback={null} />
      </group>
      <mesh position={[3, -1, 1]} rotation={[0.3, 0, 0.2]}>
        <boxGeometry args={[2, 1.5, 0.1]} />
        <meshStandardMaterial color="#e0c3b8" metalness={0.5} roughness={0.3} />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} position={[x, -2, -4]}>
          <torusGeometry args={[3, 0.05, 8, 80, Math.PI]} />
          <meshStandardMaterial color="#c9afe5" metalness={1} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}
