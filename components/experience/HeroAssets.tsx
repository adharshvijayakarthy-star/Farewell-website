import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
/** Fetch only once mounted near the relevant sequence. Procedural shape remains on load failure. */
export function HeroAsset({
  file,
  fallback,
}: {
  file: string;
  fallback: React.ReactNode;
}) {
  const [object, setObject] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Group | undefined;
    const dispose = (group: THREE.Group) =>
      group.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          n.geometry.dispose();
          const materials = Array.isArray(n.material)
            ? n.material
            : [n.material];
          materials.forEach((m) => m.dispose());
        }
      });
    new GLTFLoader().load(
      file,
      (gltf) => {
        loaded = gltf.scene;
        if (cancelled) {
          dispose(loaded);
          return;
        }
        setObject(loaded);
      },
      undefined,
      () => {},
    );
    return () => {
      cancelled = true;
      if (loaded) dispose(loaded);
    };
  }, [file]);
  return object ? <primitive object={object} /> : fallback;
}
