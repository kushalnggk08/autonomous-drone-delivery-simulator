import { euclideanDistance } from './routeFollowing';
import { DroneState, Point2D, RouteValidationResult, Waypoint } from './types';

/**
 * Calculates heading angle in degrees [-180, 180] from point A to point B.
 */
export function calculateHeadingDeg(from: Point2D, to: Point2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return 0;
  }
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export interface StepPositionOutcome {
  drone: DroneState;
  reachedRouteEnd: boolean;
  waypointsPassed: string[];
}

/**
 * Advances the virtual drone deterministically along the ordered route segments
 * for a given time step `dtSec` and `speedMultiplier`.
 */
export function stepDronePosition(
  currentDrone: DroneState,
  route: RouteValidationResult,
  waypoints: Waypoint[],
  baseCruiseSpeed: number,
  speedMultiplier: number,
  dtSec: number
): StepPositionOutcome {
  const nodes = route.orderedNodes;
  if (nodes.length < 2 || dtSec <= 0 || speedMultiplier <= 0) {
    return {
      drone: currentDrone,
      reachedRouteEnd: false,
      waypointsPassed: [],
    };
  }

  let segIdx = currentDrone.currentSegmentIndex;
  let distOnSeg = currentDrone.distanceAlongCurrentSegment;
  let totalTravelled = currentDrone.totalDistanceTravelled;
  let pos: Point2D = { ...currentDrone.position };
  let headingDeg = currentDrone.headingDeg;
  const waypointsPassed: string[] = [];

  // Determine commanded airspeed for the active leg
  const activeWaypoint =
    segIdx < waypoints.length ? waypoints[segIdx] : undefined;
  const nominalSpeed = activeWaypoint?.targetSpeed ?? baseCruiseSpeed;
  const effectiveSpeed = nominalSpeed * speedMultiplier;

  let remainingStepDistance = effectiveSpeed * dtSec;
  let reachedRouteEnd = false;

  while (remainingStepDistance > 0 && segIdx < nodes.length - 1) {
    const segStart = nodes[segIdx];
    const segEnd = nodes[segIdx + 1];
    const segLength =
      route.segmentLengths[segIdx] ?? euclideanDistance(segStart, segEnd);
    const remainingOnSegment = Math.max(0, segLength - distOnSeg);

    headingDeg = calculateHeadingDeg(segStart, segEnd);

    if (remainingStepDistance < remainingOnSegment) {
      distOnSeg += remainingStepDistance;
      totalTravelled += remainingStepDistance;
      remainingStepDistance = 0;

      const ratio = segLength > 0 ? distOnSeg / segLength : 1;
      pos = {
        x: segStart.x + (segEnd.x - segStart.x) * ratio,
        y: segStart.y + (segEnd.y - segStart.y) * ratio,
      };
    } else {
      // Finish this segment and transition to the next waypoint
      totalTravelled += remainingOnSegment;
      remainingStepDistance -= remainingOnSegment;
      pos = { x: segEnd.x, y: segEnd.y };

      const reachedLabel = route.nodeLabels[segIdx + 1] ?? `NODE-${segIdx + 1}`;
      waypointsPassed.push(reachedLabel);

      if (segIdx + 1 >= nodes.length - 1) {
        // Reached the final node of the route
        distOnSeg = segLength;
        reachedRouteEnd = true;
        remainingStepDistance = 0;
        break;
      } else {
        segIdx += 1;
        distOnSeg = 0;
      }
    }
  }

  const rad = (headingDeg * Math.PI) / 180;
  const velocity: Point2D = reachedRouteEnd
    ? { x: 0, y: 0 }
    : {
        x: Math.cos(rad) * nominalSpeed,
        y: Math.sin(rad) * nominalSpeed,
      };

  // Append to breadcrumb trail if moved at least 4 simulated meters from last trail point
  const lastTrailPoint = currentDrone.trail[currentDrone.trail.length - 1];
  const shouldRecordTrail =
    !lastTrailPoint ||
    euclideanDistance(lastTrailPoint, pos) >= 4 ||
    reachedRouteEnd;

  const updatedTrail = shouldRecordTrail
    ? [...currentDrone.trail.slice(-240), { x: pos.x, y: pos.y }]
    : currentDrone.trail;

  return {
    drone: {
      position: pos,
      velocity,
      speed: reachedRouteEnd ? 0 : nominalSpeed,
      headingDeg,
      currentSegmentIndex: segIdx,
      distanceAlongCurrentSegment: distOnSeg,
      totalDistanceTravelled: Math.min(totalTravelled, route.totalDistance),
      trail: updatedTrail,
    },
    reachedRouteEnd,
    waypointsPassed,
  };
}
