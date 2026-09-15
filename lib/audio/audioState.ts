import type { SceneId } from "../scene/sceneConfig";
export class AudioMemory {
  positions = new Map<SceneId, number>();
  looped = new Set<SceneId>();
  rememberScenePosition(id: SceneId, time: number) {
    if (Number.isFinite(time)) this.positions.set(id, time);
  }
  reset(id: SceneId) {
    this.positions.delete(id);
    this.looped.delete(id);
  }
}
