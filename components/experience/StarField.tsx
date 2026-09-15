import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function StarField({
  progress,
  count,
  reduced,
  paused,
}: {
  progress: RefObject<number>;
  count: number;
  reduced: boolean;
  paused: boolean;
}) {
  const ref = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const { positions, sizes, colors } = useMemo(() => {
    let seed = 19;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const positions = new Float32Array(count * 3),
      sizes = new Float32Array(count),
      colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2,
        phi = Math.acos(2 * rand() - 1),
        r = 18 + rand() * 53;
      positions.set(
        [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        ],
        i * 3,
      );
      sizes[i] = 0.5 + rand() * 2.3;
      const col = new THREE.Color().setHSL(
        0.56 + rand() * 0.23,
        0.2 + rand() * 0.3,
        0.65 + rand() * 0.3,
      );
      colors.set([col.r, col.g, col.b], i * 3);
    }
    return { positions, sizes, colors };
  }, [count]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uSize: { value: 1 },
    }),
    [],
  );
  useFrame((_, delta) => {
    if (!ref.current || !material.current || paused) return;
    const p = progress.current;
    if (!reduced) {
      ref.current.rotation.y = p * 0.6;
      ref.current.rotation.z += delta * 0.004;
      material.current.uniforms.uTime.value += delta;
    }
    material.current.uniforms.uOpacity.value = 1 - smooth((p - 0.96) / 0.034);
    material.current.uniforms.uSize.value =
      1 + Math.sin(smooth((p - 0.54) / 0.13) * Math.PI) * 0.6;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
        vertexShader={`attribute float aSize;varying vec3 vColor;varying float vTwinkle;uniform float uTime;uniform float uSize;void main(){vColor=color;vTwinkle=.65+.35*sin(uTime*.8+position.x*3.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*100./-mv.z,1.,5.)*uSize;gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`varying vec3 vColor;varying float vTwinkle;uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float alpha=pow(max(0.,1.-d*2.),2.);gl_FragColor=vec4(vColor,alpha*vTwinkle*uOpacity);}`}
      />
    </points>
  );
}
