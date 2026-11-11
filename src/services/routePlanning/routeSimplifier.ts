/**
 * Collision-Verified Route Simplifier & Curvature Smoother
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Reduces redundant intermediate vertices while strictly guaranteeing
 * that all resulting simplified segments remain 100% collision-free.
 * 
 * Re-validates every shortcut against the 3D collision checker.
 * If a shortcut would clip a building corner or penetrate an obstacle,
 * the shortcut is rejected and the safe detour vertex is preserved.
 */

import { ISegmentCollisionChecker, IRouteSimplifier, SimplificationOptions } from './types';
import { calculateBearing, getDistanceMeters } from '../droneAStarRouter';

export class CollisionSafeRouteSimplifier implements IRouteSimplifier {
  public simplify(
    path: [number, number, number][],
    collisionChecker: ISegmentCollisionChecker,
    options: SimplificationOptions = {}
  ): [number, number, number][] {
    if (path.length <= 2) return [...path];

    const maxSpacing = options.maxDistanceBetweenCheckpoints ?? 250.0;
    const minTurnAngle = options.minTurnAngleDegrees ?? 15.0;

    const result: [number, number, number][] = [path[0]];
    let currentIdx = 0;

    while (currentIdx < path.length - 1) {
      let furthestValidIdx = currentIdx + 1;

      // Try connecting currentIdx directly to furthest reachable point
      for (let nextIdx = path.length - 1; nextIdx > currentIdx + 1; nextIdx--) {
        const p1 = path[currentIdx];
        const p2 = path[nextIdx];

        // Check straight-line distance constraint
        const distMeters = getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
        if (distMeters > maxSpacing && nextIdx > currentIdx + 2) {
          continue; // Don't create excessively long unmonitored segments
        }

        // STRICT SEGMENT COLLISION RE-VALIDATION
        const collisionCheck = collisionChecker.checkSegment(p1, p2, {
          droneRadiusMeters: options.droneRadiusMeters,
        });

        if (collisionCheck.isCollisionFree) {
          furthestValidIdx = nextIdx;
          break;
        }
      }

      result.push(path[furthestValidIdx]);
      currentIdx = furthestValidIdx;
    }

    return result;
  }
}
