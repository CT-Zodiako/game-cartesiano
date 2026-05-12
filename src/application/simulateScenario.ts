import type { RoverState, Plateau, Warning } from '../domain/rover/types.js';
import { executeRoverSequence } from '../domain/rover/execute.js';
import { createWarning, WARNING_CODES } from '../domain/rover/types.js';

export interface RoverInput {
  id: string;
  initial: RoverState;
  commands: string;
}

export interface ScenarioInput {
  plateau: Plateau;
  rovers: RoverInput[];
}

function posKey(s: RoverState): string {
  return `${s.x},${s.y}`;
}

export interface TimelineFrame {
  frameIndex: number;
  roverId: string;
  roverIndex: number;
  stepIndex: number;
  cmd: string;
  prev: RoverState;
  next: RoverState;
  warning?: Warning;
}

export interface RoverTrace {
  roverId: string;
  trace: TimelineFrame[];
  warnings: Warning[];
}

export interface FinalRoverState {
  roverId: string;
  state: RoverState;
}

export interface ScenarioResult {
  finals: FinalRoverState[];
  roverTraces: RoverTrace[];
  timeline: TimelineFrame[];
}

export function simulateScenario(input: ScenarioInput): ScenarioResult {
  const { plateau, rovers } = input;
  const finals: FinalRoverState[] = [];
  const roverTraces: RoverTrace[] = [];
  const timeline: TimelineFrame[] = [];
  const occupied = new Set<string>();
  let frameIndex = 0;

  for (let rIdx = 0; rIdx < rovers.length; rIdx += 1) {
    const rover = rovers[rIdx];
    const roverWarnings: Warning[] = [];

    if (occupied.has(posKey(rover.initial))) {
      roverWarnings.push(
        createWarning(WARNING_CODES.ROVER_OVERLAP_ALLOWED, `Rover ${rover.id} inicia sobre una celda ocupada`, {
          roverId: rover.id,
          phase: 'start',
        }),
      );
    }

    const { finalState, trace } = executeRoverSequence(rover.initial, rover.commands, plateau);
    const remappedTrace: TimelineFrame[] = trace.map((step, stepIdx) => {
      const row: TimelineFrame = {
        frameIndex,
        roverId: rover.id,
        roverIndex: rIdx,
        stepIndex: stepIdx,
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
        roverIndex: rIdx,
        stepIndex: 0,
        cmd: 'M',
        prev: rover.initial,
        next: finalState,
      };
      if (!attachTo.warning) {
        attachTo.warning = roverWarnings[0];
      }
      if (remappedTrace.length === 0) {
        remappedTrace.push(attachTo as TimelineFrame);
        frameIndex += 1;
      }
    }

    occupied.add(posKey(finalState));
    finals.push({ roverId: rover.id, state: finalState });
    roverTraces.push({ roverId: rover.id, trace: remappedTrace, warnings: roverWarnings });
    timeline.push(...remappedTrace);
  }

  return { finals, roverTraces, timeline };
}
