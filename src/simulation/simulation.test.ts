import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRouteCompletionPercentage,
  euclideanDistance,
  validateRoute,
} from './routeFollowing';
import { stepDronePosition } from './positionUpdates';
import { verifyDestinationArrival } from './destinationVerification';
import {
  createInitialPayloadState,
  initiatePayloadRelease,
  stepPayloadRelease,
} from './payloadRelease';
import {
  createInitialSimulationState,
  DEFAULT_CANVAS_BOUNDS,
  SAMPLE_MISSION_PRESETS,
  startOrResumeSimulation,
  stepSimulation,
} from './engine';

test('validateRoute accepts valid sample mission and computes total distance', () => {
  const preset = SAMPLE_MISSION_PRESETS[0];
  const result = validateRoute(
    preset.startPoint,
    preset.waypoints,
    preset.destination,
    DEFAULT_CANVAS_BOUNDS,
    preset.noFlyZones
  );
  assert.equal(result.isValid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedNodes.length, 5); // Start + 3 WPs + Destination
  assert.ok(result.totalDistance > 800);
});

test('validateRoute rejects empty waypoints or no-fly zone intersections', () => {
  const preset = SAMPLE_MISSION_PRESETS[0];
  const emptyResult = validateRoute(
    preset.startPoint,
    [],
    preset.destination,
    DEFAULT_CANVAS_BOUNDS,
    []
  );
  assert.equal(emptyResult.isValid, false);
  assert.equal(emptyResult.issues[0]?.code, 'NO_WAYPOINTS');

  const nfzPreset = SAMPLE_MISSION_PRESETS[2];
  const nfzResult = validateRoute(
    nfzPreset.startPoint,
    nfzPreset.waypoints,
    nfzPreset.destination,
    DEFAULT_CANVAS_BOUNDS,
    nfzPreset.noFlyZones
  );
  assert.equal(nfzResult.isValid, false);
  assert.ok(
    nfzResult.issues.some((iss) => iss.code === 'NO_FLY_ZONE_INTERSECTION')
  );
});

test('stepDronePosition advances drone through waypoints in exact order', () => {
  const state = createInitialSimulationState(SAMPLE_MISSION_PRESETS[0]);
  let drone = state.drone;
  const passed: string[] = [];

  for (let i = 0; i < 300; i++) {
    const out = stepDronePosition(
      drone,
      state.routeValidation,
      state.waypoints,
      state.baseCruiseSpeed,
      1,
      0.1
    );
    drone = out.drone;
    passed.push(...out.waypointsPassed);
    if (out.reachedRouteEnd) break;
  }

  assert.deepEqual(passed, ['WP-1', 'WP-2', 'WP-3', 'DROP ZONE ALPHA']);
  assert.ok(
    euclideanDistance(drone.position, {
      x: state.destination.x,
      y: state.destination.y,
    }) < 1e-3
  );
  assert.equal(
    Math.round(
      calculateRouteCompletionPercentage(
        drone.totalDistanceTravelled,
        state.routeValidation.totalDistance
      )
    ),
    100
  );
});

test('verifyDestinationArrival and payloadRelease enforce target zone safety interlock', () => {
  const destination = {
    x: 800,
    y: 200,
    radius: 35,
    label: 'DROP ZONE',
    terminalOffsetX: 0,
    terminalOffsetY: 0,
  };

  // Inside delivery zone (error = 10m <= 35m)
  const validCheck = verifyDestinationArrival(
    { x: 806, y: 208 },
    destination,
    12.5
  );
  assert.equal(validCheck.verified, true);

  const payload0 = createInitialPayloadState();
  const allowedRelease = initiatePayloadRelease(payload0, validCheck, {
    x: 806,
    y: 208,
  });
  assert.equal(allowedRelease.allowed, true);
  assert.equal(allowedRelease.payload.releasing, true);

  const doneRelease = stepPayloadRelease(allowedRelease.payload, 2.0);
  assert.equal(doneRelease.justCompleted, true);
  assert.equal(doneRelease.payload.released, true);

  // Outside delivery zone (error = 50m > 35m)
  const failedCheck = verifyDestinationArrival(
    { x: 750, y: 200 },
    destination,
    12.5
  );
  assert.equal(failedCheck.verified, false);
  const blockedRelease = initiatePayloadRelease(payload0, failedCheck, {
    x: 750,
    y: 200,
  });
  assert.equal(blockedRelease.allowed, false);
  assert.equal(blockedRelease.payload.released, false);
});

test('Full simulation engine completes nominal mission with DELIVERY_SUCCESS and fails fault mission with DELIVERY_FAILED', () => {
  // 1. Nominal mission
  let sim = startOrResumeSimulation(
    createInitialSimulationState(SAMPLE_MISSION_PRESETS[0], 2)
  );
  for (let step = 0; step < 400; step++) {
    sim = stepSimulation(sim, 0.05);
    if (sim.phase === 'COMPLETED_SUCCESS' || sim.phase === 'COMPLETED_FAILURE') {
      break;
    }
  }
  assert.equal(sim.phase, 'COMPLETED_SUCCESS');
  assert.equal(sim.deliveryStatus, 'DELIVERY_SUCCESS');
  assert.equal(sim.payload.released, true);
  assert.equal(sim.completionPercentage, 100);

  // 2. Destination drift fault mission
  let faultSim = startOrResumeSimulation(
    createInitialSimulationState(SAMPLE_MISSION_PRESETS[1], 2)
  );
  for (let step = 0; step < 400; step++) {
    faultSim = stepSimulation(faultSim, 0.05);
    if (
      faultSim.phase === 'COMPLETED_SUCCESS' ||
      faultSim.phase === 'COMPLETED_FAILURE'
    ) {
      break;
    }
  }
  assert.equal(faultSim.phase, 'COMPLETED_FAILURE');
  assert.equal(faultSim.deliveryStatus, 'DELIVERY_FAILED');
  assert.equal(faultSim.payload.released, false);
  assert.equal(faultSim.verification?.verified, false);
});
