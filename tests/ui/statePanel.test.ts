import test from 'node:test';
import assert from 'node:assert/strict';

import { createStatePanel } from '../../src/ui/dom/statePanel.ts';

interface FakeElement {
  textContent: string;
  innerHTML: string;
  children: FakeElement[];
  classList: {
    values: Set<string>;
    add(v: string): void;
    contains(v: string): boolean;
  };
  appendChild(el: FakeElement): void;
  scrollTop: number;
  scrollHeight: number;
}

function createFakeElement(): FakeElement {
  return {
    textContent: '',
    innerHTML: '',
    children: [],
    classList: {
      values: new Set<string>(),
      add(v: string) { this.values.add(v); },
      contains(v: string) { return this.values.has(v); },
    },
    appendChild(el: FakeElement) { this.children.push(el); },
    scrollTop: 0,
    scrollHeight: 100,
  };
}

function createFakeDoc() {
  return {
    createElement(tagName: string): FakeElement {
      return {
        tagName,
        textContent: '',
        innerHTML: '',
        children: [],
        classList: {
          values: new Set<string>(),
          add(v: string) { this.values.add(v); },
          contains(v: string) { return this.values.has(v); },
        },
        appendChild(el: FakeElement) { this.children.push(el); },
        scrollTop: 0,
        scrollHeight: 100,
      };
    },
  };
}

test('state panel synchronization updates current state text', () => {
  const stateEl = createFakeElement();
  const errorsEl = createFakeElement();
  const traceEl = createFakeElement();
  const countdownEl = createFakeElement();
  const rankingEl = createFakeElement();
  const alertEl = createFakeElement();
  const fakeDoc = createFakeDoc();

  const root = {
    ownerDocument: fakeDoc as unknown as Document,
    querySelector(selector: string) {
      if (selector === '[data-role="state"]') return stateEl;
      if (selector === '[data-role="errors"]') return errorsEl;
      if (selector === '[data-role="trace"]') return traceEl;
      if (selector === '[data-role="countdown"]') return countdownEl;
      if (selector === '[data-role="ranking"]') return rankingEl;
      if (selector === '[data-role="late-alert"]') return alertEl;
      return null;
    },
  };

  const panel = createStatePanel(root as unknown as Document);
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
  const fakeDoc = createFakeDoc();

  const root = {
    ownerDocument: fakeDoc as unknown as Document,
    querySelector(selector: string) {
      if (selector === '[data-role="state"]') return stateEl;
      if (selector === '[data-role="errors"]') return errorsEl;
      if (selector === '[data-role="trace"]') return traceEl;
      if (selector === '[data-role="countdown"]') return countdownEl;
      if (selector === '[data-role="ranking"]') return rankingEl;
      if (selector === '[data-role="late-alert"]') return alertEl;
      return null;
    },
  };

  const panel = createStatePanel(root as unknown as Document);
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
  const fakeDoc = createFakeDoc();

  const root = {
    ownerDocument: fakeDoc as unknown as Document,
    querySelector(selector: string) {
      if (selector === '[data-role="state"]') return stateEl;
      if (selector === '[data-role="errors"]') return errorsEl;
      if (selector === '[data-role="trace"]') return traceEl;
      if (selector === '[data-role="countdown"]') return countdownEl;
      if (selector === '[data-role="ranking"]') return rankingEl;
      if (selector === '[data-role="late-alert"]') return alertEl;
      return null;
    },
  };

  const panel = createStatePanel(root as unknown as Document);
  panel.setCountdown(10_000, 7_100);
  panel.setRanking([
    { playerId: 'p1', name: 'Host', totalScore: 910, connected: true, lastAcceptedAtMs: null },
    { playerId: 'p2', name: 'P2', totalScore: 550, connected: true, lastAcceptedAtMs: null },
  ]);
  panel.setLateAlert('Llegaste tarde: otro jugador reclamó primero.');

  assert.equal(countdownEl.textContent, '3s');
  assert.equal(rankingEl.children.length, 2);
  assert.equal(rankingEl.children[0].textContent, '1. Host — 910');
  assert.equal(alertEl.textContent.includes('Llegaste tarde'), true);
});
