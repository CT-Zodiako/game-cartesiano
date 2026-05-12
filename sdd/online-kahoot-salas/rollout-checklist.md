# Rollout Checklist — online-kahoot-salas (MVP)

## Feature flag
- [x] `ONLINE_MODE` default en `false`.
- [x] Fallback inmediato: apagar `ONLINE_MODE` vuelve al modo local, sin migraciones de datos.

## Canary
- [ ] Habilitar canary interno para 1 sala concurrente.
- [ ] Validar flujo completo de 3 rondas con 2 clientes reales.

## Métricas mínimas a observar (48h)
- [ ] `claim_accept_total`
- [ ] `claim_too_late_total`
- [ ] `claim_duplicate_total`
- [ ] `claim_decision_ms` (p50/p95)

## Criterios de rollback
- [ ] Errores de protocolo repetidos (`ERROR` no esperado por cliente)
- [ ] Inconsistencia en ranking entre clientes
- [ ] Degradación severa de latencia de decisión de claims

## Procedimiento de rollback
1. Desactivar `ONLINE_MODE`.
2. Forzar recarga de clientes activos.
3. Confirmar que el juego vuelve al flujo local (sin WS).
4. Registrar incidente y snapshot de métricas para análisis.
