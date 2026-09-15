import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { transitionState } from "@/lib/scene/sceneTransitions";
export default function TransitionParticles({
  progress,
  reduced,
  count,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  count: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996;
      const r = Math.sqrt(i / count);
      data.set(
        [Math.cos(angle) * r, Math.sin(angle) * r, (i % 91) / 91],
        i * 3,
      );
    }
    return data;
  }, [count]);
  const uniforms = useMemo(
    () => ({
      uIntensity: { value: 0 },
      uRelease: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color("#e6c7ff") },
    }),
    [],
  );
  useFrame(() => {
    if (!material.current) return;
    const state = transitionState(progress.current);
    const u = material.current.uniforms;
    u.uOpacity.value =
      state && !reduced ? Math.sin(state.intensity * Math.PI) * 0.9 : 0;
    if (state) {
      u.uIntensity.value = state.intensity;
      u.uRelease.value = state.before ? 0 : 1;
      u.uColor.value.set(state.cue.color);
    }
  });
  return (
    <points frustumCulled={false} renderOrder={19}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        vertexShader={`uniform float uIntensity;uniform float uRelease;varying float vAlpha;void main(){float scale=(1.-uIntensity)*(1.+uRelease*2.);vec2 p=position.xy*scale*1.8;float theta=uIntensity*2.*position.z;mat2 spin=mat2(cos(theta),-sin(theta),sin(theta),cos(theta));gl_Position=vec4(spin*p,0.,1.);gl_PointSize=1.+position.z*3.+uIntensity*2.;vAlpha=.3+position.z*.7;}`}
        fragmentShader={`uniform vec3 uColor;uniform float uOpacity;varying float vAlpha;void main(){float a=max(0.,1.-length(gl_PointCoord-.5)*2.);gl_FragColor=vec4(uColor,a*uOpacity*vAlpha);}`}
      />
    </points>
  );
}
