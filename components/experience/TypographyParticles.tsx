import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { textCues, textPhase } from "@/lib/scene/sceneTransitions";
const labels = [
  ["DISCO", "TILL DAWN"],
  ["ONE LAST", "NIGHT."],
  ["ONE FINAL", "CELEBRATION."],
  ["A THOUSAND", "MEMORIES."],
];
/** Samples the actual display font; stars assemble into matching letter silhouettes on the GPU.
 * The final readable text always remains HTML, independently of this decorative layer. */
export default function TypographyParticles({
  progress,
  reduced,
}: {
  progress: RefObject<number>;
  reduced: boolean;
}) {
  const { size } = useThree();
  const [ready, setReady] = useState(false);
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useRef<THREE.BufferGeometry>(null);
  const last = useRef(-1);
  useEffect(() => {
    let alive = true;
    void document.fonts.load('600 120px "Fraunces Variable"').then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const shapes = useMemo(() => {
    if (!ready) return [];
    return labels.map((lines) => {
      const c = document.createElement("canvas");
      c.width = 1000;
      c.height = 600;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `600 ${size.width < 700 ? 100 : 120}px "Fraunces Variable"`;
      lines.forEach((line, i) => ctx.fillText(line, 500, 265 + i * 130));
      const data = ctx.getImageData(0, 0, 1000, 600).data;
      const points = [];
      for (let y = 60; y < 500; y += 5)
        for (let x = 30; x < 970; x += 5)
          if (data[(y * 1000 + x) * 4 + 3] > 128)
            points.push((x / 1000 - 0.5) * 1.8, (0.5 - y / 600) * 1.6, 0);
      return new Float32Array(points);
    });
  }, [ready, size.width]);
  const uniforms = useMemo(
    () => ({
      uAssembly: { value: 0 },
      uExit: { value: 0 },
      uOpacity: { value: 0 },
      uAspect: { value: 1 },
    }),
    [],
  );
  useFrame(() => {
    if (!material.current || !geometry.current || shapes.length === 0) return;
    const p = progress.current;
    const cues = [textCues.title, ...textCues.promises];
    const index = cues.findIndex(
      (c) => p >= c.start - 0.012 && p <= c.end + 0.008,
    );
    if (index < 0 || reduced) {
      material.current.uniforms.uOpacity.value = 0;
      return;
    }
    if (last.current !== index) {
      geometry.current.setAttribute(
        "position",
        new THREE.BufferAttribute(shapes[index], 3),
      );
      last.current = index;
    }
    const phase = textPhase(p, cues[index]);
    material.current.uniforms.uAssembly.value = phase.entrance;
    material.current.uniforms.uExit.value = phase.exit;
    material.current.uniforms.uOpacity.value =
      Math.max(1 - phase.entrance, phase.exit) * 0.95;
  });
  return (
    <points frustumCulled={false} renderOrder={20}>
      <bufferGeometry ref={geometry} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`uniform float uAssembly;uniform float uExit;varying float vGlow;float rnd(float n){return fract(sin(n)*43758.5453);}void main(){float seed=position.x*14.7+position.y*82.4;vec2 cloud=vec2(rnd(seed),rnd(seed+7.))*2.-1.;float angle=(1.-uAssembly)*2.;mat2 spin=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));vec2 pos=mix(spin*cloud*1.5,position.xy,uAssembly);pos=mix(pos,cloud*2.,uExit);gl_Position=vec4(pos,0.,1.);gl_PointSize=1.2+rnd(seed+19.)*2.4;vGlow=.4+rnd(seed+2.)*.6;}`}
        fragmentShader={`uniform float uOpacity;varying float vGlow;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),2.);gl_FragColor=vec4(1.,.82,.96,a*uOpacity*vGlow);}`}
      />
    </points>
  );
}
