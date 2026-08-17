# SENTINELA AUT. — Funcionalidades reutilizáveis

**Etapa 0** — inventário somente. Sem implementação.  
**Critério:** Reutilizar = adaptar in-place. Refatorar = extrair/alinhar sem segundo módulo. Reescrever = só se não houver equivalente.

Legenda: **S** = Sim · **N** = Não · **P** = Parcial

| Funcionalidade | Já existe | Localização | Reutilizar | Refatorar | Reescrever |
|---|---|---|---|---|---|
| Login staff (porteiro/síndico) | S | `components/Login.tsx`, `services/userAuth.ts` | S | P (membership M3) | N |
| Login/cadastro morador web | S | `ResidentRegister.tsx`, `residentAuth.ts` | S (identidade) | S (desligar painel depois) | N |
| Sessão / recovery senha | S | `ForgotPassword.tsx`, `checkUserSession` | S | N | N |
| Convite staff | S | `api/staff-invite.ts`, `AcceptStaffInvitePage.tsx` | S | N | N |
| Convite morador | S | `api/resident-invite.ts`, `AcceptResidentInvitePage.tsx` | S | N | N |
| Layout / menu / header | S | `components/Layout.tsx` | S | P (marca SENTINELA) | N |
| Dashboard porteiro | S | `components/views/DashboardView.tsx`, `RecentEventsBar.tsx` | S | S (foco “agora”) | N |
| Dashboard síndico | S | `SindicoDashboardView.tsx` | S | P (KPIs automação depois) | N |
| Dashboard morador | S | `MoradorDashboardView.tsx` | P | S (canal WA futuro) | N |
| RBAC catálogo | S | `roles`, `permissions`, `role_permissions`; `permissionsService.ts` | S | S (sem 2º RBAC) | N |
| Matriz de permissões UI | S | `AdminPermissionsView.tsx` | S | N | N |
| Bypass SINDICO all-keys | S | `AuthContext.tsx`, `useHasPermission.ts` | N (como desenho final) | S | N |
| CRUD moradores | S | `ResidentsView.tsx`, `dataService.saveResident` | S | P (`unit` → `units`) | N |
| Unidade (string) | S | `residents.unit`, `utils/unitFormatter.ts` | S (transição) | S | N |
| Catálogo `units` | S (schema vazio) | M2 `public.units` | S | S (popular/ligar) | N |
| Telefone / WhatsApp morador | S | campos resident + `phoneNormalizer.ts` | S | N | N |
| Identificação QR → unidade/morador | S | `CameraScanModal.tsx` (jsQR) | S | P (site scope) | N |
| Registrar encomenda (form) | S | `NewPackageModal`, `savePackage` | S | S (extrair Core) | N |
| Encomenda por foto | S | `CameraScanModal` photo + `image_url` | S | P (Storage vs base64) | N |
| Encomenda por voz | S | `sentinela/LiveConversation` → `App.handleVoiceEventPersist` | S | S (Core, não App) | N |
| Encomenda por QR | S | `CameraScanModal` modo qr | S | N | N |
| Encomenda por barcode | N | — (barcode só boletos) | — | — | S (op. nova; reusar câmera) |
| Itens de encomenda | S | `package_items`, `PackageItem` | S | N | N |
| Retirada / pickup | S | `handleDeliverPackage`, `updatePackage`, `receiptAt` | S | S (Core `pickup_package`) | N |
| Hide encomenda (morador) | S | `hidePackageForResident` | S | N | N |
| Lista / histórico encomendas | S | `PackagesView.tsx` | S | N | N |
| Export PDF/CSV encomendas | S | `utils/exportPackages.ts` | S | N | N |
| Import lote encomendas | S | `ImportPackagesModal.tsx` | S | N | N |
| Notificação inbox (package) | S | `notificationService.ts` no save | S | P (consumidor de evento) | N |
| WhatsApp manual pós-encomenda | S | `openWhatsApp` + templates settings | P | S (API real depois) | N |
| Templates WhatsApp | S | `WhatsAppTemplatesSection.tsx` | S | P (n8n) | N |
| Número WA condomínio | S | `CondominiumWhatsAppSection.tsx` | S | N | N |
| CRUD ocorrências | S | `OccurrencesView`, `NewOccurrenceModal`, `saveOccurrence` | S | S (Core) | N |
| Status ocorrência | S | Aberto / Em Andamento / Resolvido | S | N | N |
| Prioridade ocorrência | N | só `Notice.priority` | — | — | P (estender modelo depois) |
| Chat ocorrência | S | `OccurrenceMessage` / DetailModals | S | N | N |
| Anexo ocorrência | S | `imageUrl` | S | P (multi-file/storage) | N |
| Ocorrência por voz | S | mesmo bridge Sentinela | S | S (Core) | N |
| Soft-delete ocorrência | S | migrations + dataService | S | N | N |
| Áreas comuns | S | `areas`, `getAreas` | S | N | N |
| CRUD reservas | S | `ReservationsView`, `saveReservation` | S | S (Core) | N |
| Conflito de horário | P | `hasTimeConflict` no client (`App.tsx`) | P | S (constraint DB) | N |
| Aprovação formal reserva | N | fluxo scheduled/active/completed | — | S | N |
| Cancelamento reserva | P | `deleteReservation` | P | S (`cancel_reservation`) | N |
| Trigger reserva↔auth morador | S | `enforce_reservation_resident_from_auth` | S | N | N |
| Import/consulta boletos | S | `BoletosView`, `ImportBoletosModal`, extractors | S | P (unificar PDF services) | N |
| PDF boleto Storage | S | bucket `boletos`, `documentosService` | S | N | N |
| Associação boleto↔morador | S | `boletos.resident_id` | S | P (unidade/site) | N |
| Barcode boleto | S | campo `Boleto` + extração | S | N | N |
| Geração bancária boleto | N | — | — | — | N (fora do escopo imediato) |
| Inbox notificações | S | `notificationService`, tabela `notifications` | S | P (não virar event store) | N |
| UI NotificationsView | P | arquivo existe; tab removida (`return null`) | P | S (reexpor no painel) | N |
| Visitantes | S | `VisitorsView`, `NewVisitorModal` | S | N | N |
| Avisos / mural | S | `NoticesView` | S | N | N |
| Chat mural | S | `chat_messages` via dataService | S | N | N |
| Staff CRUD | S | `StaffView`, `saveStaff` | S | P (role vs `roles.name`) | N |
| Config condomínio | S | `AppConfigContext`, `app_config` | S | P (ligar a `condominiums`) | N |
| Tema dark/light | S | `index.html` CSS vars, `themeConfig.ts` | S | P (logo SENTINELA) | N |
| Logo / paleta SENTINELA AUT. | N | **LOGO/PALETA PENDENTE** | — | — | S (quando logo existir) |
| Favicon / PWA Qualivida | S | `public/1024.png`, `manifest.json` | P | S (rename) | N |
| Realtime listas | S | `App.tsx` channels packages/visitors/occurrences/notices | S | P (filtrar por site) | N |
| Offline / outbox | S | `offlineDb.ts`, `offlineDataService.ts` | S | P (comandos Core) | N |
| Auditoria admin | S | `admin_audit_logs`, `adminAudit.ts` | S | P (auditoria operacional) | N |
| Tab Sentinela chat | S | `sentinela/components/ChatAssistant.tsx` | S | S (intenção → Core) | N |
| Tab Sentinela voz | S | `LiveConversation.tsx`, `useLiveVoiceConversation.ts` | S | S | N |
| Views Nutri leftover | S | ~14 componentes `sentinela/components/*` não montados | N | S (não usar) | N |
| `geminiService` triplicado | S | `services/`, `components/`, `sentinela/services/` | P (só o operacional) | S (unificar) | N |
| Prompt “Você é o Sentinela” | S | `services/ai/internalInstructions.ts` | S | P | N |
| Organization / site (M1+M4) | S | `organizations`, `condominiums` + seed piloto | S | N | N |
| `tenant_memberships` | S (0 rows) | M3 | S | S (backfill M11) | N |
| Isolamento RLS tenant | N | M12–M14 planejados | — | S (plano Fase 1) | N |
| Operational Core API | N | regras hoje em App + dataService | — | S (extrair) | N |
| n8n | N | só docs Operaut | — | — | S (orquestrador, não domínio) |
| WhatsApp Cloud API | N | só `wa.me` | — | — | S (via n8n) |
| Event store / package.registered | N | spec Operaut | — | — | S (pós isolamento) |
| Edge Functions operacionais | N | — | — | — | P (se Core for edge) |
| Painel “exceções de automação” | N | — | — | — | S (depois do Core) |

**Resumo**

| Classe | Qtd (aprox.) |
|--------|----------------|
| Reutilizar direto | Maioria dos módulos de domínio (encomendas, moradores, ocorrências, reservas base, boletos import, staff, RBAC catálogo, dashboards) |
| Refatorar (não duplicar) | App.tsx, dataService, RBAC bypass, unit string, WhatsApp wa.me, Sentinela Nutri, conflitos reserva, gemini/PDF duplicados |
| Reescrever / criar novo | Core como fachada, n8n, WA API, barcode encomenda, event store, logo SENTINELA, painel de exceções de automação |

**Anti-padrões a evitar**

- `packages_v2`, `residentsService2`, novo módulo de reservas  
- Segundo catálogo RBAC  
- n8n → `INSERT packages`  
- DROP de `residents` porque “morador não usa o painel”
