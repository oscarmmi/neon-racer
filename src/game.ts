export const LANE_COUNT = 3

export type Rectangle = {
  x: number
  y: number
  width: number
  height: number
}

/** Clamp a lane change so the driver can never leave the three-lane road. */
export function clampLane(lane: number): number {
  return Math.max(0, Math.min(LANE_COUNT - 1, Math.trunc(lane)))
}

/** Axis-aligned collision test used by the game loop. */
export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Add the distance covered during this frame, ignoring invalid negative time or speed. */
export function advanceDistance(distance: number, deltaSeconds: number, metersPerSecond: number): number {
  return distance + Math.max(0, deltaSeconds) * Math.max(0, metersPerSecond)
}

/** The displayed score is the whole number of meters covered. */
export function scoreFromDistance(distance: number): number {
  return Math.floor(Math.max(0, distance))
}
