import { test } from "node:test";
import assert from "node:assert/strict";
import { audioConfig } from "../lib/audio/audioConfig";
import { AudioManager } from "../lib/audio/audioManager";
import { AudioMemory } from "../lib/audio/audioState";
import {
  calculateLoopPosition,
  getSceneStartPosition,
  validateAudioConfig,
} from "../lib/audio/audioUtils";
import { sceneAt, localProgress } from "../lib/scene/sceneTimeline";
import { scenes } from "../lib/scene/sceneConfig";
import { validateVideoBudget } from "../lib/scene/videoConfig";
const config = {
  ...audioConfig.scene02,
  enabled: true,
  file: "/audio/test-only.wav",
  segmentStart: 48,
  segmentEnd: 72,
  loopStart: 55,
  loopEnd: 68,
};
test("first visit begins at the selected excerpt, revisit remembers fractional time", () => {
  assert.equal(getSceneStartPosition(config), 48);
  assert.equal(getSceneStartPosition(config, 61.37), 61.37);
  assert.equal(
    getSceneStartPosition({ ...config, resumeMode: "restart" }, 61.37),
    48,
  );
});
test("entry phrase plays to segmentEnd, later loops use independent loopEnd", () => {
  assert.equal(calculateLoopPosition(70, config), 70);
  assert.equal(calculateLoopPosition(72, config), 55);
  assert.equal(calculateLoopPosition(68, config, true), 55);
  assert.equal(calculateLoopPosition(94.25, config, true), 55.25);
});
test("multiple scenes retain independent positions and loop state", () => {
  const m = new AudioMemory();
  m.rememberScenePosition("scene02", 61.37);
  m.rememberScenePosition("scene03", 13.22);
  m.looped.add("scene02");
  assert.equal(m.positions.get("scene02"), 61.37);
  m.reset("scene03");
  assert.equal(m.positions.get("scene02"), 61.37);
  assert.equal(m.positions.has("scene03"), false);
  assert.equal(m.looped.has("scene02"), true);
});
test("invalid audio entries are rejected without disabling visual progress", () => {
  for (const c of [
    { ...config, file: "" },
    { ...config, segmentStart: 72 },
    { ...config, loopStart: 47 },
    { ...config, loopEnd: 73 },
    { ...config, fadeIn: -1 },
    { ...config, segmentEnd: NaN },
    { ...config, volume: 2 },
  ])
    assert.ok(validateAudioConfig(c));
  assert.equal(validateAudioConfig(config), null);
  assert.equal(
    validateAudioConfig({ ...config, enabled: false, file: "" }),
    null,
  );
});
test("silent production defaults never instantiate or fetch media", () => {
  const manager = new AudioManager();
  manager.init();
  for (const id of Object.keys(audioConfig) as (keyof typeof audioConfig)[]) {
    assert.equal(audioConfig[id].enabled, false);
    assert.equal(audioConfig[id].file, "");
    manager.enterScene(id);
  }
  assert.equal(manager.available, false);
  manager.destroy();
});
test("fast and reverse scroll resolve directly to the destination scene", () => {
  assert.equal(sceneAt(0.95).id, "scene08");
  assert.equal(sceneAt(0.21).id, "scene02");
  assert.equal(sceneAt(1).id, "scene09");
  scenes.forEach((s, i) => {
    assert.equal(localProgress(s.startProgress, i), 0);
    assert.equal(localProgress(s.endProgress, i), 1);
    if (i > 0) assert.equal(s.startProgress, scenes[i - 1].endProgress);
  });
  assert.ok(validateVideoBudget());
});

class FakeParam {
  value = 0;
  cancelAndHoldAtTime() {}
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
}
class FakeGain {
  gain = new FakeParam();
  connect() {}
  disconnect() {}
}
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  createGain() {
    return new FakeGain();
  }
  createMediaElementSource() {
    return { connect() {}, disconnect() {} };
  }
  async resume() {}
  async close() {}
}
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  duration = 200;
  readyState = 4;
  paused = true;
  src = "";
  preload = "";
  constructor() {
    super();
    FakeAudio.instances.push(this);
  }
  async play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute() {
    this.src = "";
  }
  canPlayType() {
    return "probably";
  }
}
test("manager crossfades, cancels stale exits, loops and remembers reverse navigation", async () => {
  Object.assign(globalThis, {
    Audio: FakeAudio,
    AudioContext: FakeAudioContext,
    matchMedia: () => ({ matches: false }),
  });
  const cfg = structuredClone(audioConfig);
  cfg.scene02 = {
    ...config,
    fadeIn: 0,
    fadeOut: 0.02,
    transitionDuration: 0.02,
  };
  cfg.scene03 = {
    ...cfg.scene03,
    enabled: true,
    file: "/audio/test-only-2.wav",
    segmentStart: 0,
    segmentEnd: 30,
    loopStart: 4,
    loopEnd: 30,
    fadeIn: 0,
    fadeOut: 0.02,
    transitionDuration: 0.02,
  };
  const m = new AudioManager(cfg);
  await m.unlock();
  m.enterScene("scene02");
  await new Promise((r) => setTimeout(r, 5));
  const first = FakeAudio.instances.at(-1)!;
  assert.equal(first.currentTime, 48);
  first.currentTime = 61.37;
  m.enterScene("scene03");
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(first.paused, true);
  assert.equal(m.getScenePosition("scene02"), 61.37);
  m.enterScene("scene02");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(first.currentTime, 61.37);
  assert.equal(first.paused, false);
  first.currentTime = 72.1;
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(Math.abs(first.currentTime - 55.1) < 0.001);
  m.enterScene("scene03");
  m.enterScene("scene02");
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(first.paused, false);
  m.pause();
  assert.equal(first.paused, true);
  m.resume();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(first.paused, false);
  m.destroy();
  assert.equal(first.paused, true);
});
