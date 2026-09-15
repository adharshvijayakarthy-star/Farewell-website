import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";
const vertex = `varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `varying vec3 vPosition;uniform float uTime;uniform float uProgress;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.3,.7));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float f=0.;float a=.5;for(int i=0;i<4;i++){f+=a*noise(p);p=p*2.04+1.3;a*=.5;}return f;}
void main(){vec3 dir=normalize(vPosition);float p=uProgress;float wake=smoothstep(.03,.15,p);float dawn=smoothstep(.85,.94,p);float end=1.-smoothstep(.966,.998,p);vec3 q=dir*3.2+vec3(uTime*.013,0,0);float n=fbm(q);float cloud=pow(fbm(q+vec3(n*2.)),3.);float band=exp(-pow((dir.y+.08+sin(dir.x*4.)*.14)*2.8,2.));vec3 base=mix(vec3(.009,.015,.045),vec3(.018,.016,.063),wake);vec3 color=mix(vec3(.12,.035,.32),vec3(.4,.045,.24),smoothstep(.18,.3,p));color=mix(color,vec3(.12,.11,.33),smoothstep(.33,.43,p));color=mix(color,vec3(.42,.06,.27),smoothstep(.55,.65,p));vec3 nebula=color*cloud*band*(.6+wake*3.);vec3 cyan=vec3(.015,.17,.24)*pow(n,5.)*wake;float horizon=pow(1.-abs(dir.y+.17),9.);vec3 dawnColor=vec3(.73,.31,.24)*horizon+vec3(.16,.075,.18)*(1.-dir.y);vec3 col=mix(base+nebula+cyan,dawnColor,dawn*.8);gl_FragColor=vec4(col*end,1.);}`;
export default function Atmosphere({
  progress,
  reduced,
  paused,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uProgress: { value: 0 } }),
    [],
  );
  useFrame((_, delta) => {
    if (!material.current || paused) return;
    material.current.uniforms.uProgress.value = progress.current;
    if (!reduced) material.current.uniforms.uTime.value += delta;
  });
  return (
    <mesh>
      <sphereGeometry args={[90, 32, 24]} />
      <shaderMaterial
        ref={material}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        depthWrite={false}
      />
    </mesh>
  );
}
export function FinalStar({ progress }: { progress: RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const p = progress.current;
    group.current.visible = p > 0.963;
    group.current.scale.setScalar(
      (0.35 + smooth((p - 0.965) / 0.015) * 0.8) *
        (1 - smooth((p - 0.995) / 0.005)),
    );
  });
  return (
    <group ref={group} position={[0, 1, 3]}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#fff4dd" />
      </mesh>
      <mesh>
        <planeGeometry args={[0.015, 1.5]} />
        <meshBasicMaterial
          color="#f9dac0"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.015, 1]} />
        <meshBasicMaterial
          color="#f9dac0"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
