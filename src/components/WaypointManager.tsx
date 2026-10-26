import React, { useState } from 'react';
import { DestinationZone, Point2D, Waypoint } from '../simulation/types';

interface WaypointManagerProps {
  waypoints: Waypoint[];
  startPoint: Point2D;
  destination: DestinationZone;
  selectedWaypointId: string | null;
  onSelectWaypoint: (id: string | null) => void;
  onAddWaypoint: (wp: { x: number; y: number; targetSpeed: number }) => void;
  onRemoveWaypoint: (id: string) => void;
  onUpdateWaypoint: (id: string, updates: Partial<Waypoint>) => void;
  onReorderWaypoint: (index: number, direction: 'up' | 'down') => void;
  onClearWaypoints: () => void;
  onUpdateStartPoint: (pos: Point2D) => void;
  onUpdateDestination: (updates: Partial<DestinationZone>) => void;
  addModeActive: boolean;
  onToggleAddMode: () => void;
  disabled: boolean;
}

export const WaypointManager: React.FC<WaypointManagerProps> = ({
  waypoints,
  startPoint,
  destination,
  selectedWaypointId,
  onSelectWaypoint,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
  onReorderWaypoint,
  onClearWaypoints,
  onUpdateStartPoint,
  onUpdateDestination,
  addModeActive,
  onToggleAddMode,
  disabled,
}) => {
  const [newX, setNewX] = useState<string>('820');
  const [newY, setNewY] = useState<string>('390');
  const [newSpeed, setNewSpeed] = useState<string>('95');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedX = Math.max(15, Math.min(985, Number(newX) || 820));
    const parsedY = Math.max(15, Math.min(605, Number(newY) || 390));
    const parsedSpeed = Math.max(20, Math.min(200, Number(newSpeed) || 95));
    onAddWaypoint({ x: parsedX, y: parsedY, targetSpeed: parsedSpeed });
    // Offset next default coordinates slightly in clear airspace
    setNewX(String(Math.min(930, parsedX + 35)));
    setNewY(String(Math.max(90, parsedY - 55)));
  };

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Route &amp; Waypoint Configuration
          </h2>
          <p className="text-xs text-slate-400">
            Add, remove, reorder, or reposition simulated 2D coordinates
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleAddMode}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
            addModeActive
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
              : 'bg-[#0B1120] text-slate-200 border-slate-700 hover:border-cyan-500/60'
          } disabled:opacity-40`}
        >
          {addModeActive ? 'Map Click Mode: ON' : 'Click Map to Add WP'}
        </button>
      </div>

      {/* Add Waypoint Form */}
      <form
        onSubmit={handleAddSubmit}
        className="space-y-2.5 bg-[#0B1120] p-3 rounded-md border border-slate-800/90"
      >
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label
              htmlFor="new-wp-x"
              className="block text-[11px] font-mono text-slate-400 mb-1"
            >
              X Coord (m)
            </label>
            <input
              id="new-wp-x"
              type="number"
              min={15}
              max={985}
              disabled={disabled}
              value={newX}
              onChange={(e) => setNewX(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono bg-[#070B14] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="new-wp-y"
              className="block text-[11px] font-mono text-slate-400 mb-1"
            >
              Y Coord (m)
            </label>
            <input
              id="new-wp-y"
              type="number"
              min={15}
              max={605}
              disabled={disabled}
              value={newY}
              onChange={(e) => setNewY(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono bg-[#070B14] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="new-wp-speed"
              className="block text-[11px] font-mono text-slate-400 mb-1"
            >
              Speed (m/s)
            </label>
            <input
              id="new-wp-speed"
              type="number"
              min={20}
              max={200}
              disabled={disabled}
              value={newSpeed}
              onChange={(e) => setNewSpeed(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono bg-[#070B14] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="w-full px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
        >
          + Add Waypoint to Route
        </button>
      </form>

      {/* Ordered Waypoints List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-300">
            Ordered Navigation Sequence ({waypoints.length} Waypoints)
          </span>
          <button
            type="button"
            disabled={disabled || waypoints.length === 0}
            onClick={onClearWaypoints}
            className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 font-mono"
          >
            Clear All Waypoints
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {waypoints.length === 0 ? (
            <div className="p-3 rounded border border-rose-800/60 bg-rose-950/20 text-xs text-rose-300 font-mono">
              No waypoints configured. Add at least 1 waypoint to form a valid
              route.
            </div>
          ) : (
            waypoints.map((wp, index) => {
              const isSelected = wp.id === selectedWaypointId;
              return (
                <div
                  key={wp.id}
                  onClick={() => onSelectWaypoint(wp.id)}
                  className={`flex items-center justify-between gap-2 p-2 rounded border text-xs transition-colors ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500/70'
                      : 'bg-[#0B1120] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-cyan-400 w-10 shrink-0">
                      {wp.name}
                    </span>
                    <label className="flex items-center gap-1 font-mono text-slate-400">
                      <span>X:</span>
                      <input
                        aria-label={`${wp.name} X coordinate`}
                        type="number"
                        min={15}
                        max={985}
                        disabled={disabled}
                        value={wp.x}
                        onChange={(e) =>
                          onUpdateWaypoint(wp.id, {
                            x: Math.max(
                              15,
                              Math.min(985, Number(e.target.value) || 15)
                            ),
                          })
                        }
                        className="w-14 px-1.5 py-0.5 bg-[#070B14] border border-slate-700 rounded text-slate-100 text-xs font-mono"
                      />
                    </label>
                    <label className="flex items-center gap-1 font-mono text-slate-400">
                      <span>Y:</span>
                      <input
                        aria-label={`${wp.name} Y coordinate`}
                        type="number"
                        min={15}
                        max={605}
                        disabled={disabled}
                        value={wp.y}
                        onChange={(e) =>
                          onUpdateWaypoint(wp.id, {
                            y: Math.max(
                              15,
                              Math.min(605, Number(e.target.value) || 15)
                            ),
                          })
                        }
                        className="w-14 px-1.5 py-0.5 bg-[#070B14] border border-slate-700 rounded text-slate-100 text-xs font-mono"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Move ${wp.name} up`}
                      disabled={disabled || index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderWaypoint(index, 'up');
                      }}
                      className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${wp.name} down`}
                      disabled={disabled || index === waypoints.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderWaypoint(index, 'down');
                      }}
                      className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${wp.name}`}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWaypoint(wp.id);
                      }}
                      className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded text-[11px] font-mono disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Launch Pad & Destination Zone Calibration Controls */}
      <div className="pt-2 border-t border-slate-800 space-y-3">
        <div className="text-xs font-medium text-slate-300">
          Launch Pad &amp; Destination Zone Verification Parameters
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#0B1120] p-2.5 rounded border border-slate-800 text-xs">
          <div>
            <span className="block text-[11px] font-mono text-emerald-400 mb-1">
              Launch Pad (X, Y)
            </span>
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Launch Pad X"
                type="number"
                min={15}
                max={985}
                disabled={disabled}
                value={startPoint.x}
                onChange={(e) =>
                  onUpdateStartPoint({
                    x: Math.max(15, Math.min(985, Number(e.target.value) || 15)),
                    y: startPoint.y,
                  })
                }
                className="w-full px-2 py-1 bg-[#070B14] border border-slate-700 rounded font-mono text-slate-100"
              />
              <input
                aria-label="Launch Pad Y"
                type="number"
                min={15}
                max={605}
                disabled={disabled}
                value={startPoint.y}
                onChange={(e) =>
                  onUpdateStartPoint({
                    x: startPoint.x,
                    y: Math.max(15, Math.min(605, Number(e.target.value) || 15)),
                  })
                }
                className="w-full px-2 py-1 bg-[#070B14] border border-slate-700 rounded font-mono text-slate-100"
              />
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-mono text-cyan-400 mb-1">
              Destination Center (X, Y)
            </span>
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Destination X"
                type="number"
                min={15}
                max={985}
                disabled={disabled}
                value={destination.x}
                onChange={(e) =>
                  onUpdateDestination({
                    x: Math.max(15, Math.min(985, Number(e.target.value) || 15)),
                  })
                }
                className="w-full px-2 py-1 bg-[#070B14] border border-slate-700 rounded font-mono text-slate-100"
              />
              <input
                aria-label="Destination Y"
                type="number"
                min={15}
                max={605}
                disabled={disabled}
                value={destination.y}
                onChange={(e) =>
                  onUpdateDestination({
                    y: Math.max(15, Math.min(605, Number(e.target.value) || 15)),
                  })
                }
                className="w-full px-2 py-1 bg-[#070B14] border border-slate-700 rounded font-mono text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Delivery Zone Radius & Terminal Drift Injection */}
        <div className="bg-[#0B1120] p-2.5 rounded border border-slate-800 space-y-2.5 text-xs">
          <div>
            <div className="flex items-center justify-between font-mono text-[11px] mb-1">
              <label htmlFor="dest-radius-slider" className="text-slate-300">
                Delivery Zone Acceptance Radius:
              </label>
              <span className="text-cyan-400 font-bold">
                {destination.radius} m
              </span>
            </div>
            <input
              id="dest-radius-slider"
              type="range"
              min={15}
              max={90}
              disabled={disabled}
              value={destination.radius}
              onChange={(e) =>
                onUpdateDestination({ radius: Number(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between font-mono text-[11px] mb-1">
              <label htmlFor="terminal-drift-slider" className="text-slate-300">
                Simulated Terminal Drift Offset (ΔX):
              </label>
              <span
                className={
                  Math.hypot(
                    destination.terminalOffsetX,
                    destination.terminalOffsetY
                  ) > destination.radius
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {destination.terminalOffsetX >= 0
                  ? `+${destination.terminalOffsetX}`
                  : destination.terminalOffsetX}{' '}
                m
              </span>
            </div>
            <input
              id="terminal-drift-slider"
              type="range"
              min={-80}
              max={80}
              disabled={disabled}
              value={destination.terminalOffsetX}
              onChange={(e) =>
                onUpdateDestination({
                  terminalOffsetX: Number(e.target.value),
                  terminalOffsetY: 0,
                })
              }
              className="w-full accent-amber-400"
            />
            <div className="text-[11px] text-slate-400 mt-0.5">
              Set drift &gt; {destination.radius}m to test failed destination
              verification &amp; payload interlock.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
