function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export class AuditLog {
  constructor() {
    this.events = [];
    this.metrics = {
      claim_accept_total: 0,
      claim_too_late_total: 0,
      claim_duplicate_total: 0,
      claim_decision_ms: [],
    };
  }

  recordEvent(event) {
    this.events.push(event);
  }

  recordClaimDecision({ eventId, roomId, roundId, playerId, reqId, serverReceivedAtMs, decision, reason, scoreDelta, rankingVersion, decisionMs = 0 }) {
    this.recordEvent({ eventId, roomId, roundId, playerId, reqId, serverReceivedAtMs, decision, reason: reason ?? null, scoreDelta: scoreDelta ?? 0, rankingVersion: rankingVersion ?? null });
    if (decision === 'ACCEPTED') this.metrics.claim_accept_total += 1;
    if (reason === 'TOO_LATE') this.metrics.claim_too_late_total += 1;
    if (reason === 'DUPLICATE') this.metrics.claim_duplicate_total += 1;
    this.metrics.claim_decision_ms.push(Math.max(0, decisionMs));
  }

  snapshotMetrics() {
    return {
      claim_accept_total: this.metrics.claim_accept_total,
      claim_too_late_total: this.metrics.claim_too_late_total,
      claim_duplicate_total: this.metrics.claim_duplicate_total,
      claim_decision_ms: {
        count: this.metrics.claim_decision_ms.length,
        p50: percentile(this.metrics.claim_decision_ms, 50),
        p95: percentile(this.metrics.claim_decision_ms, 95),
      },
    };
  }
}
