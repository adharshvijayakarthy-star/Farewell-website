# Adding music

The supplied clips are enabled for the production sequence:

`Song0, Song1, Song2, Song5, Song6, Song9`

Song3, Song4, Song7, and Song8 are intentionally not played. Song2 absorbs the
old Song3 visual window; Song5 replaces the old Song4 chapter; Song6 continues
through the old Song8 visual endpoint, which is used only as a timeline
boundary. The MP3 files are used exactly as supplied.

1. Put licensed audio in this folder. Use descriptive filenames. WebM/Opus is preferred; MP3 is widely supported. WAV works for development but is large.
2. Edit **only `lib/audio/audioConfig.ts`**. Each `audioConfig.sceneXX` entry can override the shared defaults. Set `enabled: true` and a public URL such as `/audio/your-file.webm`. Optional `fallbackFile` can point to MP3. No scene component needs changing.
3. Set the excerpt and loop positions in absolute seconds in the original source.

`segmentStart` is the first playback position. `segmentEnd` ends the first entry phrase. After that, `loopStart` through `loopEnd` repeats for as long as the scene remains active. For example, segment 48–72 and loop 55–68 plays 48–72 once, then 55–68 repeatedly. This can retain an entry and exit phrase around a loop body. A scene transition fades immediately; it never delays the visual story waiting for an exit phrase.

`startOffset` is added to the first position only. `resumeMode: 'remember'` saves the current position, including fractional seconds and loop state, whenever the visitor leaves. Scrolling backward resumes there. `'restart'` starts at the configured first position every visit. A reload resets memory.

`volume` is linear gain 0–1. `mobileVolumeAdjustment` multiplies it on narrow screens. `mobileFile` optionally replaces the source. All gains also multiply master volume. `fadeIn` and `fadeOut` are seconds; `transitionDuration` caps them. `'crossfade'` ramps the two channels; `'hard-cut'` changes immediately. `bpm` and `beatOffset` are optional metadata for future beat alignment, never visual drivers. `preloadPriority` controls the browser's media preload hint when a scene first requests its track.

Song0 attempts autoplay when the Troll mounts. If the browser blocks it, the first legitimate page gesture (pointer/touch/key/click) unlocks the AudioContext and starts the pending active track. Song1 begins at the Troll→ticket morph handoff (scene state), not on the main ticket click. Music pauses when the page is hidden; the music control can resume it. Invalid configuration disables only that track. Unavailable files fail gracefully. Disabled entries never instantiate media or request empty URLs. Production has no music control when nothing is enabled.

All source timing is isolated from camera and text timing. `npm test` exercises loop calculation, position memory, disabled defaults, rapid transitions, and reverse navigation with in-memory fake media. No fake audio assets ship.

API: `init`, `unlock`, `enterScene`, `leaveScene`, `pause`, `resume`, `setMasterVolume`, `seekScene`, `getScenePosition`, `resetScenePosition`, `destroy`. `lib/audio/audioTypes.ts` documents every field.
