# Farewell-website

# DISCO TILL DAWN — ✦ CELESTIAL ELEGANCE ✦

A scroll-controlled farewell invitation for the graduating class of 2026. Next.js, strict TypeScript, React, Three.js / React Three Fiber, and original Blender assets. No backend, sign-in, RSVP, countdown, or commercial music.

## Run

Node.js 22+ recommended. `npm install`, `npm run dev`. For release: `npm run lint`, `npm test`, `npm run build`, then `npm start`. The production site is the static `out/` directory and can run on any static HTTPS host. Preview and production caches are separate. Assets use root-relative URLs.

## Editing

- `lib/scene/sceneConfig.ts`: ten scene IDs, normalized boundaries, camera positions, mobile framing, atmosphere and asset associations.
- `lib/scene/sceneTimeline.ts`: deterministic progress, easing and native-scroll length. No scroll hijacking or event queues.
- `lib/scene/invitationCopy.ts`: authoritative text, punctuation and emojis.
- `components/ui/SceneCopy.tsx`: readable HTML typography beats.
- `components/experience/`: independently maintained environments, camera, mirrored hero assets, star field, book, dawn, and ticket.
- `lib/audio/audioConfig.ts`: **the only file needed to add music**. See `public/audio/README.md`.
- `lib/scene/videoConfig.ts`: optional future clips and a 40-second total duration validator. This build uses **0 seconds of pre-rendered video**. All camera travel remains interactive.

## Original assets

`scripts/create_assets.py` generates the sculpted flower and individual mirror-tile sphere. Run with Blender 5.2: `blender -b --python scripts/create_assets.py`. GLB files are consumed by the site. Blender sources are retained in `assets/blender/`; no third-party art or reference-site assets are used. Procedural substitutes survive model-loading failures.

## Presentation and accessibility

In development only, open `/?present=1` for restart, scene selection, animation pause/resume, and statistics. Production strips the controls. All meaningful text is HTML. The ticket is a native keyboard-operable button. Reduced motion disables ticket zoom and ambient rotation and stabilizes the camera. WebGL failure renders the full static invitation. Initial scroll restoration is disabled; reload starts at the ticket. Mobile uses different camera distances, particle budgets, lighting and object density.

The experience is deliberately silent until supplied tracks are enabled. Do not add track filenames to any visual component.
