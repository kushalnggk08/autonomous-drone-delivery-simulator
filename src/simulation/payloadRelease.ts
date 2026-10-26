import {
  DestinationVerificationResult,
  PayloadState,
  Point2D,
} from './types';

export function createInitialPayloadState(): PayloadState {
  return {
    attached: true,
    releasing: false,
    released: false,
    releaseProgress: 0,
    dropPosition: null,
    statusMessage: 'Payload secured in bay (Awaiting destination lock)',
  };
}

/**
 * Attempts to initiate payload release. Requires a passing DestinationVerificationResult.
 */
export function initiatePayloadRelease(
  currentPayload: PayloadState,
  verification: DestinationVerificationResult,
  dronePosition: Point2D
): { payload: PayloadState; allowed: boolean; logMessage: string } {
  if (!verification.attempted || !verification.verified) {
    return {
      allowed: false,
      payload: {
        ...currentPayload,
        releasing: false,
        released: false,
        statusMessage:
          'Release interlocked: Drone outside verified delivery perimeter',
      },
      logMessage: `Payload release blocked by safety interlock: ${verification.reason}`,
    };
  }

  return {
    allowed: true,
    payload: {
      attached: false,
      releasing: true,
      released: false,
      releaseProgress: 0,
      dropPosition: { x: dronePosition.x, y: dronePosition.y },
      statusMessage: 'Winch actuator engaged — lowering payload package...',
    },
    logMessage: `Payload bay doors open at (${dronePosition.x.toFixed(
      1
    )}, ${dronePosition.y.toFixed(1)}). Initiating controlled descent.`,
  };
}

/**
 * Steps the visible payload release animation deterministically over simulation time.
 * Full release animation takes 1.6 simulated seconds at 1x speed.
 */
export function stepPayloadRelease(
  currentPayload: PayloadState,
  dtSec: number,
  releaseDurationSec = 1.6
): { payload: PayloadState; justCompleted: boolean } {
  if (!currentPayload.releasing || currentPayload.released) {
    return { payload: currentPayload, justCompleted: false };
  }

  const progressDelta = (dtSec / releaseDurationSec) * 100;
  const nextProgress = Math.min(100, currentPayload.releaseProgress + progressDelta);

  if (nextProgress >= 100) {
    return {
      justCompleted: true,
      payload: {
        ...currentPayload,
        releasing: false,
        released: true,
        releaseProgress: 100,
        statusMessage: 'Payload touchdown confirmed inside delivery zone',
      },
    };
  }

  return {
    justCompleted: false,
    payload: {
      ...currentPayload,
      releaseProgress: nextProgress,
      statusMessage: `Lowering payload package (${Math.round(nextProgress)}%)`,
    },
  };
}
