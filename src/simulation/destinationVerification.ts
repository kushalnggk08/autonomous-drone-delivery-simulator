import { euclideanDistance } from './routeFollowing';
import {
  DestinationVerificationResult,
  DestinationZone,
  Point2D,
} from './types';

/**
 * Verifies whether the drone's current simulated coordinates lie within the
 * configured destination delivery area radius before permitting payload release.
 */
export function verifyDestinationArrival(
  dronePosition: Point2D,
  destination: DestinationZone,
  simTimeSec: number
): DestinationVerificationResult {
  const targetCenter: Point2D = { x: destination.x, y: destination.y };
  const measuredErrorDistance = euclideanDistance(dronePosition, targetCenter);
  const allowedRadius = destination.radius;

  // Use small epsilon (1e-4) for floating-point boundary consistency
  const verified = measuredErrorDistance <= allowedRadius + 1e-4;

  const reason = verified
    ? `Target lock verified: Drone at (${dronePosition.x.toFixed(
        1
      )}, ${dronePosition.y.toFixed(
        1
      )}) is ${measuredErrorDistance.toFixed(
        1
      )}m from center (within ${allowedRadius.toFixed(1)}m delivery zone).`
    : `Verification failed: Drone stopped at (${dronePosition.x.toFixed(
        1
      )}, ${dronePosition.y.toFixed(
        1
      )}), which is ${measuredErrorDistance.toFixed(
        1
      )}m from center (exceeds ${allowedRadius.toFixed(1)}m delivery radius).`;

  return {
    attempted: true,
    verified,
    dronePosition: { ...dronePosition },
    targetCenter,
    measuredErrorDistance,
    allowedRadius,
    timestampSimSec: simTimeSec,
    reason,
  };
}
