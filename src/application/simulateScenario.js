import { executeRoverSequence } from '../domain/rover/execute.js';
import { WARNING_CODES, createWarning } from '../domain/rover/types.js';

function posKey(s) {
  return `${s.x},${s.y}`;
}

export function simulateScenario(input) {
  const { plateau, rovers } = input;
  const finals = [];
  const roverTraces = [];
  const timeline = [];
  const occupied = new Set();
  let frameIndex = 0;

  rovers.forEach((rover, roverIndex) => {
    const roverWarnings = [];
    if (occupied.has(posKey(rover.initial))) {
      roverWarnings.push(
        createWarning(WARNING_CODES.ROVER_OVERLAP_ALLOWED, `Rover ${rover.id} inicia sobre una celda ocupada`, {
          roverId: rover.id,
          phase: 'start',
        }),
      );
    }

    const { finalState, trace } = executeRoverSequence(rover.initial, rover.commands, plateau);
    const remappedTrace = trace.map((step, stepIndex) => {
      const row = {
        frameIndex,
        roverId: rover.id,
        roverIndex,
        stepIndex,
        cmd: step.cmd,
        prev: step.prev,
        next: step.next,
        ...(step.warning ? { warning: step.warning } : {}),
      };
      frameIndex += 1;
      return row;
    });

    if (occupied.has(posKey(finalState))) {
      roverWarnings.push(
        createWarning(WARNING_CODES.ROVER_OVERLAP_ALLOWED, `Rover ${rover.id} termina sobre una celda ocupada`, {
          roverId: rover.id,
          phase: 'end',
        }),
      );
    }

    if (roverWarnings.length > 0) {
      const attachTo = remappedTrace.length > 0 ? remappedTrace[remappedTrace.length - 1] : {
        frameIndex,
        roverId: rover.id,
        roverIndex,
        stepIndex: 0,
        cmd: 'M',
        prev: rover.initial,
        next: finalState,
      };
      attachTo.warning = attachTo.warning ?? roverWarnings[0];
      if (remappedTrace.length === 0) {
        remappedTrace.push(attachTo);
        frameIndex += 1;
      }
    }

    occupied.add(posKey(finalState));
    finals.push({ roverId: rover.id, state: finalState });
    roverTraces.push({ roverId: rover.id, trace: remappedTrace, warnings: roverWarnings });
    timeline.push(...remappedTrace);
  });

  return { finals, roverTraces, timeline };
}
