import {
  DestinationZone,
  NoFlyZone,
  Point2D,
  RouteValidationIssue,
  RouteValidationResult,
  Waypoint,
} from './types';

export function euclideanDistance(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Checks whether line segment AB intersects an axis-aligned rectangle (No-Fly Zone).
 */
export function segmentIntersectsRect(
  a: Point2D,
  b: Point2D,
  rect: NoFlyZone
): boolean {
  const minX = rect.x;
  const maxX = rect.x + rect.width;
  const minY = rect.y;
  const maxY = rect.y + rect.height;

  // Check if either endpoint is inside the rectangle
  if (
    (a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY) ||
    (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY)
  ) {
    return true;
  }

  // Liang-Barsky segment-box intersection algorithm
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - minX, maxX - a.x, a.y - minY, maxY - a.y];

  let u1 = 0;
  let u2 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0 && u1 < t) {
        u1 = t;
      } else if (p[i] > 0 && u2 > t) {
        u2 = t;
      }
    }
  }

  return u1 <= u2 && u1 <= 1 && u2 >= 0;
}

/**
 * Computes the terminal navigation target point based on the destination zone
 * and any configured terminal navigation offset.
 */
export function getTerminalTargetPoint(destination: DestinationZone): Point2D {
  return {
    x: destination.x + destination.terminalOffsetX,
    y: destination.y + destination.terminalOffsetY,
  };
}

/**
 * Validates the complete mission route from Start -> Waypoints -> Terminal Target
 * and computes segment distances and total route length.
 */
export function validateRoute(
  startPoint: Point2D,
  waypoints: Waypoint[],
  destination: DestinationZone,
  bounds: { width: number; height: number },
  noFlyZones: NoFlyZone[] = []
): RouteValidationResult {
  const issues: RouteValidationIssue[] = [];

  if (waypoints.length === 0) {
    issues.push({
      code: 'NO_WAYPOINTS',
      message:
        'Route invalid: At least 1 intermediate waypoint is required between Launch Pad and Destination.',
    });
  }

  if (destination.radius < 10 || destination.radius > 120) {
    issues.push({
      code: 'INVALID_RADIUS',
      message: `Destination acceptance radius (${destination.radius}m) must be between 10m and 120m.`,
    });
  }

  const terminalPoint = getTerminalTargetPoint(destination);
  const orderedNodes: Point2D[] = [
    { x: startPoint.x, y: startPoint.y },
    ...waypoints.map((wp) => ({ x: wp.x, y: wp.y })),
    terminalPoint,
  ];

  const nodeLabels: string[] = [
    'LAUNCH PAD',
    ...waypoints.map((wp, idx) => wp.name || `WP-${idx + 1}`),
    destination.label || 'DESTINATION',
  ];

  // Check bounds on all nodes
  orderedNodes.forEach((pt, idx) => {
    if (
      !Number.isFinite(pt.x) ||
      !Number.isFinite(pt.y) ||
      pt.x < 10 ||
      pt.x > bounds.width - 10 ||
      pt.y < 10 ||
      pt.y > bounds.height - 10
    ) {
      issues.push({
        code: 'OUT_OF_BOUNDS',
        message: `${nodeLabels[idx]} (${Math.round(pt.x)}, ${Math.round(
          pt.y
        )}) is outside safe simulation boundary [10..${bounds.width - 10}, 10..${
          bounds.height - 10
        }].`,
        segmentIndex: idx,
      });
    }
  });

  const segmentLengths: number[] = [];
  let totalDistance = 0;

  for (let i = 0; i < orderedNodes.length - 1; i++) {
    const from = orderedNodes[i];
    const to = orderedNodes[i + 1];
    const dist = euclideanDistance(from, to);
    segmentLengths.push(dist);
    totalDistance += dist;

    if (dist < 5) {
      issues.push({
        code: 'ZERO_LENGTH_SEGMENT',
        message: `Leg ${i + 1} (${nodeLabels[i]} -> ${
          nodeLabels[i + 1]
        }) is too short (${dist.toFixed(1)}m < 5.0m minimum).`,
        segmentIndex: i,
      });
    }

    for (const zone of noFlyZones) {
      if (segmentIntersectsRect(from, to, zone)) {
        issues.push({
          code: 'NO_FLY_ZONE_INTERSECTION',
          message: `Leg ${i + 1} (${nodeLabels[i]} -> ${
            nodeLabels[i + 1]
          }) intersects restricted zone "${zone.label}".`,
          segmentIndex: i,
        });
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    orderedNodes,
    nodeLabels,
    segmentLengths,
    totalDistance,
  };
}

/**
 * Returns the active target node label and index for telemetry display.
 */
export function getCurrentTargetLabel(
  routeValidation: RouteValidationResult,
  currentSegmentIndex: number
): { targetLabel: string; legNumber: number; totalLegs: number } {
  const totalLegs = Math.max(1, routeValidation.orderedNodes.length - 1);
  const clampedIndex = Math.min(
    Math.max(0, currentSegmentIndex),
    routeValidation.orderedNodes.length - 2
  );
  const targetLabel =
    routeValidation.nodeLabels[clampedIndex + 1] ?? 'DESTINATION';
  return {
    targetLabel,
    legNumber: clampedIndex + 1,
    totalLegs,
  };
}

/**
 * Calculates overall route completion percentage [0..100] from distance travelled.
 */
export function calculateRouteCompletionPercentage(
  totalDistanceTravelled: number,
  totalRouteDistance: number
): number {
  if (totalRouteDistance <= 0) return 0;
  const pct = (totalDistanceTravelled / totalRouteDistance) * 100;
  return Math.min(100, Math.max(0, pct));
}
