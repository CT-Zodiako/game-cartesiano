import test from 'node:test';
import assert from 'node:assert/strict';

import { createStatePanel } from '../../src/ui/statePanel.js';

function createFakeElement() {
  return {
    textContent: '',
    innerHTML: '',
    children: [],
    classList: {
      values: new Set(),
      add(v) {
        this.values.add(v);
      },
      contains(v) {
        return this.values.has(v);
      },
    },
    appendChild(el) {
      this.children.push(el);
    },
    scrollTop: 0,
    scrollHeight: 100,
  };
}

test('state panel synchronization updates current state text', () => {
  const stateEl = createFakeElement();
  const errorsEl = createFakeElement();
  const traceEl = createFakeElement();
  const countdownEl = createFakeElement();
  const rankingEl = createFakeElement();
  const alertEl = createFakeElement();

  const root = {
    querySelector(selector) {
      if (selector === '[data-role="state"]') return stateEl;
      if (selector === '[data-role="errors"]') return errorsEl;
      if (selector === '[data-role="trace"]') return traceEl;
      if (selector === '[data-role="countdown"]') return countdownEl;
      if (selector === '[data-role="ranking"]') return rankingEl;
      if (selector === '[data-role="late-alert"]') return alertEl;
      return null;
    },
  };

  globalThis.document = {
    createElement() {
      return createFakeElement();
    },
  };

  const panel = createStatePanel(root);
  panel.setCurrentState({ x: 1, y: 3, orientation: 'N' });

  assert.equal(stateEl.textContent, 'S=(1,3,N)');
});

test('boundary warning is surfaced in trace row marker and text', () => {
  const stateEl = createFakeElement();
  const errorsEl = createFakeElement();
  const traceEl = createFakeElement();
  const countdownEl = createFakeElement();
  const rankingEl = createFakeElement();
  const alertEl = createFakeElement();

  const root = {
    querySelector(selector) {
      if (selector === '[data-role="state"]') return stateEl;
      if (selector === '[data-role="errors"]') return errorsEl;
      if (selector === '[data-role="trace"]') return traceEl;
      if (selector === '[data-role="countdown"]') return countdownEl;
      if (selector === '[data-role="ranking"]') return rankingEl;
      if (selector === '[data-role="late-alert"]') return alertEl;
      return null;
    },
  };

  globalThis.document = {
    createElement() {
      return createFakeElement();
    },
  };

  const panel = createStatePanel(root);
  panel.appendTrace({
    frameIndex: 0,
    roverId: 'R1',
    cmd: 'M',
    prev: { x: 0, y: 0, orientation: 'S' },
    next: { x: 0, y: 0, orientation: 'S' },
    warning: { code: 'MOVE_OUT_OF_BOUNDS' },
  });

  assert.equal(traceEl.children.length, 1);
  assert.equal(traceEl.children[0].classList.contains('warning'), true);
  assert.equal(traceEl.children[0].textContent.includes('MOVE_OUT_OF_BOUNDS'), true);
});

test('online panel renders countdown ranking and late alert', () => {
  const stateEl = createFakeElement();
  const errorsEl = createFakeElement();
  const traceEl = createFakeElement();
  const countdownEl = createFakeElement();
  const rankingEl = createFakeElement();
  const alertEl = createFakeElement();

  const root = {
    querySelector(selector) {
      if (selector === '[data-role="state"]') return stateEl;
      if (selector === '[data-role="errors"]') return errorsEl;
      if (selector === '[data-role="trace"]') return traceEl;
      if (selector === '[data-role="countdown"]') return countdownEl;
      if (selector === '[data-role="ranking"]') return rankingEl;
      if (selector === '[data-role="late-alert"]') return alertEl;
      return null;
    },
  };

  globalThis.document = {
    createElement() {
      return createFakeElement();
    },
  };

  const panel = createStatePanel(root);
  panel.setCountdown(10_000, 7_100);
  panel.setRanking([
    { name: 'Host', totalScore: 910 },
    { name: 'P2', totalScore: 550 },
  ]);
  panel.setLateAlert('Llegaste tarde: otro jugador reclamó primero.');

  assert.equal(countdownEl.textContent, '3s');
  assert.equal(rankingEl.children.length, 2);
  assert.equal(rankingEl.children[0].textContent, '1. Host — 910');
  assert.equal(alertEl.textContent.includes('Llegaste tarde'), true);
});
