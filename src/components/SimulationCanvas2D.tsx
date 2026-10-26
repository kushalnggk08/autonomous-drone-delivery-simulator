import React, { useRef, useState } from 'react';
import { getCurrentTargetLabel, getTerminalTargetPoint } from '../simulation/routeFollowing';
import { Point2D, SimulationState } from '../simulation/types';

interface SimulationCanvas2DProps {
  state: SimulationState;
  selectedWaypointId: string | null;
  onSelectWaypoint: (id: string | null) => void;
  onMoveWaypoint: (id: string, pos: Point2D) => void;
  onMoveStartPoint: (pos: Point2D) => void;
  onMoveDestination: (pos: Point2D) => void;
  onAddWaypointAt: (pos: Point2D) => void;
  addModeActive: boolean;
}

type DragTarget =
  | { type: 'waypoint'; id: string }
  | { type: 'start' }
  | { type: 'destination' }
  | null;

export const SimulationCanvas2D: React.FC<SimulationCanvas2DProps> = ({
  state,
  selectedWaypointId,
  onSelectWaypoint,
  onMoveWaypoint,
  onMoveStartPoint,
  onMoveDestination,
  onAddWaypointAt,
  addModeActive,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [hoverCoord, setHoverCoord] = useState<Point2D | null>(null);

  const {
    canvasBounds,
    startPoint,
    waypoints,
    destination,
    noFlyZones,
    routeValidation,
    drone,
    payload,
    verification,
    phase,
  } = state;

  const isLocked = phase === 'IN_FLIGHT' || phase === 'RELEASING_PAYLOAD';
  const terminalPoint = getTerminalTargetPoint(destination);
  const hasTerminalOffset =
    Math.abs(destination.terminalOffsetX) > 0.5 ||
    Math.abs(destination.terminalOffsetY) > 0.5;

  const clientToCanvasCoords = (
    clientX: number,
    clientY: number
  ): Point2D | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = canvasBounds.width / rect.width;
    const scaleY = canvasBounds.height / rect.height;
    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;
    return {
      x: Math.round(Math.max(15, Math.min(canvasBounds.width - 15, rawX))),
      y: Math.round(Math.max(15, Math.min(canvasBounds.height - 15, rawY))),
    };
  };

  const handlePointerDownNode = (
    e: React.PointerEvent,
    target: DragTarget
  ) => {
    e.stopPropagation();
    if (isLocked || !target) return;
    if (target.type === 'waypoint') {
      onSelectWaypoint(target.id);
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragTarget(target);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = clientToCanvasCoords(e.clientX, e.clientY);
    if (pt) {
      setHoverCoord(pt);
    }
    if (!dragTarget || !pt || isLocked) return;

    if (dragTarget.type === 'waypoint') {
      onMoveWaypoint(dragTarget.id, pt);
    } else if (dragTarget.type === 'start') {
      onMoveStartPoint(pt);
    } else if (dragTarget.type === 'destination') {
      onMoveDestination(pt);
    }
  };

  const handlePointerUp = () => {
    if (dragTarget) {
      setDragTarget(null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isLocked || dragTarget) return;
    if (addModeActive) {
      const pt = clientToCanvasCoords(e.clientX, e.clientY);
      if (pt) {
        onAddWaypointAt(pt);
      }
    }
  };

  const { targetLabel } = getCurrentTargetLabel(
    routeValidation,
    drone.currentSegmentIndex
  );

  // Grid ticks
  const xTicks = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const yTicks = [0, 100, 200, 300, 400, 500, 600];

  return (
    <div className="relative w-full bg-[#070B14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Top Canvas HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#0B1120] border-b border-slate-800/90 text-xs">
        <div className="flex items-center gap-3 text-slate-300">
          <span className="font-mono font-semibold text-cyan-400">
            2D SIMULATED AIRSPACE (1000m × 620m)
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-slate-400">
            Active Target:{' '}
            <strong className="font-mono text-slate-100">{targetLabel}</strong>
          </span>
          {hoverCoord && (
            <>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono text-slate-400">
                Cursor: ({hoverCoord.x}m, {hoverCoord.y}m)
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span>
            {isLocked
              ? 'LOCKED DURING FLIGHT'
              : addModeActive
              ? 'CLICK MAP TO PLACE NEW WAYPOINT'
              : 'DRAG NODES TO REPOSITION'}
          </span>
        </div>
      </div>

      {/* Main 2D Vector Stage */}
      <div className="relative w-full aspect-[1000/620]">
        <svg
          ref={svgRef}
          data-testid="simulation-canvas"
          viewBox={`0 0 ${canvasBounds.width} ${canvasBounds.height}`}
          className={`w-full h-full block ${
            addModeActive && !isLocked
              ? 'cursor-crosshair'
              : isLocked
              ? 'cursor-default'
              : 'cursor-grab active:cursor-grabbing'
          }`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setHoverCoord(null);
            setDragTarget(null);
          }}
          onClick={handleCanvasClick}
        >
          <defs>
            {/* Subtle sub-grid */}
            <pattern
              id="minor-grid"
              width="25"
              height="25"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 25 0 L 0 0 0 25"
                fill="none"
                stroke="#1E293B"
                strokeWidth="0.5"
                strokeOpacity="0.45"
              />
            </pattern>
            {/* Major 100m grid */}
            <pattern
              id="major-grid"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <rect width="100" height="100" fill="url(#minor-grid)" />
              <path
                d="M 100 0 L 0 0 0 100"
                fill="none"
                stroke="#1E293B"
                strokeWidth="1"
              />
            </pattern>
            {/* Restricted No-Fly Zone Hatch Pattern */}
            <pattern
              id="nfz-hatch"
              width="12"
              height="12"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="12"
                stroke="#F43F5E"
                strokeWidth="2"
                strokeOpacity="0.28"
              />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect
            width={canvasBounds.width}
            height={canvasBounds.height}
            fill="#070B14"
          />
          <rect
            width={canvasBounds.width}
            height={canvasBounds.height}
            fill="url(#major-grid)"
          />

          {/* Safe Boundary Margin Frame */}
          <rect
            x={10}
            y={10}
            width={canvasBounds.width - 20}
            height={canvasBounds.height - 20}
            fill="none"
            stroke="#1E293B"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Coordinate Axis Labels */}
          {xTicks.map((x) => (
            <text
              key={`xtick-${x}`}
              x={Math.min(Math.max(x + 4, 14), canvasBounds.width - 38)}
              y={22}
              fill="#475569"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {x}m
            </text>
          ))}
          {yTicks.slice(1).map((y) => (
            <text
              key={`ytick-${y}`}
              x={14}
              y={y - 4}
              fill="#475569"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {y}m
            </text>
          ))}

          {/* Restricted No-Fly Zones */}
          {noFlyZones.map((zone) => (
            <g key={zone.id}>
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill="url(#nfz-hatch)"
                stroke="#F43F5E"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                rx="4"
              />
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill="#F43F5E"
                fillOpacity="0.06"
                rx="4"
              />
              <text
                x={zone.x + zone.width / 2}
                y={zone.y + zone.height / 2 - 4}
                textAnchor="middle"
                fill="#FDA4AF"
                fontSize="10"
                fontWeight="600"
                fontFamily="JetBrains Mono, monospace"
              >
                {zone.label}
              </text>
              <text
                x={zone.x + zone.width / 2}
                y={zone.y + zone.height / 2 + 10}
                textAnchor="middle"
                fill="#F43F5E"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                RESTRICTED NO-FLY ZONE
              </text>
            </g>
          ))}

          {/* Route Segments */}
          {routeValidation.orderedNodes.slice(0, -1).map((fromNode, idx) => {
            const toNode = routeValidation.orderedNodes[idx + 1];
            const segLen = routeValidation.segmentLengths[idx] ?? 0;
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            const hasConflict = routeValidation.issues.some(
              (iss) => iss.segmentIndex === idx
            );
            const isCompletedLeg = idx < drone.currentSegmentIndex;
            const isCurrentLeg =
              idx === drone.currentSegmentIndex &&
              (phase === 'IN_FLIGHT' || phase === 'PAUSED');

            const strokeColor = hasConflict
              ? '#F43F5E'
              : isCompletedLeg
              ? '#10B981'
              : isCurrentLeg
              ? '#06B6D4'
              : '#38BDF8';

            return (
              <g key={`seg-${idx}`}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={strokeColor}
                  strokeWidth={isCurrentLeg ? '2.5' : '1.75'}
                  strokeDasharray={
                    hasConflict ? '4 4' : isCompletedLeg ? 'none' : '7 5'
                  }
                  strokeOpacity={isCompletedLeg ? 0.55 : 0.85}
                />
                {/* Segment Distance Callout */}
                {segLen >= 25 && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-28"
                      y="-9"
                      width="56"
                      height="18"
                      rx="3"
                      fill="#0B1120"
                      stroke={hasConflict ? '#F43F5E' : '#1E293B'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill={hasConflict ? '#FDA4AF' : '#94A3B8'}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {segLen.toFixed(0)}m
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Drone Executed Flight Breadcrumb Trail */}
          {drone.trail.length > 1 && (
            <polyline
              fill="none"
              stroke="#06B6D4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={drone.trail.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          )}

          {/* Destination Delivery Zone (Configured Target Area) */}
          <g
            transform={`translate(${destination.x}, ${destination.y})`}
            onPointerDown={(e) =>
              handlePointerDownNode(e, { type: 'destination' })
            }
            className={isLocked ? '' : 'cursor-move'}
          >
            {/* Acceptance Radius Perimeter */}
            <circle
              r={destination.radius}
              fill={
                phase === 'COMPLETED_SUCCESS'
                  ? 'rgba(16, 185, 129, 0.14)'
                  : phase === 'COMPLETED_FAILURE'
                  ? 'rgba(244, 63, 94, 0.12)'
                  : 'rgba(6, 182, 212, 0.09)'
              }
              stroke={
                phase === 'COMPLETED_SUCCESS'
                  ? '#10B981'
                  : phase === 'COMPLETED_FAILURE'
                  ? '#F43F5E'
                  : '#06B6D4'
              }
              strokeWidth="1.75"
              strokeDasharray="6 4"
            />
            {/* Inner Concentric Target Ring */}
            <circle
              r={Math.max(8, destination.radius * 0.45)}
              fill="none"
              stroke="#06B6D4"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
            {/* Crosshair lines */}
            <line
              x1={-destination.radius - 6}
              y1="0"
              x2={destination.radius + 6}
              y2="0"
              stroke="#06B6D4"
              strokeWidth="0.75"
              strokeOpacity="0.5"
            />
            <line
              x1="0"
              y1={-destination.radius - 6}
              x2="0"
              y2={destination.radius + 6}
              stroke="#06B6D4"
              strokeWidth="0.75"
              strokeOpacity="0.5"
            />
            {/* Center Bullseye */}
            <circle r="5" fill="#06B6D4" />
            <text
              x="0"
              y={-destination.radius - 24}
              textAnchor="middle"
              fill="#F8FAFC"
              fontSize="11"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {destination.label}
            </text>
            <text
              x="0"
              y={-destination.radius - 11}
              textAnchor="middle"
              fill="#38BDF8"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
            >
              TARGET ({destination.x}, {destination.y}) · R={destination.radius}m
            </text>
          </g>

          {/* If Terminal Offset is configured, show the offset terminal aim point */}
          {hasTerminalOffset && (
            <g transform={`translate(${terminalPoint.x}, ${terminalPoint.y})`}>
              <line
                x1={destination.x - terminalPoint.x}
                y1={destination.y - terminalPoint.y}
                x2="0"
                y2="0"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                r="8"
                fill="rgba(245, 158, 11, 0.2)"
                stroke="#F59E0B"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="20"
                textAnchor="middle"
                fill="#FBBF24"
                fontSize="9.5"
                fontFamily="JetBrains Mono, monospace"
              >
                DRIFT ENDPOINT ({Math.round(terminalPoint.x)},{' '}
                {Math.round(terminalPoint.y)})
              </text>
            </g>
          )}

          {/* Start Point (Launch Pad) */}
          <g
            transform={`translate(${startPoint.x}, ${startPoint.y})`}
            onPointerDown={(e) => handlePointerDownNode(e, { type: 'start' })}
            className={isLocked ? '' : 'cursor-move'}
          >
            <circle
              r="16"
              fill="#0B1120"
              stroke="#10B981"
              strokeWidth="2"
            />
            <text
              x="0"
              y="4"
              textAnchor="middle"
              fill="#10B981"
              fontSize="11"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              H
            </text>
            <text
              x="0"
              y="30"
              textAnchor="middle"
              fill="#10B981"
              fontSize="10"
              fontWeight="600"
              fontFamily="JetBrains Mono, monospace"
            >
              LAUNCH ({startPoint.x}, {startPoint.y})
            </text>
          </g>

          {/* Ordered Waypoints */}
          {waypoints.map((wp, index) => {
            const isSelected = wp.id === selectedWaypointId;
            const isPassed = index < drone.currentSegmentIndex;
            const isCurrentTarget =
              index === drone.currentSegmentIndex &&
              (phase === 'IN_FLIGHT' || phase === 'PAUSED');

            return (
              <g
                key={wp.id}
                transform={`translate(${wp.x}, ${wp.y})`}
                onPointerDown={(e) =>
                  handlePointerDownNode(e, { type: 'waypoint', id: wp.id })
                }
                className={isLocked ? '' : 'cursor-move'}
              >
                {isSelected && (
                  <circle
                    r="19"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
                <circle
                  r="13"
                  fill={
                    isPassed
                      ? '#064E3B'
                      : isCurrentTarget
                      ? '#083344'
                      : '#0F172A'
                  }
                  stroke={
                    isPassed
                      ? '#10B981'
                      : isCurrentTarget
                      ? '#06B6D4'
                      : isSelected
                      ? '#38BDF8'
                      : '#94A3B8'
                  }
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {index + 1}
                </text>
                <text
                  x="0"
                  y="-19"
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {wp.name} ({wp.x}, {wp.y})
                </text>
              </g>
            );
          })}

          {/* Visible Package Release & Touchdown Animation */}
          {(payload.releasing || payload.released) && payload.dropPosition && (
            <g
              transform={`translate(${payload.dropPosition.x}, ${payload.dropPosition.y})`}
            >
              {/* Expanding Acoustic/Visual Drop Ripple */}
              <circle
                r={12 + (payload.releaseProgress / 100) * 26}
                fill="none"
                stroke="#10B981"
                strokeWidth="1.75"
                strokeOpacity={Math.max(0.15, 1 - payload.releaseProgress / 120)}
              />
              {/* Descending Package Box */}
              <g
                transform={`translate(0, ${
                  (payload.releaseProgress / 100) * 22
                }) scale(${1.15 - (payload.releaseProgress / 100) * 0.25})`}
              >
                {/* Parachute canopy while releasing */}
                {payload.releasing && (
                  <path
                    d="M -12 -14 Q 0 -26 12 -14 Z"
                    fill="#38BDF8"
                    fillOpacity="0.85"
                    stroke="#E0F2FE"
                    strokeWidth="1"
                  />
                )}
                <rect
                  x="-8"
                  y="-8"
                  width="16"
                  height="16"
                  rx="2.5"
                  fill={payload.released ? '#10B981' : '#F59E0B'}
                  stroke="#070B14"
                  strokeWidth="1.5"
                />
                <line
                  x1="-8"
                  y1="0"
                  x2="8"
                  y2="0"
                  stroke="#070B14"
                  strokeWidth="1.2"
                />
                <line
                  x1="0"
                  y1="-8"
                  x2="0"
                  y2="8"
                  stroke="#070B14"
                  strokeWidth="1.2"
                />
              </g>
              <rect
                x="-76"
                y="32"
                width="152"
                height="20"
                rx="4"
                fill="#070B14"
                stroke={payload.released ? '#10B981' : '#F59E0B'}
                strokeWidth="1.2"
              />
              <text
                x="0"
                y="45"
                textAnchor="middle"
                fill={payload.released ? '#34D399' : '#FBBF24'}
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {payload.released
                  ? '[OK] PAYLOAD DELIVERED'
                  : `DROPPING PACKAGE ${Math.round(payload.releaseProgress)}%`}
              </text>
            </g>
          )}

          {/* Failed Destination Verification Callout on Map */}
          {phase === 'COMPLETED_FAILURE' && verification && (
            <g
              transform={`translate(${drone.position.x}, ${drone.position.y})`}
            >
              <circle
                r="24"
                fill="rgba(244, 63, 94, 0.18)"
                stroke="#F43F5E"
                strokeWidth="2"
              />
              <rect
                x="-102"
                y="30"
                width="204"
                height="22"
                rx="4"
                fill="#0B1120"
                stroke="#F43F5E"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="44"
                textAnchor="middle"
                fill="#FDA4AF"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                [FAIL] OUTSIDE ZONE ({verification.measuredErrorDistance.toFixed(1)}m
                &gt; {verification.allowedRadius}m)
              </text>
            </g>
          )}

          {/* Virtual Autonomous Quadcopter Drone */}
          <g transform={`translate(${drone.position.x}, ${drone.position.y})`}>
            <g transform={`rotate(${drone.headingDeg})`}>
              {/* Heading Direction Vector */}
              {phase === 'IN_FLIGHT' && (
                <line
                  x1="0"
                  y1="0"
                  x2="32"
                  y2="0"
                  stroke="#06B6D4"
                  strokeWidth="2"
                />
              )}
              {/* Quadcopter Frame Arms */}
              <line
                x1="-12"
                y1="-12"
                x2="12"
                y2="12"
                stroke="#E2E8F0"
                strokeWidth="2.5"
              />
              <line
                x1="-12"
                y1="12"
                x2="12"
                y2="-12"
                stroke="#E2E8F0"
                strokeWidth="2.5"
              />
              {/* 4 Rotors */}
              {[
                [-12, -12],
                [12, -12],
                [-12, 12],
                [12, 12],
              ].map(([rx, ry], i) => (
                <circle
                  key={`rotor-${i}`}
                  cx={rx}
                  cy={ry}
                  r="6.5"
                  fill="#0F172A"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                />
              ))}
              {/* Central Avionics & Payload Core */}
              <circle
                r="6.5"
                fill={payload.attached ? '#F59E0B' : '#06B6D4'}
                stroke="#070B14"
                strokeWidth="1.5"
              />
              {/* Forward Nose Indicator */}
              <polygon points="10,0 4,-3.5 4,3.5" fill="#06B6D4" />
            </g>

            {/* Live Drone Coordinate Tag */}
            <g transform="translate(0, -25)">
              <rect
                x="-58"
                y="-14"
                width="116"
                height="18"
                rx="3"
                fill="#0B1120"
                fillOpacity="0.92"
                stroke="#06B6D4"
                strokeWidth="1"
              />
              <text
                x="0"
                y="-2"
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="9.5"
                fontWeight="600"
                fontFamily="JetBrains Mono, monospace"
              >
                UAV ({drone.position.x.toFixed(0)}, {drone.position.y.toFixed(0)})
              </text>
            </g>
          </g>

          {/* Scale Bar & Simulation Watermark Footer inside SVG */}
          <g transform={`translate(24, ${canvasBounds.height - 24})`}>
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="0"
              stroke="#64748B"
              strokeWidth="2"
            />
            <line
              x1="0"
              y1="-4"
              x2="0"
              y2="4"
              stroke="#64748B"
              strokeWidth="2"
            />
            <line
              x1="100"
              y1="-4"
              x2="100"
              y2="4"
              stroke="#64748B"
              strokeWidth="2"
            />
            <text
              x="50"
              y="-6"
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="9.5"
              fontFamily="JetBrains Mono, monospace"
            >
              100m SIMULATED
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
