import React, { useEffect, useRef, useState } from 'react';
import { MissionDashboard } from './components/MissionDashboard';
import { SimulationCanvas2D } from './components/SimulationCanvas2D';
import { WaypointManager } from './components/WaypointManager';
import {
  createInitialSimulationState,
  rebuildStateWithUpdatedGeometry,
  SAMPLE_MISSION_PRESETS,
  startOrResumeSimulation,
  stepSimulation,
} from './simulation/engine';
import { DestinationZone, Point2D, SimulationState, Waypoint } from './simulation/types';

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function App() {
  const [activePresetId, setActivePresetId] = useState<string>(
    SAMPLE_MISSION_PRESETS[0].id
  );
  const [simState, setSimState] = useState<SimulationState>(() => {
    const initial = createInitialSimulationState(SAMPLE_MISSION_PRESETS[0], 1);
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
    ) {
      return startOrResumeSimulation(initial);
    }
    return initial;
  });
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(
    SAMPLE_MISSION_PRESETS[0].waypoints[0]?.id ?? null
  );
  const [addModeActive, setAddModeActive] = useState<boolean>(false);

  // Use requestAnimationFrame for smooth, deterministic simulation stepping
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const isRunning =
      simState.phase === 'IN_FLIGHT' ||
      simState.phase === 'VERIFYING_DESTINATION' ||
      simState.phase === 'RELEASING_PAYLOAD';

    if (!isRunning) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animationFrameId: number;

    const tick = (nowMs: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = nowMs;
      }
      const dtSec = (nowMs - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = nowMs;

      if (dtSec > 0) {
        setSimState((prev) => stepSimulation(prev, dtSec));
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [simState.phase]);

  // Handlers for playback controls
  const handleStart = () => {
    setAddModeActive(false);
    setSimState((prev) => startOrResumeSimulation(prev));
  };

  const handlePause = () => {
    setSimState((prev) => {
      if (prev.phase !== 'IN_FLIGHT' && prev.phase !== 'RELEASING_PAYLOAD') {
        return prev;
      }
      return {
        ...prev,
        phase: 'PAUSED',
      };
    });
  };

  const handleResume = () => {
    setSimState((prev) => {
      if (prev.phase !== 'PAUSED') return prev;
      return startOrResumeSimulation(prev);
    });
  };

  const handleReset = () => {
    setAddModeActive(false);
    setSimState((prev) =>
      rebuildStateWithUpdatedGeometry(
        prev,
        {},
        'Mission reset to Launch Pad coordinates.'
      )
    );
  };

  const handleSpeedChange = (multiplier: number) => {
    setSimState((prev) => ({
      ...prev,
      speedMultiplier: multiplier,
    }));
  };

  const handleLoadPreset = (presetId: string) => {
    const found =
      SAMPLE_MISSION_PRESETS.find((p) => p.id === presetId) ??
      SAMPLE_MISSION_PRESETS[0];
    setActivePresetId(found.id);
    setAddModeActive(false);
    const fresh = createInitialSimulationState(
      found,
      simState.speedMultiplier
    );
    setSimState(fresh);
    setSelectedWaypointId(fresh.waypoints[0]?.id ?? null);
  };

  // Waypoint & Geometry Handlers
  const handleAddWaypoint = (wpInput: {
    x: number;
    y: number;
    targetSpeed: number;
  }) => {
    setSimState((prev) => {
      const nextIndex = prev.waypoints.length + 1;
      const newWp: Waypoint = {
        id: `wp-${Date.now()}-${nextIndex}`,
        name: `WP-${nextIndex}`,
        x: Math.round(wpInput.x),
        y: Math.round(wpInput.y),
        targetSpeed: wpInput.targetSpeed,
      };
      const updated = [...prev.waypoints, newWp];
      setSelectedWaypointId(newWp.id);
      return rebuildStateWithUpdatedGeometry(
        prev,
        { waypoints: updated },
        `Added ${newWp.name} at (${newWp.x}, ${newWp.y}).`
      );
    });
  };

  const handleAddWaypointAtCanvas = (pos: Point2D) => {
    handleAddWaypoint({
      x: pos.x,
      y: pos.y,
      targetSpeed: simState.baseCruiseSpeed,
    });
  };

  const handleRemoveWaypoint = (id: string) => {
    setSimState((prev) => {
      const removed = prev.waypoints.find((w) => w.id === id);
      const updated = prev.waypoints.filter((w) => w.id !== id);
      return rebuildStateWithUpdatedGeometry(
        prev,
        { waypoints: updated },
        `Removed ${removed?.name ?? 'waypoint'}.`
      );
    });
  };

  const handleClearWaypoints = () => {
    setSelectedWaypointId(null);
    setSimState((prev) =>
      rebuildStateWithUpdatedGeometry(
        prev,
        { waypoints: [] },
        'Cleared all intermediate waypoints.'
      )
    );
  };

  const handleUpdateWaypoint = (id: string, updates: Partial<Waypoint>) => {
    setSimState((prev) => {
      const updated = prev.waypoints.map((wp) =>
        wp.id === id ? { ...wp, ...updates } : wp
      );
      return rebuildStateWithUpdatedGeometry(prev, { waypoints: updated });
    });
  };

  const handleMoveWaypoint = (id: string, pos: Point2D) => {
    handleUpdateWaypoint(id, { x: pos.x, y: pos.y });
  };

  const handleReorderWaypoint = (index: number, direction: 'up' | 'down') => {
    setSimState((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.waypoints.length) return prev;
      const copy = [...prev.waypoints];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return rebuildStateWithUpdatedGeometry(
        prev,
        { waypoints: copy },
        `Reordered waypoint sequence.`
      );
    });
  };

  const handleMoveStartPoint = (pos: Point2D) => {
    setSimState((prev) =>
      rebuildStateWithUpdatedGeometry(prev, { startPoint: pos })
    );
  };

  const handleMoveDestination = (pos: Point2D) => {
    setSimState((prev) =>
      rebuildStateWithUpdatedGeometry(prev, {
        destination: { ...prev.destination, x: pos.x, y: pos.y },
      })
    );
  };

  const handleUpdateDestination = (updates: Partial<DestinationZone>) => {
    setSimState((prev) =>
      rebuildStateWithUpdatedGeometry(prev, {
        destination: { ...prev.destination, ...updates },
      })
    );
  };

  const isRunning =
    simState.phase === 'IN_FLIGHT' ||
    simState.phase === 'VERIFYING_DESTINATION' ||
    simState.phase === 'RELEASING_PAYLOAD';
  const isPaused = simState.phase === 'PAUSED';

  return (
    <div
      data-state={simState.phase}
      className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col"
    >
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0B1120] border-b border-slate-800">
        <a
          href="#workspace"
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          AeroNav 2D Autonomous Drone Simulation
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <a
            href="#simulation-stage"
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Flight Stage
          </a>
          <a
            href="#telemetry-dashboard"
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Telemetry
          </a>
          <a
            href="#waypoint-editor"
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Waypoints
          </a>
          <a
            href="#architecture-notes"
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Architecture
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Reset Simulation
          </button>
        </div>
      </header>

      {/* Main Engineering Workspace */}
      <main
        id="workspace"
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4"
      >
        {/* Simulation Disclaimer & Mission Control Toolbar */}
        <section className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
          {/* Top Metadata Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-b border-slate-800/80 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-200">
                Autonomous Drone Waypoint Navigation &amp; Payload Delivery
                Simulation
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-cyan-400">
                100% Software Prototype (2D Kinematic Model)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              All coordinates, velocities, destination checks, and payload
              releases are simulated
            </span>
          </div>

          {/* Bottom Controls Row: Scenario Selector + Playback Controls + Speed Control */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mission Scenario Selector */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="preset-select"
                className="text-xs font-medium text-slate-300 whitespace-nowrap"
              >
                Mission Preset:
              </label>
              <select
                id="preset-select"
                aria-label="Mission Scenario Preset"
                value={activePresetId}
                onChange={(e) => handleLoadPreset(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#070B14] border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                {SAMPLE_MISSION_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Playback & Speed Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={isRunning}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
              >
                Start
              </button>

              <button
                type="button"
                onClick={handlePause}
                disabled={!isRunning}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
              >
                Pause
              </button>

              <button
                type="button"
                onClick={handleResume}
                disabled={!isPaused}
                className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
              >
                Resume
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Reset
              </button>

              {/* Speed Multiplier Segmented Control */}
              <div
                role="group"
                aria-label="Simulation Speed Control"
                className="flex items-center gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-md"
              >
                <span className="text-[11px] font-mono text-slate-400 px-1.5">
                  Speed:
                </span>
                {SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      simState.speedMultiplier === spd
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Asymmetric Split Console: Left/Main 2D Stage + Telemetry, Right Waypoint & Zone Editor */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Left 8 Columns: 2D Airspace Canvas + Live Mission Dashboard */}
          <div
            id="simulation-stage"
            className="xl:col-span-8 space-y-4"
          >
            <SimulationCanvas2D
              state={simState}
              selectedWaypointId={selectedWaypointId}
              onSelectWaypoint={setSelectedWaypointId}
              onMoveWaypoint={handleMoveWaypoint}
              onMoveStartPoint={handleMoveStartPoint}
              onMoveDestination={handleMoveDestination}
              onAddWaypointAt={handleAddWaypointAtCanvas}
              addModeActive={addModeActive}
            />

            <div id="telemetry-dashboard">
              <MissionDashboard state={simState} />
            </div>
          </div>

          {/* Right 4 Columns: Waypoint & Destination Configuration */}
          <div id="waypoint-editor" className="xl:col-span-4 space-y-4">
            <WaypointManager
              waypoints={simState.waypoints}
              startPoint={simState.startPoint}
              destination={simState.destination}
              selectedWaypointId={selectedWaypointId}
              onSelectWaypoint={setSelectedWaypointId}
              onAddWaypoint={handleAddWaypoint}
              onRemoveWaypoint={handleRemoveWaypoint}
              onUpdateWaypoint={handleUpdateWaypoint}
              onReorderWaypoint={handleReorderWaypoint}
              onClearWaypoints={handleClearWaypoints}
              onUpdateStartPoint={handleMoveStartPoint}
              onUpdateDestination={handleUpdateDestination}
              addModeActive={addModeActive}
              onToggleAddMode={() => setAddModeActive((v) => !v)}
              disabled={isRunning}
            />

            {/* Modular Software Architecture Reference Card */}
            <section
              id="architecture-notes"
              className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 space-y-2 text-xs"
            >
              <h2 className="text-sm font-semibold text-slate-100">
                Decoupled Simulation Architecture
              </h2>
              <p className="text-slate-400 leading-relaxed">
                This college engineering prototype separates deterministic 2D
                flight logic into four isolated TypeScript modules independent
                of React rendering:
              </p>
              <ul className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                <li>
                  1. <strong className="text-cyan-400">routeFollowing</strong> —
                  Waypoint sequencing, Liang-Barsky no-fly zone intersection,
                  and path length math.
                </li>
                <li>
                  2. <strong className="text-cyan-400">positionUpdates</strong>{' '}
                  — Deterministic 2D vector kinematics, heading angle, and
                  breadcrumb trail stepping.
                </li>
                <li>
                  3.{' '}
                  <strong className="text-cyan-400">
                    destinationVerification
                  </strong>{' '}
                  — Radial proximity check comparing terminal UAV coordinates
                  against configured drop zone radius.
                </li>
                <li>
                  4. <strong className="text-cyan-400">payloadRelease</strong> —
                  Safety-interlocked winch deployment state machine and descent
                  progress animation.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
