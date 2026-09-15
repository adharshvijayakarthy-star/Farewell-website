import type { SceneId } from "./sceneConfig";
export interface VideoAsset {
  scene: SceneId;
  src: string;
  duration: number;
  usage: "background" | "transition";
  scrub: boolean;
  loop: boolean;
  preload: "none" | "metadata" | "auto";
}
/** This build uses Blender GLB assets and real-time 3D; expensive rendered footage = 0 seconds.
 * Future optional clips belong here. Combined duration must stay <= 40 seconds. */
export const videoConfig: VideoAsset[] = [];
export function validateVideoBudget(assets = videoConfig) {
  return assets.reduce((sum, a) => sum + a.duration, 0) <= 40;
}
