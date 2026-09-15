import { audioConfig, AUDIO_SETTLE_MS } from "./audioConfig";
import type { AudioConfig, SceneAudioConfig } from "./audioTypes";
import type { SceneId } from "../scene/sceneConfig";
import { AudioMemory } from "./audioState";
import {
  calculateLoopPosition,
  gain,
  getSceneStartPosition,
  validateAudioConfig,
} from "./audioUtils";
type Channel = {
  audio: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
  config: SceneAudioConfig;
  stop?: ReturnType<typeof setTimeout>;
  failed: boolean;
  cancelLoad?: () => void;
};

export class AudioManager {
  readonly memory = new AudioMemory();
  private context?: AudioContext;
  private master?: GainNode;
  private channels = new Map<SceneId, Channel>();
  private active?: SceneId;
  private unlocked = false;
  private paused = false;
  private volume = 1;
  private generation = 0;
  private timer?: ReturnType<typeof setInterval>;
  private pending?: ReturnType<typeof setTimeout>;
  private disabled = new Set<SceneId>();
  private listeners = new Set<() => void>();
  constructor(
    readonly config: AudioConfig = audioConfig,
    private settleMs = AUDIO_SETTLE_MS,
  ) {}
  get available() {
    return Object.values(this.config).some(
      (c) => c.enabled && !this.disabled.has(c.sceneId),
    );
  }
  get ready() {
    return this.unlocked;
  }
  get playing() {
    return (
      !this.paused &&
      [...this.channels.values()].some((c) => !c.audio.paused && !c.failed)
    );
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((l) => l());
  }
  private warn(message: string) {
    if (process.env.NODE_ENV === "development")
      console.warn("[Celestial audio]", message);
  }
  init() {
    for (const c of Object.values(this.config)) {
      const error = validateAudioConfig(c);
      if (error) {
        this.disabled.add(c.sceneId);
        this.warn(error);
      }
    }
  }
  async unlock() {
    this.init();
    if (!this.available) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      await this.context.resume();
      this.unlocked = true;
      this.paused = false;
      this.timer ??= setInterval(() => this.tick(), 30);
      this.emit();
      if (this.active) await this.play(this.active, ++this.generation);
    } catch {
      this.warn("Playback unavailable; the visual journey continues.");
    }
  }
  enterScene(id: SceneId) {
    if (this.active === id) return;
    this.active = id;
    clearTimeout(this.pending);
    const generation = ++this.generation;
    for (const [other, ch] of this.channels)
      if (!ch.audio.paused)
        this.memory.rememberScenePosition(other, ch.audio.currentTime);
    if (!this.unlocked || this.paused) return;
    this.pending = setTimeout(() => {
      if (generation !== this.generation) return;
      const next = this.config[id];
      let exitDuration = 0;
      for (const [other, ch] of this.channels) {
        if (other === id || ch.audio.paused) continue;
        const seconds =
          next.transitionStyle === "hard-cut"
            ? 0
            : next.transitionStyle === "short"
              ? 0.07
              : Math.min(ch.config.fadeOut, next.transitionDuration);
        exitDuration = Math.max(exitDuration, seconds);
        this.leaveScene(other, seconds);
      }
      const delay =
        next.transitionStyle === "crossfade" ? 0 : exitDuration * 1000;
      this.pending = setTimeout(() => {
        if (generation === this.generation && !this.paused)
          void this.play(id, generation);
      }, delay);
    }, this.settleMs);
  }
  leaveScene(id: SceneId, seconds = this.config[id].fadeOut) {
    const c = this.channels.get(id);
    if (!c) return;
    this.memory.rememberScenePosition(id, c.audio.currentTime);
    this.fade(c, 0, seconds);
    const stop = () => {
      c.audio.pause();
      this.memory.rememberScenePosition(id, c.audio.currentTime);
      this.emit();
    };
    if (seconds === 0) stop();
    else c.stop = setTimeout(stop, seconds * 1000);
  }
  private getChannel(id: SceneId) {
    const existing = this.channels.get(id);
    if (existing) return existing;
    const config = { ...this.config[id] };
    if (
      !config.enabled ||
      this.disabled.has(id) ||
      !this.context ||
      !this.master
    )
      return;
    const audio = new Audio();
    const mobile = matchMedia("(max-width: 700px)").matches;
    let file = mobile && config.mobileFile ? config.mobileFile : config.file;
    if (
      file.endsWith(".webm") &&
      !audio.canPlayType('audio/webm; codecs="opus"') &&
      config.fallbackFile
    )
      file = config.fallbackFile;
    audio.preload = config.preloadPriority;
    audio.src = file;
    const source = this.context.createMediaElementSource(audio),
      node = this.context.createGain();
    node.gain.value = 0;
    source.connect(node);
    node.connect(this.master);
    const c: Channel = { audio, source, gain: node, config, failed: false };
    this.channels.set(id, c);
    audio.addEventListener("error", () => {
      c.failed = true;
      this.disabled.add(id);
      audio.pause();
      this.warn("Unavailable asset for " + id);
      this.emit();
    });
    audio.addEventListener("ended", () => {
      if (this.active === id && !this.paused) {
        this.memory.looped.add(id);
        audio.currentTime = c.config.loopStart;
        void audio.play().catch(() => this.emit());
      }
    });
    return c;
  }
  private async play(id: SceneId, generation: number) {
    const channel = this.getChannel(id);
    if (!channel || channel.failed) return;
    clearTimeout(channel.stop);
    try {
      if (channel.audio.readyState < 1)
        await new Promise<void>((resolve, reject) => {
          const a = channel.audio;
          const cleanup = () => {
            clearTimeout(timeout);
            a.removeEventListener("loadedmetadata", done);
            a.removeEventListener("error", fail);
            channel.cancelLoad = undefined;
          };
          const done = () => {
            cleanup();
            resolve();
          };
          const fail = () => {
            cleanup();
            reject(new Error("Media unavailable"));
          };
          const timeout = setTimeout(fail, 8000);
          channel.cancelLoad = fail;
          a.addEventListener("loadedmetadata", done);
          a.addEventListener("error", fail);
        });
      if (generation !== this.generation || this.active !== id || this.paused)
        return;
      const c = channel.config;
      if (c.fullClip) {
        c.segmentStart = c.loopStart = 0;
        c.segmentEnd = c.loopEnd = channel.audio.duration;
      }
      if (
        !Number.isFinite(channel.audio.duration) ||
        channel.audio.duration + 0.05 < c.segmentEnd
      ) {
        channel.failed = true;
        this.disabled.add(id);
        this.warn("Invalid source duration for " + id);
        this.emit();
        return;
      }
      if (c.resumeMode === "restart") this.memory.reset(id);
      clearTimeout(channel.stop);
      channel.audio.currentTime = getSceneStartPosition(
        c,
        this.memory.positions.get(id),
      );
      await channel.audio.play();
      if (generation !== this.generation || this.active !== id || this.paused) {
        channel.audio.pause();
        return;
      }
      const mobile = matchMedia("(max-width: 700px)").matches;
      const seconds =
        c.transitionStyle === "hard-cut"
          ? 0
          : c.transitionStyle === "short"
            ? 0.09
            : Math.min(c.fadeIn, c.transitionDuration);
      this.fade(
        channel,
        gain(c.volume * (mobile ? (c.mobileVolumeAdjustment ?? 1) : 1)),
        seconds,
      );
      this.emit();
    } catch {
      this.warn("Audio could not start: " + id);
      this.emit();
    }
  }
  private fade(c: Channel, value: number, seconds: number) {
    clearTimeout(c.stop);
    const now = this.context?.currentTime ?? 0,
      p = c.gain.gain;
    if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(now);
    else {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
    }
    p.linearRampToValueAtTime(value, now + seconds);
  }
  private tick() {
    for (const [id, ch] of this.channels) {
      if (ch.audio.paused) continue;
      const t = ch.audio.currentTime,
        next = calculateLoopPosition(t, ch.config, this.memory.looped.has(id));
      if (next !== t) {
        ch.audio.currentTime = next;
        this.memory.looped.add(id);
      }
      this.memory.rememberScenePosition(id, ch.audio.currentTime);
    }
  }
  pause() {
    this.paused = true;
    this.generation++;
    clearTimeout(this.pending);
    for (const [id, c] of this.channels) {
      clearTimeout(c.stop);
      this.memory.rememberScenePosition(id, c.audio.currentTime);
      c.audio.pause();
    }
    this.emit();
  }
  resume() {
    this.paused = false;
    if (this.unlocked && this.active) {
      void this.context?.resume();
      void this.play(this.active, ++this.generation);
    } else void this.unlock();
  }
  setMasterVolume(value: number) {
    this.volume = gain(value);
    this.master?.gain.setTargetAtTime(
      this.volume,
      this.context?.currentTime ?? 0,
      0.04,
    );
  }
  seekScene(id: SceneId, time: number) {
    const c = this.channels.get(id)?.config ?? this.config[id];
    const t = Math.max(c.segmentStart, Math.min(c.segmentEnd - 0.001, time));
    this.memory.rememberScenePosition(id, t);
    const channel = this.channels.get(id);
    if (channel) channel.audio.currentTime = t;
  }
  getScenePosition(id: SceneId) {
    return (
      this.memory.positions.get(id) ?? getSceneStartPosition(this.config[id])
    );
  }
  resetScenePosition(id: SceneId) {
    this.memory.reset(id);
    const c = this.channels.get(id);
    if (c) c.audio.currentTime = getSceneStartPosition(c.config);
  }
  destroy() {
    this.generation++;
    clearTimeout(this.pending);
    clearInterval(this.timer);
    this.timer = undefined;
    for (const c of this.channels.values()) {
      clearTimeout(c.stop);
      c.cancelLoad?.();
      c.audio.pause();
      c.audio.removeAttribute("src");
      c.audio.load();
      c.source.disconnect();
      c.gain.disconnect();
    }
    this.channels.clear();
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.unlocked = false;
  }
}
