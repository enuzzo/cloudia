import { clamp01, remap01 } from "../core/easing";

export type Handedness = "Left" | "Right" | "Unknown";
export type Point2 = readonly [number, number];

export interface GestureState {
  handPresence: number;
  primaryX: number;
  primaryY: number;
  openness: number;
  compression: number;
  leftHandClosed: boolean;
  stormIntent: number;
}

const TIP_INDICES = [4, 8, 12, 16, 20] as const;
const PALM_INDICES = [0, 5, 9, 13, 17] as const;

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function average(points: readonly Point2[]): Point2 {
  const sum = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]] as Point2,
    [0, 0] as Point2,
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

export function mapHandLandmarks(
  landmarks: readonly Point2[],
  handedness: Handedness,
): GestureState {
  if (landmarks.length < 21) {
    return {
      handPresence: 0,
      primaryX: 0.5,
      primaryY: 0.5,
      openness: 0,
      compression: 0,
      leftHandClosed: false,
      stormIntent: 0,
    };
  }

  const palm = average(PALM_INDICES.map((index) => landmarks[index]));
  const wrist = landmarks[0];
  const palmScale = Math.max(0.001, distance(wrist, landmarks[9]));
  const tipDistance =
    TIP_INDICES.reduce((total, index) => total + distance(landmarks[index], palm), 0) /
    TIP_INDICES.length;
  const openness = remap01(tipDistance / palmScale, 0.7, 2.15);
  const compression = clamp01(1 - openness);
  const leftHandClosed = handedness === "Left" && compression > 0.62;

  return {
    handPresence: 1,
    primaryX: clamp01(palm[0]),
    primaryY: clamp01(palm[1]),
    openness,
    compression,
    leftHandClosed,
    stormIntent: leftHandClosed ? compression : 0,
  };
}
