import type { RoverState } from '@domain/rover/types.ts';
import type { RankingEntry } from '@infrastructure/ws/events.ts';

export interface StatePanel {
  setCurrentState(state: RoverState): void;
  setErrors(errors: Array<{ code: string; line: number; roverIndex?: number; message: string }>): void;
  resetTrace(): void;
  appendTrace(frame: {
    frameIndex: number;
    roverId: string;
    cmd: string;
    prev: RoverState;
    next: RoverState;
    warning?: { code: string };
  }): void;
  setCountdown(deadlineMs: number, nowMs?: number): void;
  setRanking(ranking: RankingEntry[]): void;
  setLateAlert(message: string): void;
}

export function createStatePanel(root: Element | Document): StatePanel {
  const doc = root?.ownerDocument ?? (typeof document !== 'undefined' ? document : null as unknown as Document);
  const stateEl = (root as Element)?.querySelector?.('[data-role="state"]') ?? doc?.querySelector?.('[data-role="state"]') as HTMLElement | null;
  const errorsEl = (root as Element)?.querySelector?.('[data-role="errors"]') ?? doc?.querySelector?.('[data-role="errors"]') as HTMLElement | null;
  const traceEl = (root as Element)?.querySelector?.('[data-role="trace"]') ?? doc?.querySelector?.('[data-role="trace"]') as HTMLElement | null;
  const countdownEl = (root as Element)?.querySelector?.('[data-role="countdown"]') ?? doc?.querySelector?.('[data-role="countdown"]') as HTMLElement | null;
  const rankingEl = (root as Element)?.querySelector?.('[data-role="ranking"]') ?? doc?.querySelector?.('[data-role="ranking"]') as HTMLElement | null;
  const alertEl = (root as Element)?.querySelector?.('[data-role="late-alert"]') ?? doc?.querySelector?.('[data-role="late-alert"]') as HTMLElement | null;

  const fmt = (s: RoverState): string => `S=(${s.x},${s.y},${s.orientation})`;

  return {
    setCurrentState(state: RoverState): void {
      if (!stateEl) return;
      stateEl.textContent = fmt(state);
    },
    setErrors(errors): void {
      if (!errorsEl) return;
      errorsEl.innerHTML = '';
      if (!errors || errors.length === 0) return;
      const docToUse = doc ?? (typeof document !== 'undefined' ? document : null);
      if (!docToUse) return;
      for (const e of errors) {
        const li = docToUse.createElement('li');
        li.textContent = `[${e.code}] Línea ${e.line}${typeof e.roverIndex === 'number' ? ` Rover ${e.roverIndex + 1}` : ''}: ${e.message}`;
        errorsEl.appendChild(li);
      }
    },
    resetTrace(): void {
      if (!traceEl) return;
      traceEl.innerHTML = '';
    },
    appendTrace(frame): void {
      if (!traceEl) return;
      const docToUse = doc ?? (typeof document !== 'undefined' ? document : null);
      if (!docToUse) return;
      const li = docToUse.createElement('li');
      const warning = frame.warning ? ` ⚠ ${frame.warning.code}` : '';
      if (frame.warning) li.classList.add('warning');
      li.textContent = `#${frame.frameIndex} ${frame.roverId} ${frame.cmd}: ${fmt(frame.prev)} -> ${fmt(frame.next)}${warning}`;
      traceEl.appendChild(li);
      traceEl.scrollTop = traceEl.scrollHeight;
    },
    setCountdown(deadlineMs: number, nowMs = Date.now()): void {
      if (!countdownEl) return;
      if (!Number.isFinite(deadlineMs)) {
        countdownEl.textContent = '—';
        return;
      }
      const remainingMs = Math.max(0, deadlineMs - nowMs);
      countdownEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;
    },
    setRanking(ranking: RankingEntry[] = []): void {
      if (!rankingEl) return;
      rankingEl.innerHTML = '';
      const docToUse = doc ?? (typeof document !== 'undefined' ? document : null);
      if (!docToUse) return;
      ranking.forEach((row, idx) => {
        const li = docToUse.createElement('li');
        li.textContent = `${idx + 1}. ${row.name} — ${row.totalScore}`;
        rankingEl.appendChild(li);
      });
    },
    setLateAlert(message = ''): void {
      if (!alertEl) return;
      alertEl.textContent = message;
    },
  };
}
