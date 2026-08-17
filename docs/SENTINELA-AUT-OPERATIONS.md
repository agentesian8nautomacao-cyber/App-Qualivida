# SENTINELA AUT. — Catálogo de operações (Operational Core)

**Status:** Etapa 1 — Core **extraído** (código em `sentinela/core/`)  
**Regra:** operações mapeiam para `dataService` / utils existentes via adapters. Sem DDL. Sem WhatsApp/n8n.

## Localização

```
sentinela/core/
  index.ts
  types.ts
  context.ts
  adapters/persistence.ts
  domain/events.ts
  domain/reservationConflict.ts
  operations/*.ts
  core.test.ts
```

## Contrato

```ts
OperationResult<T> =
  | { success: true; data: T; events: DomainEvent[]; notifications: ...; warnings?: string[] }
  | { success: false; error: { code; message; details? }; ... }

OperationContext = {
  channel: 'panel' | 'voice' | 'qr' | 'photo' | 'import' | 'system' | 'whatsapp_future'
  actorAuthUserId?, actorMembershipId?,
  organizationId?, condominiumId?,  // opcional até isolamento M5+
  actorDisplayName?, actorRole?
}
```

Eventos em memória (`publishDomainEvents`) — **sem tabela** Event Store.

---

## Operações implementadas (Etapa 1)

| Operação | Origem da regra | Consumidores atuais | Persistência |
|----------|-----------------|---------------------|--------------|
| `identify_resident` | phoneNormalizer + unitFormatter + lógica voz App | Core puro; disponível para futuros canais | nenhuma |
| `identify_unit` | `utils/unitFormatter` | Core puro | nenhuma |
| `create_package` | `savePackage` + resolução residente | App: modal, import, voz, QR/foto channel | `dataService.savePackage` |
| `pickup_package` | `handleDeliverPackage` + `updatePackage` | App: entrega | `dataService.updatePackage` |
| `create_occurrence` | `saveOccurrence` | App: modal + voz | `dataService.saveOccurrence` |
| `update_occurrence` | `updateOccurrence` | App: resolver / detalhe / mensagens | `dataService.updateOccurrence` |
| `create_reservation` | `saveReservation` + conflito de `App.hasTimeConflict` | App: nova reserva | `dataService.saveReservation` |
| `cancel_reservation` | `deleteReservation` | App: excluir reserva | `dataService.deleteReservation` |
| `get_boleto` | `getBoletos` + filtros | Core API (UI ainda pode chamar dataService direto) | `dataService.getBoletos` |
| `notify_resident` | `createNotification` | Core API; inbox only | `notificationService` |

---

## Contexto obrigatório futuro

```
OperationContext {
  channel, actor, auth_user_id?, membership?,
  organization_id?, condominium_id?,
  input: text|audio|image|qr|barcode|structured
}
```

IDs piloto M4 (referência runbook, não hardcode em SQL):

- organization: `0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928`
- condominium: `3f383313-5ec0-4d21-97c7-1b2500c933be`

**LIMITATION (painel legado):** operações **não falham** sem tenant hoje (`warning: TENANT_CONTEXT_ABSENT`).  

**DECISÃO ETAPA 3 (CLOSED):** na **API externa** o tenant é **fail-closed**; o Core usará dual-mode (`enforceTenant` para canais integração). Ver `SENTINELA-ETAPA-3-DECISIONS-2026-08-14.txt` DR5. Sem migration nesta etapa.

---

## Eventos (não persistidos)

`package.created` · `package.picked_up` · `occurrence.created` · `occurrence.updated` · `reservation.created` · `reservation.cancelled`

Preparados para futuro Event Store / n8n — **sem INSERT em nova tabela**.

---

## Reservas — conflito

Centralizado em `domain/reservationConflict.ts` (mesma matemática do `hasTimeConflict` do App).

**LIMITATION:** `RESERVATION_CONFLICT_CLIENT_ONLY` — lista de slots vem do caller; **sem** constraint no Postgres nesta etapa. Sem migration.

Cancelamento = delete (comportamento atual). Sem aprovação formal.

---

## Notificações

`notify_resident` grava inbox e declara intent `whatsapp_future` **sem** enviar WhatsApp.

`create_package` continua criando inbox **dentro** de `savePackage` (comportamento preservado).

---

## Testes

`npm run test:run -- sentinela/core/core.test.ts`

Cenários: identify id/phone/ambíguo; unit ok/missing/catalog; create_package ok/validation/tenant warning; pickup ok/duplicate/auth.

---

## Preparado para n8n / WhatsApp

- Contrato `OperationResult` estável
- `channel: 'whatsapp_future'`
- `identify_resident` por telefone
- Eventos em memória
- **Não** implementar webhook nesta etapa

---

## Confirmação

```
DATABASE CHANGES = 0
MIGRATIONS EXECUTED = 0
WHATSAPP = NOT IMPLEMENTED
N8N = NOT IMPLEMENTED
NEW PANEL = NOT IMPLEMENTED
```
