import { verifyDestinationArrival } from './destinationVerification';
import {
  createInitialPayloadState,
  initiatePayloadRelease,
  stepPayloadRelease,
} from './payloadRelease';
import { calculateHeadingDeg, stepDronePosition } from './positionUpdates';
import {
  calculateRouteCompletionPercentage,
  validateRoute,
} from './routeFollowing';
import {
  DestinationZone,
  MissionPreset,
  NoFlyZone,
  Point2D,
  SimulationState,
  TelemetryLogEntry,
  Waypoint,
} from './types';

export const DEFAULT_CANVAS_BOUNDS = { width: 1000, height: 620 };
export const DEFAULT_BASE_CRUISE_SPEED = 95; // simulated meters per second

export const SAMPLE_MISSION_PRESETS: MissionPreset[] = [
  {
    id: 'campus-nominal',
    name: 'Campus Medical Supply Corridor (Nominal)',
    description:
      'Default 3-waypoint autonomous corridor around restricted lab buildings with exact target zone alignment.',
    startPoint: { x: 110, y: 510 },
    waypoints: [
      { id: 'wp-1', name: 'WP-1', x: 260, y: 210, targetSpeed: 95 },
      { id: 'wp-2', name: 'WP-2', x: 540, y: 150, targetSpeed: 105 },
      { id: 'wp-3', name: 'WP-3', x: 740, y: 360, targetSpeed: 85 },
    ],
    destination: {
      x: 875,
      y: 175,
      radius: 42,
      label: 'DROP ZONE ALPHA',
      terminalOffsetX: 0,
      terminalOffsetY: 0,
    },
    noFlyZones: [
      {
        id: 'nfz-1',
        label: 'RF ANTENNA ARRAY',
        x: 340,
        y: 260,
        width: 150,
        height: 140,
      },
      {
        id: 'nfz-2',
        label: 'HIGH-VOLTAGE SUB',
        x: 600,
        y: 430,
        width: 170,
        height: 110,
      },
    ],
  },
  {
    id: 'destination-drift-fault',
    name: 'Terminal Offset Fault (Failed Destination Check)',
    description:
      'Simulates a +68m terminal coordinate drift so the drone stops outside the 38m delivery zone, triggering interlock failure.',
    startPoint: { x: 120, y: 490 },
    waypoints: [
      { id: 'wp-1', name: 'WP-1', x: 260, y: 190, targetSpeed: 100 },
      { id: 'wp-2', name: 'WP-2', x: 580, y: 170, targetSpeed: 95 },
    ],
    destination: {
      x: 840,
      y: 190,
      radius: 38,
      label: 'DROP ZONE BETA',
      terminalOffsetX: -58,
      terminalOffsetY: 42,
    },
    noFlyZones: [
      {
        id: 'nfz-1',
        label: 'RF ANTENNA ARRAY',
        x: 340,
        y: 240,
        width: 140,
        height: 130,
      },
    ],
  },
  {
    id: 'invalid-nofly-route',
    name: 'Restricted Airspace Conflict (Invalid Route)',
    description:
      'Demonstrates pre-flight route validation catching a flight leg intersecting a restricted no-fly zone.',
    startPoint: { x: 110, y: 500 },
    waypoints: [
      { id: 'wp-1', name: 'WP-1', x: 420, y: 310, targetSpeed: 90 },
      { id: 'wp-2', name: 'WP-2', x: 690, y: 240, targetSpeed: 90 },
    ],
    destination: {
      x: 870,
      y: 180,
      radius: 40,
      label: 'DROP ZONE GAMMA',
      terminalOffsetX: 0,
      terminalOffsetY: 0,
    },
    noFlyZones: [
      {
        id: 'nfz-1',
        label: 'RESTRICTED TOWER',
        x: 340,
        y: 250,
        width: 160,
        height: 140,
      },
    ],
  },
];

let logCounter = 1;
function createLog(
  simTimeSec: number,
  level: TelemetryLogEntry['level'],
  module: TelemetryLogEntry['module'],
  message: string
): TelemetryLogEntry {
  return {
    id: `log-${simTimeSec.toFixed(2)}-${logCounter++}`,
    simTimeSec,
    level,
    module,
    message,
  };
}

export function createInitialSimulationState(
  preset: MissionPreset = SAMPLE_MISSION_PRESETS[0],
  speedMultiplier = 1
): SimulationState {
  const startPoint: Point2D = { ...preset.startPoint };
  const waypoints: Waypoint[] = preset.waypoints.map((wp) => ({ ...wp }));
  const destination: DestinationZone = { ...preset.destination };
  const noFlyZones: NoFlyZone[] = preset.noFlyZones.map((z) => ({ ...z }));

  const routeValidation = validateRoute(
    startPoint,
    waypoints,
    destination,
    DEFAULT_CANVAS_BOUNDS,
    noFlyZones
  );

  const firstTarget =
    routeValidation.orderedNodes[1] ?? routeValidation.orderedNodes[0];
  const initialHeading = calculateHeadingDeg(startPoint, firstTarget);

  const initialLogs: TelemetryLogEntry[] = [
    createLog(
      0,
      routeValidation.isValid ? 'INFO' : 'WARNING',
      'ROUTE',
      routeValidation.isValid
        ? `Mission "${preset.name}" initialized (${waypoints.length} waypoints, ${routeValidation.totalDistance.toFixed(1)}m total simulated distance).`
        : `Route validation warning: ${routeValidation.issues[0]?.message}`
    ),
  ];

  return {
    phase: routeValidation.isValid ? 'IDLE' : 'INVALID_ROUTE',
    deliveryStatus: routeValidation.isValid ? 'STANDBY' : 'ROUTE_INVALID',
    simTimeSec: 0,
    speedMultiplier,
    baseCruiseSpeed: DEFAULT_BASE_CRUISE_SPEED,
    canvasBounds: { ...DEFAULT_CANVAS_BOUNDS },
    startPoint,
    waypoints,
    destination,
    noFlyZones,
    routeValidation,
    drone: {
      position: { ...startPoint },
      velocity: { x: 0, y: 0 },
      speed: 0,
      headingDeg: initialHeading,
      currentSegmentIndex: 0,
      distanceAlongCurrentSegment: 0,
      totalDistanceTravelled: 0,
      trail: [{ ...startPoint }],
    },
    verification: null,
    payload: createInitialPayloadState(),
    completionPercentage: 0,
    logs: initialLogs,
  };
}

/**
 * Recomputes route validation and resets drone to start when mission geometry is edited.
 */
export function rebuildStateWithUpdatedGeometry(
  prevState: SimulationState,
  updates: {
    startPoint?: Point2D;
    waypoints?: Waypoint[];
    destination?: DestinationZone;
    noFlyZones?: NoFlyZone[];
  },
  logMessage?: string
): SimulationState {
  const startPoint = updates.startPoint
    ? { ...updates.startPoint }
    : { ...prevState.startPoint };
  const waypoints = updates.waypoints
    ? updates.waypoints.map((wp, idx) => ({
        ...wp,
        name: `WP-${idx + 1}`,
      }))
    : prevState.waypoints.map((wp, idx) => ({
        ...wp,
        name: `WP-${idx + 1}`,
      }));
  const destination = updates.destination
    ? { ...updates.destination }
    : { ...prevState.destination };
  const noFlyZones = updates.noFlyZones
    ? updates.noFlyZones.map((z) => ({ ...z }))
    : prevState.noFlyZones;

  const routeValidation = validateRoute(
    startPoint,
    waypoints,
    destination,
    prevState.canvasBounds,
    noFlyZones
  );

  const firstTarget =
    routeValidation.orderedNodes[1] ?? routeValidation.orderedNodes[0];
  const initialHeading = calculateHeadingDeg(startPoint, firstTarget);

  const nextLogs = [...prevState.logs];
  if (logMessage) {
    nextLogs.unshift(createLog(0, 'INFO', 'ROUTE', logMessage));
  }
  if (!routeValidation.isValid && routeValidation.issues[0]) {
    nextLogs.unshift(
      createLog(0, 'ERROR', 'ROUTE', routeValidation.issues[0].message)
    );
  }

  return {
    ...prevState,
    phase: routeValidation.isValid ? 'IDLE' : 'INVALID_ROUTE',
    deliveryStatus: routeValidation.isValid ? 'STANDBY' : 'ROUTE_INVALID',
    simTimeSec: 0,
    startPoint,
    waypoints,
    destination,
    noFlyZones,
    routeValidation,
    drone: {
      position: { ...startPoint },
      velocity: { x: 0, y: 0 },
      speed: 0,
      headingDeg: initialHeading,
      currentSegmentIndex: 0,
      distanceAlongCurrentSegment: 0,
      totalDistanceTravelled: 0,
      trail: [{ ...startPoint }],
    },
    verification: null,
    payload: createInitialPayloadState(),
    completionPercentage: 0,
    logs: nextLogs.slice(0, 40),
  };
}

/**
 * Starts or resumes the simulation if the route is valid.
 */
export function startOrResumeSimulation(
  state: SimulationState
): SimulationState {
  if (!state.routeValidation.isValid) {
    return {
      ...state,
      phase: 'INVALID_ROUTE',
      deliveryStatus: 'ROUTE_INVALID',
      logs: [
        createLog(
          state.simTimeSec,
          'ERROR',
          'ROUTE',
          `Cannot launch: ${
            state.routeValidation.issues[0]?.message ?? 'Invalid route'
          }`
        ),
        ...state.logs,
      ].slice(0, 40),
    };
  }

  if (
    state.phase === 'COMPLETED_SUCCESS' ||
    state.phase === 'COMPLETED_FAILURE'
  ) {
    // Restart from launch pad if already completed
    const resetState = rebuildStateWithUpdatedGeometry(state, {});
    return {
      ...resetState,
      phase: 'IN_FLIGHT',
      deliveryStatus: 'IN_TRANSIT',
      logs: [
        createLog(
          0,
          'INFO',
          'KINEMATICS',
          'Mission relaunched from Launch Pad. Autonomous navigation active.'
        ),
        ...resetState.logs,
      ].slice(0, 40),
    };
  }

  const isResuming = state.phase === 'PAUSED';
  return {
    ...state,
    phase: state.payload.releasing ? 'RELEASING_PAYLOAD' : 'IN_FLIGHT',
    deliveryStatus: state.payload.releasing ? 'RELEASING' : 'IN_TRANSIT',
    logs: [
      createLog(
        state.simTimeSec,
        'INFO',
        'KINEMATICS',
        isResuming
          ? 'Simulation resumed.'
          : 'Autonomous flight sequence initiated from Launch Pad.'
      ),
      ...state.logs,
    ].slice(0, 40),
  };
}

/**
 * Deterministic step function advancing the entire simulation by `realDtSec`.
 */
export function stepSimulation(
  state: SimulationState,
  realDtSec: number
): SimulationState {
  if (
    state.phase !== 'IN_FLIGHT' &&
    state.phase !== 'VERIFYING_DESTINATION' &&
    state.phase !== 'RELEASING_PAYLOAD'
  ) {
    return state;
  }

  const clampedRealDt = Math.min(Math.max(realDtSec, 0), 0.1);
  const simDt = clampedRealDt * state.speedMultiplier;
  const nextSimTime = state.simTimeSec + simDt;
  const newLogs: TelemetryLogEntry[] = [];

  // Phase 1: In-flight navigation along route segments
  if (state.phase === 'IN_FLIGHT') {
    const stepOutcome = stepDronePosition(
      state.drone,
      state.routeValidation,
      state.waypoints,
      state.baseCruiseSpeed,
      1, // simDt already multiplied by speedMultiplier
      simDt
    );

    for (const passedLabel of stepOutcome.waypointsPassed) {
      newLogs.unshift(
        createLog(
          nextSimTime,
          'INFO',
          'ROUTE',
          `Reached navigation node: ${passedLabel} at (${stepOutcome.drone.position.x.toFixed(
            1
          )}, ${stepOutcome.drone.position.y.toFixed(1)}).`
        )
      );
    }

    const completionPercentage = calculateRouteCompletionPercentage(
      stepOutcome.drone.totalDistanceTravelled,
      state.routeValidation.totalDistance
    );

    if (stepOutcome.reachedRouteEnd) {
      // Perform Destination Verification immediately upon reaching terminal coordinate
      const verification = verifyDestinationArrival(
        stepOutcome.drone.position,
        state.destination,
        nextSimTime
      );

      newLogs.unshift(
        createLog(
          nextSimTime,
          verification.verified ? 'SUCCESS' : 'ERROR',
          'VERIFIER',
          verification.reason
        )
      );

      const releaseAttempt = initiatePayloadRelease(
        state.payload,
        verification,
        stepOutcome.drone.position
      );

      newLogs.unshift(
        createLog(
          nextSimTime,
          releaseAttempt.allowed ? 'INFO' : 'ERROR',
          'PAYLOAD',
          releaseAttempt.logMessage
        )
      );

      if (releaseAttempt.allowed) {
        return {
          ...state,
          phase: 'RELEASING_PAYLOAD',
          deliveryStatus: 'RELEASING',
          simTimeSec: nextSimTime,
          drone: stepOutcome.drone,
          verification,
          payload: releaseAttempt.payload,
          completionPercentage: 100,
          logs: [...newLogs, ...state.logs].slice(0, 40),
        };
      } else {
        return {
          ...state,
          phase: 'COMPLETED_FAILURE',
          deliveryStatus: 'DELIVERY_FAILED',
          simTimeSec: nextSimTime,
          drone: stepOutcome.drone,
          verification,
          payload: releaseAttempt.payload,
          completionPercentage: 100,
          logs: [...newLogs, ...state.logs].slice(0, 40),
        };
      }
    }

    return {
      ...state,
      simTimeSec: nextSimTime,
      drone: stepOutcome.drone,
      completionPercentage,
      logs:
        newLogs.length > 0
          ? [...newLogs, ...state.logs].slice(0, 40)
          : state.logs,
    };
  }

  // Phase 2: Releasing Payload Animation
  if (state.phase === 'RELEASING_PAYLOAD') {
    const releaseStep = stepPayloadRelease(state.payload, simDt);
    if (releaseStep.justCompleted) {
      newLogs.unshift(
        createLog(
          nextSimTime,
          'SUCCESS',
          'PAYLOAD',
          `Delivery successful! Package deployed at (${state.drone.position.x.toFixed(
            1
          )}, ${state.drone.position.y.toFixed(
            1
          )}) inside ${state.destination.label}.`
        )
      );
      return {
        ...state,
        phase: 'COMPLETED_SUCCESS',
        deliveryStatus: 'DELIVERY_SUCCESS',
        simTimeSec: nextSimTime,
        payload: releaseStep.payload,
        logs: [...newLogs, ...state.logs].slice(0, 40),
      };
    }

    return {
      ...state,
      simTimeSec: nextSimTime,
      payload: releaseStep.payload,
    };
  }

  return state;
}
