import React from 'react';
import { getCurrentTargetLabel } from '../simulation/routeFollowing';
import { SimulationState } from '../simulation/types';

interface MissionDashboardProps {
  state: SimulationState;
}

export const MissionDashboard: React.FC<MissionDashboardProps> = ({
  state,
}) => {
  const {
    phase,
    deliveryStatus,
    simTimeSec,
    drone,
    routeValidation,
    destination,
    verification,
    payload,
    completionPercentage,
    logs,
  } = state;

  const { targetLabel, legNumber, totalLegs } = getCurrentTargetLabel(
    routeValidation,
    drone.currentSegmentIndex
  );

  const deliveryBadgeConfig: Record<
    SimulationState['deliveryStatus'],
    { label: string; colorClass: string; glyph: string }
  > = {
    STANDBY: {
      label: 'STANDBY — READY FOR LAUNCH',
      colorClass: 'text-slate-300',
      glyph: '[READY]',
    },
    IN_TRANSIT: {
      label: 'IN TRANSIT — FOLLOWING ROUTE',
      colorClass: 'text-cyan-400',
      glyph: '[ACTIVE]',
    },
    VERIFYING_ZONE: {
      label: 'VERIFYING TARGET PERIMETER',
      colorClass: 'text-amber-400',
      glyph: '[CHECK]',
    },
    RELEASING: {
      label: `RELEASING PAYLOAD (${Math.round(payload.releaseProgress)}%)`,
      colorClass: 'text-amber-400',
      glyph: '[DROP]',
    },
    DELIVERY_SUCCESS: {
      label: 'DELIVERY SUCCESS — VERIFIED IN ZONE',
      colorClass: 'text-emerald-400',
      glyph: '[OK]',
    },
    DELIVERY_FAILED: {
      label: 'DELIVERY FAILED — OUTSIDE TARGET ZONE',
      colorClass: 'text-rose-400',
      glyph: '[FAIL]',
    },
    ROUTE_INVALID: {
      label: 'ROUTE INVALID — LAUNCH INTERLOCKED',
      colorClass: 'text-rose-400',
      glyph: '[ERR]',
    },
  };

  const activeBadge = deliveryBadgeConfig[deliveryStatus];

  return (
    <div className="space-y-4">
      {/* Primary 4-KPI Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Simulated Drone Coordinates */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">
            Simulated Drone Coordinates
          </div>
          <div
            data-testid="telemetry-coordinates"
            className="mt-1 text-xl font-mono font-bold text-slate-100"
          >
            ({drone.position.x.toFixed(1)}, {drone.position.y.toFixed(1)})
            <span className="text-xs font-mono font-normal text-slate-400 ml-1.5">
              m
            </span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-400">
            Heading: {drone.headingDeg.toFixed(1)}° · Speed:{' '}
            {(drone.speed * state.speedMultiplier).toFixed(0)} m/s
          </div>
        </div>

        {/* KPI 2: Current Waypoint & Progress */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">
            Active Waypoint &amp; Route Progress
          </div>
          <div
            data-testid="telemetry-progress"
            className="mt-1 text-xl font-mono font-bold text-cyan-400"
          >
            {completionPercentage.toFixed(1)}
            <span className="text-xs font-mono font-normal text-slate-400 ml-1">
              %
            </span>
          </div>
          <div className="mt-1.5 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-transform duration-150 origin-left"
              style={{
                transform: `scaleX(${Math.min(
                  1,
                  Math.max(0, completionPercentage / 100)
                )})`,
              }}
            />
          </div>
          <div
            data-testid="telemetry-waypoint"
            className="mt-1 text-xs font-mono text-slate-300 truncate"
          >
            Target: {targetLabel} (Leg {legNumber}/{totalLegs})
          </div>
        </div>

        {/* KPI 3: Distance Travelled & Elapsed Time */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">
            Distance Travelled &amp; Simulated Time
          </div>
          <div
            data-testid="telemetry-distance"
            className="mt-1 text-xl font-mono font-bold text-slate-100"
          >
            {drone.totalDistanceTravelled.toFixed(1)}
            <span className="text-xs font-mono font-normal text-slate-400 ml-1">
              / {routeValidation.totalDistance.toFixed(1)} m
            </span>
          </div>
          <div
            data-testid="telemetry-time"
            className="mt-1 text-xs font-mono text-slate-300"
          >
            Simulated Elapsed: T+{simTimeSec.toFixed(2)} s ({state.speedMultiplier}
            x)
          </div>
        </div>

        {/* KPI 4: Delivery & Payload Status */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">
            Payload Delivery Status
          </div>
          <div
            data-testid="telemetry-delivery-status"
            className={`mt-1 text-sm font-mono font-bold ${activeBadge.colorClass}`}
          >
            {activeBadge.glyph} {activeBadge.label}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {payload.statusMessage}
          </div>
        </div>
      </div>

      {/* Destination Zone Verification & Route Diagnostic Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Destination Verification Module Output */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-semibold text-slate-200">
              Destination Zone Verification &amp; Payload Interlock
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Zone R = {destination.radius}m
            </span>
          </div>

          {verification ? (
            <div
              data-testid="verification-result-banner"
              className={`p-3 rounded-md border text-xs font-mono space-y-1.5 ${
                verification.verified
                  ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-700/60 text-rose-200'
              }`}
            >
              <div className="font-bold">
                {verification.verified
                  ? '[VERIFIED] DESTINATION LOCK CONFIRMED — PAYLOAD RELEASE AUTHORIZED'
                  : '[INTERLOCKED] DESTINATION CHECK FAILED — PAYLOAD RELEASE BLOCKED'}
              </div>
              <div className="text-slate-300">{verification.reason}</div>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-400">
                <span>
                  Radial Error:{' '}
                  <strong className="text-slate-100">
                    {verification.measuredErrorDistance.toFixed(2)} m
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Allowed Radius:{' '}
                  <strong className="text-slate-100">
                    {verification.allowedRadius.toFixed(1)} m
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Verified at: T+{verification.timestampSimSec.toFixed(2)}s
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-md border border-slate-800 bg-[#0B1120] text-xs text-slate-400 space-y-1">
              <div className="font-mono text-slate-300">
                Awaiting arrival at final route coordinate (
                {destination.x + destination.terminalOffsetX},{' '}
                {destination.y + destination.terminalOffsetY})
              </div>
              <div>
                Payload release requires terminal drone coordinates to fall
                within {destination.radius}m of {destination.label} (
                {destination.x}, {destination.y}).
              </div>
            </div>
          )}

          {/* Route Validation Issues if any */}
          {!routeValidation.isValid && (
            <div
              data-testid="route-invalid-banner"
              className="mt-2.5 p-3 rounded-md border border-rose-700/70 bg-rose-950/30 text-xs text-rose-200 space-y-1"
            >
              <div className="font-mono font-bold">
                ✖ PRE-FLIGHT ROUTE VALIDATION FAILED
              </div>
              {routeValidation.issues.map((iss, i) => (
                <div key={i} className="font-mono text-[11px]">
                  • {iss.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deterministic Event & Telemetry Log */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-semibold text-slate-200">
              Simulated Flight Controller Event Log
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Phase: {phase}
            </span>
          </div>
          <div className="h-28 overflow-y-auto bg-[#0B1120] border border-slate-800/80 rounded p-2.5 space-y-1.5 font-mono text-[11px]">
            {logs.map((entry) => {
              const levelColor =
                entry.level === 'SUCCESS'
                  ? 'text-emerald-400'
                  : entry.level === 'ERROR'
                  ? 'text-rose-400'
                  : entry.level === 'WARNING'
                  ? 'text-amber-400'
                  : 'text-cyan-400';
              return (
                <div key={entry.id} className="leading-relaxed text-slate-300">
                  <span className="text-slate-500">
                    [T+{entry.simTimeSec.toFixed(1)}s]
                  </span>{' '}
                  <span className={`font-semibold ${levelColor}`}>
                    [{entry.module}]
                  </span>{' '}
                  <span>{entry.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
