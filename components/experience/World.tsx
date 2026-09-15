import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import CameraRig from "./CameraRig";
import LightRibbons from "./LightRibbons";
import TypographyParticles from "./TypographyParticles";
import TransitionParticles from "./TransitionParticles";
import MemoryUniverse from "./MemoryUniverse";
import PerformanceStats from "./PerformanceStats";
import Atmosphere, { FinalStar } from "./Atmosphere";
import StarField from "./StarField";
import DiscoEnvironment from "./DiscoEnvironment";
import Ballroom from "./Ballroom";
import ConstellationSystem from "./ConstellationSystem";
import CelestialBook from "./CelestialBook";
import DawnEnvironment from "./DawnEnvironment";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { smooth } from "@/lib/scene/sceneTimeline";
export default function World({
  progress,
  reduced,
  paused,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
}) {
  const { gl, scene, setDpr } = useThree();
  const { mobile, tier, particles, dpr } = useDeviceCapability();
  const root = useRef<THREE.Group>(null),
    pink = useRef<THREE.PointLight>(null),
    cyan = useRef<THREE.PointLight>(null);
  const [loadLater, setLoadLater] = useState(false);
  const colors = useMemo(
    () => ({
      pink: new THREE.Color("#ff49c7"),
      gold: new THREE.Color("#ffc499"),
    }),
    [],
  );
  useEffect(() => {
    const room = new RoomEnvironment();
    room.traverse((node) => {
      if (node instanceof THREE.PointLight) node.intensity = 45;
      if (node instanceof THREE.Mesh) {
        const m = node.material as THREE.MeshStandardMaterial;
        if (m instanceof THREE.MeshLambertMaterial && m.emissiveIntensity) {
          m.emissive.set(
            node.position.x < 0
              ? "#f032c1"
              : node.position.z > 0
                ? "#679bff"
                : "#27d4de",
          );
          m.emissiveIntensity *= 0.13;
        } else if (m.color) m.color.set("#18162d");
      }
    });
    const pmrem = new THREE.PMREMGenerator(gl);
    const environment = pmrem.fromScene(room, 0.015);
    scene.environment = environment.texture;
    scene.environmentIntensity = 1.5;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    setDpr(dpr);
  }, [dpr, setDpr]);
  useFrame(() => {
    const p = progress.current;
    if (p > 0.08 && !loadLater) setLoadLater(true);
    if (root.current) {
      const end = 1 - smooth((p - 0.956) / 0.037);
      root.current.scale.setScalar(Math.max(0.00001, end));
      root.current.visible = end > 0.0001;
    }
    if (pink.current) {
      pink.current.intensity = mobile ? 55 : 95;
      pink.current.color
        .copy(colors.pink)
        .lerp(colors.gold, smooth((p - 0.83) / 0.1));
    }
    if (cyan.current) cyan.current.intensity = mobile ? 40 : 80;
  });
  return (
    <>
      <CameraRig progress={progress} reduced={reduced} paused={paused} />
      <Atmosphere progress={progress} reduced={reduced} paused={paused} />
      <StarField
        progress={progress}
        count={reduced ? Math.min(particles, 650) : particles}
        reduced={reduced}
        paused={paused}
      />
      <ambientLight intensity={0.23} color="#aaaadd" />
      <pointLight
        ref={pink}
        position={[-5, 5, 8]}
        color="#ff49c7"
        intensity={95}
        distance={50}
      />
      <pointLight
        ref={cyan}
        position={[7, 3, 5]}
        color="#50cfff"
        intensity={80}
        distance={45}
      />
      <pointLight
        position={[0, 7, -7]}
        color="#ad88ff"
        intensity={100}
        distance={40}
      />
      <directionalLight position={[0, 4, 10]} color="#fff1d4" intensity={0.6} />
      <group ref={root}>
        {loadLater && (
          <>
            <DiscoEnvironment
              progress={progress}
              reduced={reduced}
              paused={paused}
              mobile={mobile}
            />
            <LightRibbons
              progress={progress}
              reduced={reduced}
              paused={paused}
            />
            <MemoryUniverse progress={progress} />
            <Ballroom progress={progress} mobile={mobile} />
            <ConstellationSystem
              progress={progress}
              reduced={reduced}
              paused={paused}
              count={tier === "LOW" ? 400 : 1000}
            />
            <CelestialBook progress={progress} />
            <DawnEnvironment progress={progress} />
          </>
        )}
      </group>
      <TypographyParticles progress={progress} reduced={reduced} />
      <TransitionParticles
        progress={progress}
        reduced={reduced}
        count={mobile ? 500 : 1300}
      />
      <FinalStar progress={progress} />
      {process.env.NODE_ENV === "development" && <PerformanceStats />}
    </>
  );
}
