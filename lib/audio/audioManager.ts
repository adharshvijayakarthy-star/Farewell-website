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

type Crossfade = {
  seconds: number;
  outgoing: SceneId[];
};

const NORMAL_CROSSFADE_SECONDS = 0.65;
const MAJOR_CROSSFADE_SECONDS = 1.1;
const MAJOR_CROSSFADE_TRANSITIONS = new Set([
  "scene00->scene01",
  "scene01->scene02",
  "scene02->scene05",
  "scene06->scene09",
]);

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
  private gestureCleanup?: () => void;

  private attachGestureUnlock() {
    if (this.gestureCleanup || typeof window === "undefined") return;
    const unlockHandler = () => {
      void this.unlock().then(() => {
        if (this.unlocked && this.gestureCleanup) {
          this.gestureCleanup();
          this.gestureCleanup = undefined;
        }
      });
    };
    const opts = { passive: true, capture: true };
    window.addEventListener("pointerdown", unlockHandler, opts);
    window.addEventListener("touchstart", unlockHandler, opts);
    window.addEventListener("keydown", unlockHandler, opts);
    this.gestureCleanup = () => {
      window.removeEventListener("pointerdown", unlockHandler, opts);
      window.removeEventListener("touchstart", unlockHandler, opts);
      window.removeEventListener("keydown", unlockHandler, opts);
    };
  }

  async unlock() {
    this.init();
    if (!this.available) return;
    try {
      if (!this.context) {
        const AudioCtx =
          (typeof window !== "undefined" &&
            (window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext)) ||
          globalThis.AudioContext;
        this.context = new AudioCtx();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      const isRunning =
        !this.context.state || this.context.state === "running";
      this.unlocked = isRunning;
      this.paused = false;
      if (isRunning) {
        this.timer ??= setInterval(() => this.tick(), 30);
        if (this.gestureCleanup) {
          this.gestureCleanup();
          this.gestureCleanup = undefined;
        }
      }
      this.emit();
      // Now attempt to play the active scene (Song0 during Troll).
      if (this.active) {
        const channel = this.channels.get(this.active);
        if (!channel || channel.audio.paused)
          await this.play(this.active, ++this.generation);
      }
    } catch {
      this.warn("Playback unavailable; the visual journey continues.");
    }

    // If still blocked by browser autoplay policy, arm gesture unlock on first user action
    if (!this.unlocked && typeof window !== "undefined") {
      this.attachGestureUnlock();
    }
  }
  enterScene(id: SceneId) {
    if (this.active === id) return;
    const previous = this.active;
    this.active = id;
    clearTimeout(this.pending);
    const generation = ++this.generation;
    for (const [other, ch] of this.channels)
      if (!ch.audio.paused)
        this.memory.rememberScenePosition(other, ch.audio.currentTime);
    if (!this.unlocked || this.paused) return;
    this.pending = setTimeout(() => {
      if (generation !== this.generation) return;
      const outgoing = [...this.channels.entries()]
        .filter(([other, ch]) => other !== id && !ch.audio.paused && !ch.failed)
        .map(([other]) => other);
      void this.play(id, generation, {
        seconds: this.crossfadeDuration(previous, id),
        outgoing,
      });
    }, this.settleMs);
  }

  private crossfadeDuration(previous: SceneId | undefined, next: SceneId) {
    if (!previous) return 0;
    return MAJOR_CROSSFADE_TRANSITIONS.has(`${previous}->${next}`)
      ? MAJOR_CROSSFADE_SECONDS
      : NORMAL_CROSSFADE_SECONDS;
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
    audio.autoplay = !this.unlocked && id === "scene00";
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
  private async play(id: SceneId, generation: number, crossfade?: Crossfade) {
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
      if (crossfade) this.setGain(channel, 0);
      await channel.audio.play();
      if (generation !== this.generation || this.active !== id || this.paused) {
        channel.audio.pause();
        return;
      }
      const mobile = matchMedia("(max-width: 700px)").matches;
      const seconds = crossfade
        ? crossfade.seconds
        : c.transitionStyle === "hard-cut"
          ? 0
          : c.transitionStyle === "short"
            ? 0.09
            : Math.min(c.fadeIn, c.transitionDuration);
      if (crossfade) {
        for (const outgoing of crossfade.outgoing)
          this.leaveScene(outgoing, crossfade.seconds);
      }
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
    if (seconds <= 0) p.setValueAtTime(value, now);
    else p.linearRampToValueAtTime(value, now + seconds);
  }
  private setGain(c: Channel, value: number) {
    const now = this.context?.currentTime ?? 0,
      p = c.gain.gain;
    if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(now);
    else p.cancelScheduledValues(now);
    p.setValueAtTime(value, now);
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
    if (this.gestureCleanup) {
      this.gestureCleanup();
      this.gestureCleanup = undefined;
    }
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
