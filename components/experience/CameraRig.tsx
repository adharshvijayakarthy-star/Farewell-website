import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import * as THREE from "three";
import { scenes } from "@/lib/scene/sceneConfig";
import { clamp, smooth, localProgress } from "@/lib/scene/sceneTimeline";
export default function CameraRig({
  progress,
  reduced,
  paused,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
}) {
  const { size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const discoPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          [4, 1, 12],
          [0, -1, 9],
          [-3, 0, 5],
          [-7, 3, 9],
          [0, 5, 14],
          [3, 7, 18],
          [0, 4, 21],
          [0, 3, 19],
        ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
      ),
    [],
  );
  useFrame(({ camera, pointer }, delta) => {
    if (paused) return;
    const p = progress.current,
      mobile = size.width < 700;
    let i = scenes.findIndex((s) => p < s.endProgress);
    if (i < 0) i = 9;
    const scene = scenes[i],
      next = scenes[Math.min(9, i + 1)];
    const t = smooth(localProgress(p, i));
    const from = mobile ? scene.mobileCamera : scene.camera,
      to = mobile ? next.mobileCamera : next.camera;
    position.set(...from).lerp(new THREE.Vector3(...to), t);
    if (i === 2 && !reduced) {
      discoPath.getPointAt(clamp(t), position);
      if (mobile) {
        position.x *= 0.35;
        position.z *= 1.35;
      }
    }
    if (reduced) {
      position.x *= 0.1;
      position.y = 2;
      position.z = mobile ? 24 : 20;
    }
    if (p > 0.955) {
      position.z = THREE.MathUtils.lerp(
        mobile ? 22 : 18,
        70,
        smooth((p - 0.955) / 0.04),
      );
      position.x = 0;
      position.y = 2;
    }
    if (!reduced) {
      position.x += pointer.x * (mobile ? 0.04 : 0.32);
      position.y += pointer.y * 0.16;
    }
    camera.position.lerp(position, 1 - Math.exp(-delta * (reduced ? 3 : 7)));
    target.set(0, 1, 0);
    camera.lookAt(target);
  });
  return null;
}
