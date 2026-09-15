import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
/** Only mounted by development presentation mode. Counts actual rendered frames. */
export default function PerformanceStats() {
  const frames = useRef(0),
    time = useRef(0);
  useFrame(({ gl }, delta) => {
    frames.current++;
    time.current += delta;
    if (time.current > 1) {
      const output = document.getElementById("render-stats");
      if (output)
        output.textContent = `${Math.round(frames.current / time.current)} FPS · ${gl.info.render.calls} draw calls · ${gl.info.memory.geometries} geometries`;
      frames.current = 0;
      time.current = 0;
    }
  });
  return null;
}
