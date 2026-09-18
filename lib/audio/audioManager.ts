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

const DEBUG =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function isAutoplayBlock(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "NotAllowedError";
}

export class AudioManager {
  readonly memory = new AudioMemory();
  private context?: AudioContext;
  private master?: GainNode;
  private channels = new Map<SceneId, Channel>();
  private preloaders = new Map<SceneId, HTMLAudioElement>();
  private active?: SceneId;
  private unlocked = false;
  private paused = false;
  private autoplayBlocked = false;
  private volume = 1;
  private generation = 0;
  private timer?: ReturnType<typeof setInterval>;
  private pending?: ReturnType<typeof setTimeout>;
  private disabled = new Set<SceneId>();
  private listeners = new Set<() => void>();
  private gestureCleanup?: () => void;
  private unlocking?: Promise<void>;

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

  get activeScene() {
    return this.active;
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

  private log(message: string, detail?: unknown) {
    if (!DEBUG) return;
    if (detail !== undefined) console.info("[Celestial audio]", message, detail);
    else console.info("[Celestial audio]", message);
  }

  private warn(message: string) {
    if (DEBUG) console.warn("[Celestial audio]", message);
  }

  init() {
    for (const c of Object.values(this.config)) {
      const error = validateAudioConfig(c);
      if (error) {
        this.disabled.add(c.sceneId);
        this.warn(error);
      }
    }
    if (DEBUG) {
      for (const config of Object.values(this.config)) {
        if (!config.enabled) continue;
        this.log("audio URL check", {
          scene: config.sceneId,
          url: config.file,
          readyState: "pending",
          networkState: "pending",
        });
      }
    }
    // Song0 must be ready as soon as the Troll mounts.
    this.preload("scene00");
  }

  /** Warm a track without requiring AudioContext / unlock. */
  preload(id: SceneId) {
    const config = this.config[id];
    if (
      !config?.enabled ||
      this.disabled.has(id) ||
      this.preloaders.has(id) ||
      this.channels.has(id) ||
      typeof Audio === "undefined"
    )
      return;
    const audio = new Audio();
    audio.preload = id === "scene00" ? "auto" : config.preloadPriority;
    audio.src = this.resolveFile(config, audio);
    const onLoaded = () => {
      if (DEBUG) {
        this.log("audio URL verified", {
          scene: id,
          url: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
        });
      }
      this.log("file loaded", { scene: id, src: audio.src });
    };
    const onError = () => {
      if (DEBUG) {
        this.warn(`Audio URL failed: ${audio.src}`);
      }
      this.warn("Preload failed for " + id);
    };
    audio.addEventListener("loadeddata", onLoaded, { once: true });
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.load();
    this.preloaders.set(id, audio);
    this.log("preload started", id);
  }

  private resolveFile(config: SceneAudioConfig, audio: HTMLAudioElement) {
    const mobile =
      typeof matchMedia === "function" &&
      matchMedia("(max-width: 700px)").matches;
    let file = mobile && config.mobileFile ? config.mobileFile : config.file;
    if (
      file.endsWith(".webm") &&
      !audio.canPlayType('audio/webm; codecs="opus"') &&
      config.fallbackFile
    )
      file = config.fallbackFile;
    return file;
  }

  private isActiveAudible() {
    if (!this.active || this.paused) return false;
    const channel = this.channels.get(this.active);
    return !!channel && !channel.failed && !channel.audio.paused;
  }

  private detachGestureUnlock() {
    if (!this.gestureCleanup) return;
    this.gestureCleanup();
    this.gestureCleanup = undefined;
  }

  private attachGestureUnlock() {
    if (this.gestureCleanup || typeof window === "undefined") return;
    const unlockHandler = () => {
      this.log("interaction unlock occurred");
      void this.unlock();
    };
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("pointerdown", unlockHandler, opts);
    window.addEventListener("touchstart", unlockHandler, opts);
    window.addEventListener("keydown", unlockHandler, opts);
    window.addEventListener("click", unlockHandler, opts);
    this.gestureCleanup = () => {
      window.removeEventListener("pointerdown", unlockHandler, opts);
      window.removeEventListener("touchstart", unlockHandler, opts);
      window.removeEventListener("keydown", unlockHandler, opts);
      window.removeEventListener("click", unlockHandler, opts);
    };
    this.log("gesture unlock armed");
  }

  private syncGestureUnlock() {
    if (this.isActiveAudible()) {
      this.autoplayBlocked = false;
      this.detachGestureUnlock();
      return;
    }
    // Keep listening until the active soundtrack actually plays.
    this.attachGestureUnlock();
  }

  async unlock() {
    if (this.unlocking) return this.unlocking;
    this.unlocking = this.performUnlock().finally(() => {
      this.unlocking = undefined;
    });
    return this.unlocking;
  }

  private async performUnlock() {
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
        this.log("AudioContext created", this.context.state);
      }
      if (this.context.state === "suspended") {
        await this.context.resume();
        this.log("AudioContext resume", this.context.state);
      }
      const isRunning =
        !this.context.state || this.context.state === "running";
      // Context may be running while media play() is still blocked.
      // Do NOT treat context-running as "playback unlocked" for gesture cleanup.
      this.unlocked = isRunning;
      this.paused = false;
      if (isRunning) this.timer ??= setInterval(() => this.tick(), 30);
      this.emit();

      if (this.active) {
        const channel = this.channels.get(this.active);
        if (!channel || channel.audio.paused || this.autoplayBlocked) {
          this.log("play attempted after unlock", this.active);
          await this.play(this.active, ++this.generation);
        }
      }
    } catch (error) {
      this.warn("Playback unavailable; the visual journey continues.");
      this.log("unlock failed", error);
    }

    this.syncGestureUnlock();
  }

  enterScene(id: SceneId) {
    if (this.active === id) {
      // Same scene: still recover if unlock succeeded but playback never started.
      if (
        this.unlocked &&
        !this.paused &&
        (!this.isActiveAudible() || this.autoplayBlocked)
      ) {
        this.log("scene changed (ensure playing)", id);
        void this.play(id, ++this.generation);
      }
      return;
    }

    const previous = this.active;
    this.active = id;
    this.log("scene changed", { from: previous, to: id });
    clearTimeout(this.pending);
    const generation = ++this.generation;

    for (const [other, ch] of this.channels)
      if (!ch.audio.paused)
        this.memory.rememberScenePosition(other, ch.audio.currentTime);

    // Progressive preload of upcoming chapters.
    this.preload(id);

    if (!this.unlocked || this.paused) {
      // Intent is remembered in `active`; unlock()/gesture will start it.
      this.syncGestureUnlock();
      return;
    }

    this.pending = setTimeout(() => {
      if (generation !== this.generation) return;
      const outgoing = [...this.channels.entries()]
        .filter(([other, ch]) => other !== id && !ch.audio.paused && !ch.failed)
        .map(([other]) => other);
      this.log("audio transition started", {
        to: id,
        outgoing,
        seconds: this.crossfadeDuration(previous, id),
      });
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

    const preloaded = this.preloaders.get(id);
    const audio = preloaded ?? new Audio();
    if (preloaded) this.preloaders.delete(id);

    const file = this.resolveFile(config, audio);
    if (!audio.src) {
      audio.preload = config.preloadPriority;
      audio.src = file;
    }
    // HTML autoplay attribute is unreliable with Web Audio routing; playback
    // is always driven explicitly via play() after unlock/gesture.

    const source = this.context.createMediaElementSource(audio);
    const node = this.context.createGain();
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
    audio.addEventListener("loadeddata", () => {
      this.log("file loaded", { scene: id, duration: audio.duration });
    });
    audio.addEventListener("ended", () => {
      if (this.active === id && !this.paused) {
        this.memory.looped.add(id);
        audio.currentTime = c.config.loopStart;
        void audio.play().catch((error) => {
          if (isAutoplayBlock(error)) {
            this.autoplayBlocked = true;
            this.syncGestureUnlock();
          }
          this.emit();
        });
      }
    });
    return c;
  }

  private async play(id: SceneId, generation: number, crossfade?: Crossfade) {
    const channel = this.getChannel(id);
    if (!channel || channel.failed) return;

    clearTimeout(channel.stop);
    this.log("play attempted", id);

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

      this.autoplayBlocked = false;
      this.log("play succeeded", id);

      const mobile =
        typeof matchMedia === "function" &&
        matchMedia("(max-width: 700px)").matches;
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

      if (crossfade) {
        const doneMs = Math.max(0, seconds) * 1000 + 20;
        setTimeout(() => {
          if (this.active === id)
            this.log("audio transition completed", { scene: id });
        }, doneMs);
      }

      this.syncGestureUnlock();
      this.emit();
    } catch (error) {
      if (isAutoplayBlock(error)) {
        this.autoplayBlocked = true;
        this.log("autoplay blocked", { scene: id, error });
        this.syncGestureUnlock();
      } else {
        this.warn("Audio could not start: " + id);
        this.log("play failed", { scene: id, error });
      }
      this.emit();
    }
  }

  private fade(c: Channel, value: number, seconds: number) {
    clearTimeout(c.stop);
    const now = this.context?.currentTime ?? 0;
    const p = c.gain.gain;
    if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(now);
    else {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
    }
    if (seconds <= 0) p.setValueAtTime(value, now);
    else p.linearRampToValueAtTime(value, now + seconds);
  }

  private setGain(c: Channel, value: number) {
    const now = this.context?.currentTime ?? 0;
    const p = c.gain.gain;
    if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(now);
    else p.cancelScheduledValues(now);
    p.setValueAtTime(value, now);
  }

  private tick() {
    for (const [id, ch] of this.channels) {
      if (ch.audio.paused) continue;
      const t = ch.audio.currentTime;
      const next = calculateLoopPosition(
        t,
        ch.config,
        this.memory.looped.has(id),
      );
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
    this.detachGestureUnlock();
    for (const audio of this.preloaders.values()) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    this.preloaders.clear();
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
    this.autoplayBlocked = false;
  }
}
