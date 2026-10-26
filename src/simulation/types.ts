export interface Point2D {
  x: number;
  y: number;
}

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
  targetSpeed: number; // simulated m/s
}

export interface DestinationZone {
  x: number;
  y: number;
  radius: number; // acceptance radius in simulated meters
  label: string;
  /**
   * Optional simulated terminal navigation offset (drift) in meters.
   * When (0, 0), the drone's final leg aims directly at (x, y).
   * When non-zero, simulates a terminal coordinate mismatch or calibration offset
   * to test destination verification failure.
   */
  terminalOffsetX: number;
  terminalOffsetY: number;
}

export interface NoFlyZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MissionPhase =
  | 'IDLE'
  | 'IN_FLIGHT'
  | 'PAUSED'
  | 'VERIFYING_DESTINATION'
  | 'RELEASING_PAYLOAD'
  | 'COMPLETED_SUCCESS'
  | 'COMPLETED_FAILURE'
  | 'INVALID_ROUTE';

export type DeliveryStatus =
  | 'STANDBY'
  | 'IN_TRANSIT'
  | 'VERIFYING_ZONE'
  | 'RELEASING'
  | 'DELIVERY_SUCCESS'
  | 'DELIVERY_FAILED'
  | 'ROUTE_INVALID';

export interface RouteValidationIssue {
  code:
    | 'NO_WAYPOINTS'
    | 'OUT_OF_BOUNDS'
    | 'ZERO_LENGTH_SEGMENT'
    | 'NO_FLY_ZONE_INTERSECTION'
    | 'INVALID_RADIUS';
  message: string;
  segmentIndex?: number;
}

export interface RouteValidationResult {
  isValid: boolean;
  issues: RouteValidationIssue[];
  orderedNodes: Point2D[];
  nodeLabels: string[];
  segmentLengths: number[];
  totalDistance: number;
}

export interface DroneState {
  position: Point2D;
  velocity: Point2D;
  speed: number; // current speed in simulated m/s
  headingDeg: number; // 0 = East, 90 = South in 2D canvas coordinates
  currentSegmentIndex: number; // index of segment [node_i -> node_{i+1}]
  distanceAlongCurrentSegment: number;
  totalDistanceTravelled: number;
  trail: Point2D[];
}

export interface DestinationVerificationResult {
  attempted: boolean;
  verified: boolean;
  dronePosition: Point2D;
  targetCenter: Point2D;
  measuredErrorDistance: number;
  allowedRadius: number;
  timestampSimSec: number;
  reason: string;
}

export interface PayloadState {
  attached: boolean;
  releasing: boolean;
  released: boolean;
  releaseProgress: number; // 0 to 100
  dropPosition: Point2D | null;
  statusMessage: string;
}

export interface TelemetryLogEntry {
  id: string;
  simTimeSec: number;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  module: 'ROUTE' | 'KINEMATICS' | 'VERIFIER' | 'PAYLOAD';
  message: string;
}

export interface SimulationState {
  phase: MissionPhase;
  deliveryStatus: DeliveryStatus;
  simTimeSec: number;
  speedMultiplier: number; // e.g. 0.5x, 1x, 2x, 4x
  baseCruiseSpeed: number; // simulated m/s (default 65 m/s in canvas units)
  canvasBounds: { width: number; height: number };
  startPoint: Point2D;
  waypoints: Waypoint[];
  destination: DestinationZone;
  noFlyZones: NoFlyZone[];
  routeValidation: RouteValidationResult;
  drone: DroneState;
  verification: DestinationVerificationResult | null;
  payload: PayloadState;
  completionPercentage: number;
  logs: TelemetryLogEntry[];
}

export interface MissionPreset {
  id: string;
  name: string;
  description: string;
  startPoint: Point2D;
  waypoints: Waypoint[];
  destination: DestinationZone;
  noFlyZones: NoFlyZone[];
}
