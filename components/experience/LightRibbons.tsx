import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
const glowVertex =
  "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
const glowFragment =
  "varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity;void main(){float r=length((vUv-.5)*2.);float a=pow(max(0.,1.-r),3.)*uOpacity;gl_FragColor=vec4(uColor,a);}";
export default function LightRibbons({
  progress,
  reduced,
  paused,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ribbons = useMemo(
    () =>
      Array.from({ length: 5 }, (_, k) => {
        const points = Array.from({ length: 80 }, (_, i) => {
          const t = i / 79;
          return new THREE.Vector3(
            Math.sin(t * 5 + k) * 9,
            Math.cos(t * 3 + k) * 5,
            -18 + t * 29,
          );
        });
        return new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          100,
          0.012,
          4,
          false,
        );
      }),
    [],
  );
  const uniforms = useMemo(
    () =>
      ["#d632bf", "#274dff", "#19bdda"].map((c) => ({
        uColor: { value: new THREE.Color(c) },
        uOpacity: { value: 0.65 },
      })),
    [],
  );
  useFrame((_, delta) => {
    if (!group.current) return;
    const p = progress.current;
    const a = smooth((p - 0.14) / 0.06) * (1 - smooth((p - 0.33) / 0.075));
    group.current.visible = a > 0.001;
    group.current.scale.setScalar(Math.max(0.001, a));
    if (!reduced && !paused) group.current.rotation.z += delta * 0.012;
  });
  return (
    <group ref={group}>
      {ribbons.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color={i % 2 ? "#54e5ef" : "#f659bf"}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
      {uniforms.map((u, i) => (
        <mesh key={i} position={[(i - 1) * 10, 3, -8]}>
          <planeGeometry args={[25, 20]} />
          <shaderMaterial
            uniforms={u}
            vertexShader={glowVertex}
            fragmentShader={glowFragment}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <group
          key={i}
          position={[
            Math.sin(i * 2.4) * 11,
            Math.cos(i * 1.3) * 6,
            -8 + Math.sin(i) * 8,
          ]}
          rotation={[0, 0, 0.8]}
        >
          <mesh>
            <planeGeometry args={[0.012, 0.23 + (i % 3) * 0.1]} />
            <meshBasicMaterial color="#ffe9ce" />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[0.012, 0.23]} />
            <meshBasicMaterial color="#ffe9ce" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
