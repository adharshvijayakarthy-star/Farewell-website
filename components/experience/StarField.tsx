import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { smooth } from "@/lib/scene/sceneTimeline";

const starVertexShader = `
attribute float aSize;
attribute float aDepth;
attribute float aGlow;
attribute float aPhase;
varying vec3 vColor;
varying float vGlow;
varying float vTwinkle;
uniform float uTime;
uniform float uSize;
void main() {
  vColor = color;
  vGlow = aGlow;
  vTwinkle = 0.76 + 0.24 * sin(uTime * (0.55 + aDepth * 0.7) + aPhase);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(
    aSize * (72.0 + aDepth * 48.0) / max(0.001, -mvPosition.z),
    1.0,
    8.0
  ) * uSize * (0.9 + aGlow * 0.35);
  gl_Position = projectionMatrix * mvPosition;
}`;

const starFragmentShader = `
varying vec3 vColor;
varying float vGlow;
varying float vTwinkle;
uniform float uOpacity;
uniform float uTintStrength;
uniform float uDistantFade;
uniform vec3 uSceneTint;
void main() {
  float distanceToCenter = length(gl_PointCoord - vec2(0.5));
  float alpha = pow(max(0.0, 1.0 - distanceToCenter * 2.0), 1.7);
  float distanceLayer = mix(1.0, 0.22 + (1.0 - vGlow) * 0.55, uDistantFade);
  vec3 color = mix(vColor, uSceneTint, uTintStrength * (0.25 + vGlow * 0.2));
  gl_FragColor = vec4(
    color,
    alpha * vTwinkle * (0.46 + vGlow * 0.7) * uOpacity * distanceLayer
  );
}`;

type StarData = {
  base: Float32Array;
  positions: Float32Array;
  sizes: Float32Array;
  depths: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  colors: Float32Array;
  glows: Float32Array;
};

type SpecialData = StarData & { count: number };
type StarMood = {
  disco: number;
  promises: number;
  goodbye: number;
  energy: number;
};
type Candidate = { index: number; distance: number; influence: number };

const palette = [
  "#fff7e7",
  "#e7e0ff",
  "#c9eff2",
  "#f2d8e4",
  "#f3dfbf",
].map((color) => new THREE.Color(color));
const white = new THREE.Color("#ffffff");
const zero = new THREE.Vector2(0, 0);

function seededStars(count: number, seedStart: number, special = false): StarData {
  let seed = seedStart;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const base = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const depths = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const glows = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const radius = special ? 18 + rand() * 16 : 18 + rand() * 53;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const depth = special ? 0.92 : 1 - (radius - 18) / 53;
    const color = palette[Math.floor(rand() * palette.length)].clone();
    color.lerp(white, 0.28 + rand() * 0.48);
    base.set([x, y, z], i * 3);
    positions.set([x, y, z], i * 3);
    sizes[i] = special
      ? 0.8 + rand() * 0.8
      : 0.42 + depth * 1.45 + rand() * 0.85;
    depths[i] = depth;
    phases[i] = rand() * Math.PI * 2;
    speeds[i] = 0.28 + depth * 0.72 + rand() * 0.22;
    colors.set([color.r, color.g, color.b], i * 3);
    glows[i] = special ? 0.88 : 0.55 + rand() * 0.25;
  }
  return { base, positions, sizes, depths, phases, speeds, colors, glows };
}

function updateSceneStarMood(progress: number, tint: THREE.Color, mood: StarMood) {
  const disco =
    smooth((progress - 0.18) / 0.04) *
    (1 - smooth((progress - 0.41) / 0.07));
  const farewell =
    smooth((progress - 0.386) / 0.04) *
    (1 - smooth((progress - 0.54) / 0.08));
  const promises =
    smooth((progress - 0.54) / 0.04) *
    (1 - smooth((progress - 0.67) / 0.05));
  const dawn = smooth((progress - 0.825) / 0.08);
  const goodbye = smooth((progress - 0.963) / 0.03);
  tint.set("#d9ddff");
  if (progress < 0.18) tint.set("#d8e8ff");
  else if (disco > 0.1) tint.set("#e3c4f4");
  else if (farewell > 0.1) tint.set("#e9c9d2");
  else if (promises > 0.1) tint.set("#f2cce2");
  else if (dawn > 0.1) tint.set("#efc2a8");
  else if (goodbye > 0.1) tint.set("#d6d8ee");
  mood.disco = disco;
  mood.promises = promises;
  mood.goodbye = goodbye;
  mood.energy = Math.max(
    0.22,
    0.76 + disco * 0.42 + promises * 0.2 - farewell * 0.18 - dawn * 0.35 - goodbye * 0.45,
  );
}

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
  const { camera, size } = useThree();
  const mobile = size.width < 700;
  const field = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);
  const specialPoints = useRef<THREE.Points>(null);
  const connections = useRef<THREE.LineSegments>(null);
  const connectionMaterial = useRef<THREE.LineBasicMaterial>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const rippleMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const cursorTarget = useRef(new THREE.Vector2(0, 0));
  const cursor = useRef(new THREE.Vector2(0, 0));
  const cursorActive = useRef(false);
  const clock = useRef(0);
  const fieldEuler = useMemo(() => new THREE.Euler(), []);
  const fieldMatrix = useMemo(() => new THREE.Matrix4(), []);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const local = useMemo(() => new THREE.Vector3(), []);
  const specialProjected = useMemo(
    () => Array.from({ length: mobile ? 6 : 12 }, () => new THREE.Vector3()),
    [mobile],
  );
  const sceneTint = useMemo(() => new THREE.Color(), []);
  const mood = useMemo<StarMood>(
    () => ({ disco: 0, promises: 0, goodbye: 0, energy: 0.76 }),
    [],
  );
  const candidates = useMemo<Candidate[]>(() => [], []);
  const { data, special } = useMemo(() => {
    const stars = seededStars(count, 19);
    return {
      data: stars,
      special: {
        ...seededStars(mobile ? 6 : 12, 97, true),
        count: mobile ? 6 : 12,
      },
    };
  }, [count, mobile]);
  const linePositions = useMemo(
    () => new Float32Array(Math.max(1, (special.count - 1) * 2 * 3)),
    [special.count],
  );
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.8 },
      uSize: { value: 1 },
      uTintStrength: { value: 0.2 },
      uDistantFade: { value: 0 },
      uSceneTint: { value: new THREE.Color("#d9ddff") },
    }),
    [],
  );
  const specialUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.8 },
      uSize: { value: 1 },
      uTintStrength: { value: 0.2 },
      uDistantFade: { value: 0 },
      uSceneTint: { value: new THREE.Color("#d9ddff") },
    }),
    [],
  );

  useEffect(() => {
    const setPointer = (clientX: number, clientY: number) => {
      cursorTarget.current.set(
        (clientX / Math.max(1, window.innerWidth)) * 2 - 1,
        1 - (clientY / Math.max(1, window.innerHeight)) * 2,
      );
      cursorActive.current = true;
    };
    const onPointerMove = (event: PointerEvent) =>
      setPointer(event.clientX, event.clientY);
    const onPointerDown = (event: PointerEvent) =>
      setPointer(event.clientX, event.clientY);
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") cursorActive.current = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setPointer(touch.clientX, touch.clientY);
    };
    const clearPointer = () => {
      cursorActive.current = false;
      cursorTarget.current.set(0, 0);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", clearPointer, { passive: true });
    window.addEventListener("blur", clearPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", clearPointer);
      window.removeEventListener("blur", clearPointer);
    };
  }, []);

  useFrame((_, delta) => {
    if (!field.current || !points.current || paused) return;
    const p = progress.current;
    updateSceneStarMood(p, sceneTint, mood);
    const motion = reduced ? 0.16 : 1;
    const interactionStrength = reduced ? 0.16 : 1;
    const target = cursorActive.current ? cursorTarget.current : zero;
    cursor.current.lerp(target, 1 - Math.exp(-delta * (reduced ? 3 : 7)));
    clock.current += delta * (reduced ? 0.28 : 1);
    const time = clock.current;
    const interactionRadius = mobile ? 0.34 : 0.44;
    const ticketBoost =
      p < 0.2 ? 1 + (1 - smooth((p - 0.065) / 0.135)) * 0.32 : 1;
    const parallax = mobile ? 0.58 : 1;
    const cursorX = cursor.current.x;
    const cursorY = cursor.current.y;

    fieldEuler.set(
      cursorY * 0.018 * parallax * interactionStrength,
      p * 0.6 + cursorX * 0.032 * parallax * interactionStrength,
      0,
    );
    fieldMatrix.makeRotationFromEuler(fieldEuler);
    field.current.rotation.copy(fieldEuler);

    const positionAttribute = points.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const glowAttribute = points.current.geometry.getAttribute(
      "aGlow",
    ) as THREE.BufferAttribute;
    const currentPositions = positionAttribute.array as Float32Array;
    const currentGlows = glowAttribute.array as Float32Array;
    for (let i = 0; i < count; i += 1) {
      const offset = i * 3;
      const depth = data.depths[i];
      const phase = data.phases[i];
      const drift = motion * (0.018 + depth * 0.032);
      const driftX = Math.sin(time * data.speeds[i] + phase) * drift;
      const driftY = Math.cos(time * data.speeds[i] * 0.83 + phase) * drift;
      const baseX = data.base[offset] + driftX;
      const baseY = data.base[offset + 1] + driftY;
      const baseZ = data.base[offset + 2];
      local.set(baseX, baseY, baseZ).applyMatrix4(fieldMatrix);
      projected.copy(local).project(camera);
      const visible = projected.z > -1 && projected.z < 1;
      const distance = Math.hypot(projected.x - cursorX, projected.y - cursorY);
      const nearby = visible ? 1 - smooth(distance / interactionRadius) : 0;
      const response =
        nearby *
        (0.2 + depth * 0.85) *
        mood.energy *
        ticketBoost *
        parallax *
        interactionStrength;
      const polarity = Math.sin(phase * 1.7 + time * 0.22) > 0 ? -1 : 1;
      const rippleOffset =
        Math.sin(time * 1.35 - distance * 17 + phase) * response * 0.05;
      currentPositions[offset] =
        baseX +
        cursorX * (0.012 + depth * 0.058) * mood.energy * parallax +
        (projected.x - cursorX) * response * 0.2 * polarity;
      currentPositions[offset + 1] =
        baseY +
        cursorY * (0.01 + depth * 0.045) * mood.energy * parallax +
        (projected.y - cursorY) * response * 0.16 * polarity;
      currentPositions[offset + 2] = baseZ + rippleOffset;
      currentGlows[i] = Math.min(
        1.8,
        0.56 +
          Math.sin(time * (0.42 + depth * 0.3) + phase) * 0.12 +
          nearby * (0.46 + depth * 0.48) * interactionStrength,
      );
    }
    positionAttribute.needsUpdate = true;
    glowAttribute.needsUpdate = true;

    const endingFade = 1 - smooth((p - 0.958) / 0.042);
    const tintStrength = Math.min(
      0.48,
      0.19 + mood.disco * 0.13 + mood.promises * 0.08 + smooth((p - 0.825) / 0.08) * 0.08,
    );
    uniforms.uTime.value = time;
    uniforms.uOpacity.value =
      (0.62 + mood.energy * 0.2) * (0.2 + endingFade * 0.8);
    uniforms.uSize.value =
      (1 + Math.sin(smooth((p - 0.54) / 0.13) * Math.PI) * 0.5) *
      (mobile ? 0.9 : 1);
    uniforms.uTintStrength.value = tintStrength;
    uniforms.uDistantFade.value = mood.goodbye;
    uniforms.uSceneTint.value.copy(sceneTint);

    const specialPositionAttribute = specialPoints.current?.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute | undefined;
    const specialGlowAttribute = specialPoints.current?.geometry.getAttribute(
      "aGlow",
    ) as THREE.BufferAttribute | undefined;
    const specialCurrentPositions = specialPositionAttribute?.array as
      | Float32Array
      | undefined;
    const specialCurrentGlows = specialGlowAttribute?.array as
      | Float32Array
      | undefined;
    candidates.length = 0;
    if (specialCurrentPositions && specialCurrentGlows) {
      for (let i = 0; i < special.count; i += 1) {
        const offset = i * 3;
        const phase = special.phases[i];
        const drift = motion * 0.025;
        const baseX =
          special.base[offset] +
          Math.sin(time * special.speeds[i] + phase) * drift;
        const baseY =
          special.base[offset + 1] +
          Math.cos(time * special.speeds[i] + phase) * drift;
        const baseZ = special.base[offset + 2];
        local.set(baseX, baseY, baseZ).applyMatrix4(fieldMatrix);
        projected.copy(local).project(camera);
        specialProjected[i].copy(projected);
        const distance = Math.hypot(projected.x - cursorX, projected.y - cursorY);
        const influence =
          cursorActive.current && projected.z > -1 && projected.z < 1
            ? 1 - smooth(distance / (interactionRadius * 1.15))
            : 0;
        const response = influence * mood.energy * interactionStrength;
        specialCurrentPositions[offset] =
          baseX + cursorX * 0.07 * parallax + (projected.x - cursorX) * response * 0.25;
        specialCurrentPositions[offset + 1] =
          baseY + cursorY * 0.055 * parallax + (projected.y - cursorY) * response * 0.2;
        specialCurrentPositions[offset + 2] =
          baseZ + Math.sin(time * 1.2 + phase) * response * 0.08;
        specialCurrentGlows[i] = Math.min(
          2.2,
          0.9 + Math.sin(time * 0.55 + phase) * 0.14 + influence * 1.15,
        );
        if (influence > 0.18)
          candidates.push({ index: i, distance, influence });
      }
      specialPositionAttribute.needsUpdate = true;
      specialGlowAttribute.needsUpdate = true;
    }
    specialUniforms.uTime.value = time;
    specialUniforms.uOpacity.value =
      (0.58 + mood.energy * 0.3) * (0.25 + endingFade * 0.75);
    specialUniforms.uSize.value = mobile ? 0.95 : 1.15;
    specialUniforms.uTintStrength.value = Math.min(0.56, tintStrength + 0.12);
    specialUniforms.uDistantFade.value = mood.goodbye;
    specialUniforms.uSceneTint.value.copy(sceneTint);

    candidates.sort((a, b) => b.influence - a.influence);
    const anchor = candidates[0];
    let segmentCount = 0;
    let anchorInfluence = 0;
    if (anchor && specialCurrentPositions) {
      anchorInfluence = anchor.influence;
      for (const candidate of candidates.slice(1)) {
        if (
          segmentCount >= 3 ||
          Math.hypot(
            specialProjected[anchor.index].x - specialProjected[candidate.index].x,
            specialProjected[anchor.index].y - specialProjected[candidate.index].y,
          ) > 0.62
        )
          continue;
        const anchorOffset = anchor.index * 3;
        const candidateOffset = candidate.index * 3;
        const lineOffset = segmentCount * 6;
        linePositions.set(
          [
            specialCurrentPositions[anchorOffset],
            specialCurrentPositions[anchorOffset + 1],
            specialCurrentPositions[anchorOffset + 2],
            specialCurrentPositions[candidateOffset],
            specialCurrentPositions[candidateOffset + 1],
            specialCurrentPositions[candidateOffset + 2],
          ],
          lineOffset,
        );
        segmentCount += 1;
      }
    }
    if (connections.current) {
      const lineAttribute = connections.current.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      lineAttribute.needsUpdate = true;
      connections.current.geometry.setDrawRange(0, segmentCount * 2);
      connections.current.visible = segmentCount > 0 && !reduced;
    }
    if (connectionMaterial.current) {
      connectionMaterial.current.color.copy(sceneTint).lerp(white, 0.5);
      connectionMaterial.current.opacity = Math.min(
        0.32,
        anchorInfluence * 0.26 * (1 - mood.goodbye * 0.7),
      );
    }
    if (ripple.current && rippleMaterial.current) {
      if (anchor && specialCurrentPositions) {
        const offset = anchor.index * 3;
        ripple.current.visible = !reduced;
        ripple.current.position.set(
          specialCurrentPositions[offset],
          specialCurrentPositions[offset + 1],
          specialCurrentPositions[offset + 2],
        );
        ripple.current.scale.setScalar(0.55 + (1 - anchorInfluence) * 0.35);
        rippleMaterial.current.opacity = anchorInfluence * 0.18;
      } else {
        ripple.current.visible = false;
      }
    }
  });

  return (
    <group ref={field}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
          <bufferAttribute attach="attributes-aDepth" args={[data.depths, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
          <bufferAttribute attach="attributes-aGlow" args={[data.glows, 1]} />
          <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
          vertexShader={starVertexShader}
          fragmentShader={starFragmentShader}
          toneMapped={false}
        />
      </points>
      <points ref={specialPoints}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[special.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[special.sizes, 1]} />
          <bufferAttribute attach="attributes-aDepth" args={[special.depths, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[special.phases, 1]} />
          <bufferAttribute attach="attributes-aGlow" args={[special.glows, 1]} />
          <bufferAttribute attach="attributes-color" args={[special.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={specialUniforms}
          transparent
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
          vertexShader={starVertexShader}
          fragmentShader={starFragmentShader}
          toneMapped={false}
        />
      </points>
      <lineSegments ref={connections} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={connectionMaterial}
          color="#e7ddff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
      <mesh ref={ripple} visible={false}>
        <ringGeometry args={[0.11, 0.14, 24]} />
        <meshBasicMaterial
          ref={rippleMaterial}
          color="#f1dcff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
