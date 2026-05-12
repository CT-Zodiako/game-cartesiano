export function createStatePanel(root) {
  const doc = root?.ownerDocument ?? document;
  const stateEl = root?.querySelector('[data-role="state"]') ?? doc.querySelector('[data-role="state"]');
  const errorsEl = root?.querySelector('[data-role="errors"]') ?? doc.querySelector('[data-role="errors"]');
  const traceEl = root?.querySelector('[data-role="trace"]') ?? doc.querySelector('[data-role="trace"]');
  const countdownEl = root?.querySelector('[data-role="countdown"]') ?? doc.querySelector('[data-role="countdown"]');
  const rankingEl = root?.querySelector('[data-role="ranking"]') ?? doc.querySelector('[data-role="ranking"]');
  const alertEl = root?.querySelector('[data-role="late-alert"]') ?? doc.querySelector('[data-role="late-alert"]');

  const fmt = (s) => `S=(${s.x},${s.y},${s.orientation})`;

  return {
    setCurrentState(state) {
      if (!stateEl) return;
      stateEl.textContent = fmt(state);
    },
    setErrors(errors) {
      if (!errorsEl) return;
      errorsEl.innerHTML = '';
      if (!errors || errors.length === 0) return;
      errors.forEach((e) => {
        const li = document.createElement('li');
        li.textContent = `[${e.code}] Línea ${e.line}${typeof e.roverIndex === 'number' ? ` Rover ${e.roverIndex + 1}` : ''}: ${e.message}`;
        errorsEl.appendChild(li);
      });
    },
    resetTrace() {
      if (!traceEl) return;
      traceEl.innerHTML = '';
    },
    appendTrace(frame) {
      if (!traceEl) return;
      const li = document.createElement('li');
      const warning = frame.warning ? ` ⚠ ${frame.warning.code}` : '';
      if (frame.warning) li.classList.add('warning');
      li.textContent = `#${frame.frameIndex} ${frame.roverId} ${frame.cmd}: ${fmt(frame.prev)} -> ${fmt(frame.next)}${warning}`;
      traceEl.appendChild(li);
      traceEl.scrollTop = traceEl.scrollHeight;
    },
    setCountdown(deadlineMs, nowMs = Date.now()) {
      if (!countdownEl) return;
      if (!Number.isFinite(deadlineMs)) {
        countdownEl.textContent = '—';
        return;
      }
      const remainingMs = Math.max(0, deadlineMs - nowMs);
      countdownEl.textContent = `${Math.ceil(remainingMs / 1000)}s`;
    },
    setRanking(ranking = []) {
      if (!rankingEl) return;
      rankingEl.innerHTML = '';
      ranking.forEach((row, idx) => {
        const li = doc.createElement('li');
        li.textContent = `${idx + 1}. ${row.name} — ${row.totalScore}`;
        rankingEl.appendChild(li);
      });
    },
    setLateAlert(message = '') {
      if (!alertEl) return;
      alertEl.textContent = message;
    },
  };
}
