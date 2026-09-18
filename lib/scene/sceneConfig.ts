export const sceneIds = [
  "scene00",
  "scene01",
  "scene02",
  "scene03",
  "scene04",
  "scene05",
  "scene06",
  "scene07",
  "scene08",
  "scene09",
] as const;
export type SceneId = (typeof sceneIds)[number];
export type Vec3 = [number, number, number];
export interface SceneConfig {
  id: SceneId;
  label: string;
  startProgress: number;
  endProgress: number;
  explorationSeconds: number;
  camera: Vec3;
  mobileCamera: Vec3;
  target: Vec3;
  environment: { color: string; energy: number };
  textState: string;
  animationState: string;
  audioId: SceneId;
  assets: string[];
  transition: { duration: number; ease: "smoothstep" };
}
const boundaries = [
  0, 0.065, 0.18, 0.34, 0.41, 0.54, 0.67, 0.77, 0.855, 0.955, 1,
];
const labels = [
  "Ticket",
  "Awakening",
  "Disco explosion",
  "Beneath the stars",
  "Farewell",
  "Three promises",
  "Event details",
  "Final page",
  "Until dawn",
  "Goodbye",
];
const cameras: Vec3[] = [
  [0, 1, 13],
  [0, 2, 16],
  [4, 1, 12],
  [0, 3, 19],
  [-1, 2, 20],
  [0, 4, 16],
  [0, 1, 15],
  [0, 3, 13],
  [0, 2, 18],
  [0, 5, 48],
];
// Reading/camera pacing weights, informed by the prepared clips but independent of playback.
const explorationSeconds = [16, 19, 29, 16, 34, 29, 21, 33, 28, 24];
// Several visual scenes intentionally share one musical chapter. This keeps
// the visual story intact while locking playback to the final six-song order.
const audioChapters: SceneId[] = [
  "scene00", // Song0: automatic Troll opening
  "scene01", // Song1: ticket and early experience
  "scene02", // Song2: original Song2 window
  "scene02", // Song2: absorbs the original Song3 window
  "scene05", // Song5: replaces the original Song4 chapter
  "scene05", // Song5: continues to the original Song6 start point
  "scene06", // Song6: original Song6 start
  "scene06", // Song6: absorbs the original Song7 window
  "scene06", // Song6: continues through the old Song8 endpoint
  "scene09", // Song9: final farewell
];
export const scenes: SceneConfig[] = sceneIds.map((id, i) => ({
  id,
  label: labels[i],
  startProgress: boundaries[i],
  endProgress: boundaries[i + 1],
  explorationSeconds: explorationSeconds[i],
  camera: cameras[i],
  mobileCamera: [cameras[i][0] * 0.35, cameras[i][1], cameras[i][2] * 1.25],
  target: [0, 1, 0],
  environment: {
    color: [
      "#06091b",
      "#17103a",
      "#320b45",
      "#151d45",
      "#17172e",
      "#43144b",
      "#132941",
      "#171229",
      "#70404e",
      "#040610",
    ][i],
    energy: [0.1, 0.35, 1, 0.3, 0.15, 0.9, 0.3, 0.15, 0.25, 0.05][i],
  },
  textState: id,
  animationState: id,
  audioId: audioChapters[i],
  assets: i === 2 || i === 3 ? ["/models/celestial-flower.glb"] : [],
  transition: { duration: 0.14, ease: "smoothstep" },
}));
