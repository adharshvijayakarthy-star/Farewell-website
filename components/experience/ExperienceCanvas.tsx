"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, useEffect, type ReactNode, type RefObject } from "react";
import World from "./World";
class Boundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function ContextGuard({ onError }: { onError: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onError);
    return () => canvas.removeEventListener("webglcontextlost", onError);
  }, [gl, onError]);
  return null;
}
export default function ExperienceCanvas({
  progress,
  reduced,
  paused,
  onError,
}: {
  progress: RefObject<number>;
  reduced: boolean;
  paused: boolean;
  onError: () => void;
}) {
  return (
    <Boundary onError={onError}>
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.5]}
        camera={{ position: [0, 1, 13], fov: 48, near: 0.1, far: 180 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <ContextGuard onError={onError} />
        <World progress={progress} reduced={reduced} paused={paused} />
      </Canvas>
    </Boundary>
  );
}
