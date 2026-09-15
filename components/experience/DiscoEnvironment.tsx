import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth, localProgress } from "@/lib/scene/sceneTimeline";
import { HeroAsset } from "./HeroAssets";
const chrome = { color: "#b7c5ee", metalness: 1, roughness: 0.14 };
export function DiscoBall({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[0.99, 32, 24]} />
        <meshStandardMaterial color="#101121" metalness={0.9} roughness={0.2} />
      </mesh>
      <HeroAsset
        file="/models/disco-ball.glb"
        fallback={
          <mesh>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial {...chrome} flatShading />
          </mesh>
        }
      />
    </group>
  );
}
function Flower({
  position,
  scale = 0.8,
  rotation = [1.3, 0, 0],
}: {
  position: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <HeroAsset
        file="/models/celestial-flower.glb"
        fallback={
          <mesh>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
        }
      />
    </group>
  );
}
export default function DiscoEnvironment({
  progress,
  reduced,
  paused,
  mobile,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
  mobile: boolean;
}) {
  const group = useRef<THREE.Group>(null),
    ball = useRef<THREE.Group>(null),
    rings = useRef<THREE.Group>(null),
    figures = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (paused) return;
    const p = progress.current;
    if (group.current) {
      const scale =
        smooth((p - 0.18) / 0.035) * (1 - smooth((p - 0.645) / 0.035));
      group.current.visible = scale > 0.001;
      group.current.scale.setScalar(Math.max(0.001, scale));
    }
    if (ball.current) {
      ball.current.rotation.y += reduced ? 0 : delta * 0.09;
      ball.current.position.y = 3 + Math.sin(p * 24) * 0.4;
      ball.current.position.x =
        p < 0.34 ? Math.sin(localProgress(p, 2) * Math.PI * 2) * 1.3 : -4;
    }
    if (rings.current)
      rings.current.rotation.z = reduced
        ? -0.2
        : -0.2 + Math.sin(p * 18) * 0.22;
    if (figures.current)
      figures.current.children.forEach((f, i) => {
        f.rotation.z = reduced
          ? 0
          : Math.sin(performance.now() * 0.0006 + i) * 0.025;
      });
  });
  return (
    <group ref={group}>
      <group ref={ball}>
        <DiscoBall position={[0, 0, -2]} scale={2.7} />
        <mesh position={[0, 6, -2]}>
          <cylinderGeometry args={[0.009, 0.009, 8, 6]} />
          <meshStandardMaterial color="#afa6c3" metalness={1} roughness={0.4} />
        </mesh>
      </group>
      <DiscoBall position={[-8, 4, -9]} scale={1.3} />
      <DiscoBall position={[9, 0, -7]} scale={1.8} />
      <group ref={rings} position={[0, 1, -5]}>
        {[5.8, 6.1, 6.6].map((radius, i) => (
          <mesh key={i} rotation={[0.1 * i, 0.13 * i, 0]}>
            <torusGeometry args={[radius, i === 1 ? 0.022 : 0.08, 12, 160]} />
            {i === 1 ? (
              <meshBasicMaterial color="#f19dcd" />
            ) : (
              <meshStandardMaterial {...chrome} />
            )}
          </mesh>
        ))}
      </group>
      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[110, 100]} />
        <meshStandardMaterial
          color="#080d20"
          metalness={0.8}
          envMapIntensity={0.08}
          roughness={0.32}
          transparent
          opacity={0.88}
        />
      </mesh>
      <group position={[0, -3.01, 0]}>
        {Array.from({ length: 14 }, (_, i) => (
          <group key={i}>
            <mesh
              position={[(i - 7) * 2.4, 0, -10]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.009, 70]} />
              <meshBasicMaterial color="#785cb6" transparent opacity={0.5} />
            </mesh>
            <mesh
              position={[0, 0, (i - 9) * 3]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[60, 0.008]} />
              <meshBasicMaterial color="#7a539f" transparent opacity={0.35} />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[0, -3.03, 0]} scale={[1, -0.47, 1]}>
        <DiscoBall position={[0, 3, -2]} scale={2.7} />
      </group>
      <Flower
        position={[-7, -1, 1]}
        scale={mobile ? 1 : 1.35}
        rotation={[1.3, 0.2, 0.2]}
      />
      <Flower position={[7, 0, -1]} scale={1.1} rotation={[1.1, -0.4, -0.4]} />
      {!mobile && (
        <>
          <Flower position={[10, 5, -10]} scale={0.8} />
          <Flower position={[-10, 6, -8]} scale={0.75} />
        </>
      )}
      <group ref={figures} position={[0, -2.9, -13]}>
        {Array.from({ length: 7 }, (_, i) => (
          <group
            key={i}
            position={[(i - 3) * 1.9, 0, Math.sin(i) * 2]}
            rotation={[0, i * 0.45, 0]}
          >
            <mesh position={[0, 0.8, 0]} scale={[0.25, 0.75, 0.2]}>
              <capsuleGeometry args={[1, 1, 3, 8]} />
              <meshStandardMaterial
                color="#08091a"
                metalness={0.6}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[0, 1.85, 0]}>
              <sphereGeometry args={[0.22, 12, 10]} />
              <meshStandardMaterial color="#12142a" />
            </mesh>
          </group>
        ))}
      </group>
      {Array.from({ length: mobile ? 4 : 8 }, (_, i) => (
        <mesh
          key={i}
          position={[(i % 2 === 0 ? -1 : 1) * (7 + i * 0.5), 2, -5 - i * 2]}
          rotation={[0, 0, (i % 2 === 0 ? -1 : 1) * (0.5 + i * 0.07)]}
        >
          <cylinderGeometry args={[0.012, 0.012, 20, 6]} />
          <meshBasicMaterial
            color={i % 2 ? "#ed59bb" : "#49bde7"}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}
