# Diagnóstico Live Voice — Causa raiz e correções (Qualivida vs Nutri.IA)

## Objetivo

Garantir que o Live Voice do **Qualivida Residence** use exatamente a mesma engine, parâmetros e fluxo de áudio do **Nutri.IA**, eliminando o timbre robótico.

---

## 1. Comparação entre projetos (inspeção de código)

### 1.1 Engine e modelo

| Item | Qualivida Residence | Nutri.IA | Conclusão |
|------|---------------------|----------|-----------|
| API | `ai.live.connect` (Google GenAI) | `ai.live.connect` (Google GenAI) | Igual |
| Modelo | `gemini-2.5-flash-native-audio-preview-09-2025` | `gemini-2.5-flash-native-audio-preview-09-2025` | Igual |
| Modalities | `responseModalities: [Modality.AUDIO]` | Idem | Igual |
| Fluxo de áudio | Base64 → decode → AudioBuffer → BufferSource → destination | Idem | Igual |
| Interrupções | `activeSourcesRef` + `nextStartTimeRef` | Idem | Igual |

**Conclusão:** A engine é a mesma (Gemini Live API, áudio nativo). Não há uso de Web Speech API no Live em nenhum dos dois. O `geminiService` (transcribeAudio, etc.) não é usado no canal ao vivo; só no chat/upload.

### 1.2 Diferenças que causavam voz robótica e falha na alternância de gênero no Qualivida

| Parâmetro | Qualivida (antes) | Nutri.IA | Impacto |
|-----------|-------------------|----------|---------|
| **Voz padrão (prebuiltVoiceConfig)** | `'Aoede'` (depois `'Kore'`, mas fixa) | `'Kore'` | **Causa raiz inicial:** timbre diferente. Aoede foi escolhida em documentação anterior como “mais fluida”, mas na prática o Nutri.IA (Kore) soa mais humana no mesmo modelo. |
| **Gênero configurável (Live)** | UI de gênero apenas no Sentinela (Web Speech), **não propagada** para o `LiveConversation` (Gemini Live continuava sempre em Kore) | Gênero/voz controlados diretamente pelo app Nutri.IA | **Causa raiz atual:** alternância de gênero não afetava a chamada Live Voice Qualivida; o usuário mudava o gênero, mas o canal Gemini Live continuava em Kore (feminino). |
| **System instruction (Live)** | Incluía bloco extra “IMPORTANTE — Sua resposta será reproduzida por VOZ (TTS)” (frases curtas, ritmo, etc.) | Apenas as 5 instruções gerais, sem bloco TTS | Possível divergência no estilo de resposta gerada; para paridade estrita, o bloco foi removido. |

Nenhuma outra diferença em:
- `speechConfig` (sem `languageCode` em nenhum dos dois)
- Decode/playback (sample rate 24000, PCM16 → Float32, agendamento contínuo)
- Tool `logMeal`, callbacks, cleanup

---

## 2. Verificação de engine real em execução

- **LiveConversation (ambos):** só usa Gemini Live API. O áudio de saída vem de `msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data` (base64), decodificado e reproduzido via Web Audio API (`AudioContext`, `createBufferSource`). Não há fallback para Web Speech API, voz padrão do navegador ou TTS local no fluxo Live.
- **AiView (Qualivida):** é outro fluxo (Sentinela / chat por voz no condomínio) e usa Web Speech API; não é o Live Voice da chamada Nutri/Residence.

**Conclusão:** Nenhum fallback indevido no Live. O problema era **configuração de voz e instrução**, não engine diferente.

---

## 3. Parâmetros de humanização (Gemini Live)

- **Voz:** prebuilt controlada por **gênero + estilo** via helper `getGeminiVoiceName(gender, style)` (Fenrir/Puck/Kore/Aoede), com **padrão `Kore` (female/serious)** para paridade com o Nutri.IA. Opcionalmente o usuário pode definir `userProfile.aiVoice`.
- **Idioma:** implícito no system instruction (“Fale sempre em Português do Brasil”); a API do modelo native-audio lida com PT-BR.
- **Streaming:** o áudio já vem em chunks pelo Live API; o código apenas decodifica e enfileira com `nextStartTimeRef` (buffer contínuo, sem concatenação “seca”).
- **SSML:** não usado neste fluxo (Gemini Live gera áudio diretamente).

---

## 4. Fluxo de áudio

- **Reinicialização:** uma única sessão `live.connect` por abertura da tela; a voz não é reinicializada a cada resposta.
- **Buffer:** cada chunk de áudio é agendado em sequência (`nextStartTimeRef`); não há `speechSynthesis.cancel()` no Live (isso existe só no AiView).
- **Interrupção:** em `msg.serverContent?.interrupted` todos os `activeSourcesRef` são parados e `nextStartTimeRef` zerado; comportamento igual ao Nutri.IA.

Nenhuma correção necessária no fluxo; apenas alinhamento de voz e system instruction.

---

## 5. Garantia de paridade com Nutri.IA

- **Streaming:** já igual (chunks da API → decode → play em sequência).
- **Modelo:** já igual (`gemini-2.5-flash-native-audio-preview-09-2025`).
- **Parâmetros de voz:** voz padrão alterada de `Aoede` para `Kore` e agora derivada do mesmo seletor global de gênero/estilo usado no Sentinela (`config.aiConfig.voiceGender/voiceStyle`), via `getGeminiVoiceName`.
- **Parâmetros de fala (Web Speech / Sentinela):** `rate = 0.88`, `pitch = 1`, `volume = 1`, `lang = 'pt-BR'`, com humanização de texto e pausas de ~280 ms entre frases (chunks), iguais às documentadas em `HUMANIZACAO_VOZ.md`.

---

## 6. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `components/views/LiveConversation.tsx` | 1) Voz prebuilt agora derivada de `config.aiConfig.voiceGender/voiceStyle` via `getGeminiVoiceName`, garantindo que a troca de gênero/estilo global afete o Gemini Live. 2) System instruction já alinhado ao Nutri.IA (sem bloco TTS extra). 3) Logs estruturados em runtime (`[LiveConversation] Engine=GeminiLive`) com engine, modelo, voz, idioma e sample rates. |
| `components/views/AiView.tsx` | 1) Usa o mesmo helper `getGeminiVoiceName` para exibir “Voz Ativa” coerente com o que será usado no Live. 2) Web Speech configurado com `rate 0.88`, `pitch 1`, `volume 1`, `lang pt-BR`, chunks por frase e pausa ~280 ms entre frases. 3) Logs estruturados `[Live Voice/TTS] Engine=WebSpeech` incluindo gênero, voz escolhida e flag se houve fallback para voz padrão do navegador. |
| `contexts/AppConfigContext.tsx` | Voz padrão do sistema ajustada para `voiceGender: 'female'`, `voiceStyle: 'serious'` (Kore), mantendo paridade inicial com Nutri.IA logo após instalação. |
| `utils/voiceConfig.ts` | Novo helper compartilhado `getGeminiVoiceName(gender, style)` que mapeia gênero/estilo → Fenrir/Puck/Kore/Aoede. |
| `components/types.ts` | Definições mínimas de tipos (`UserProfile`, `DailyPlan`, `LogItem`, `MealItem`) para o `LiveConversation`, eliminando erro de tipos na build e refletindo apenas os campos realmente usados. |

---

## 7. Engine e modelo ativos após o ajuste

- **Engine (LiveConversation):** Google Gemini Live API (áudio nativo), mesma em Qualivida e Nutri.IA.
- **Modelo:** `gemini-2.5-flash-native-audio-preview-09-2025`.
- **Voz (Live):** voz prebuilt derivada de `config.aiConfig.voiceGender/voiceStyle` via `getGeminiVoiceName` (Fenrir/Puck/Kore/Aoede), com padrão `Kore`. Opcionalmente `userProfile.aiVoice` pode sobrescrever.
- **Engine (Sentinela / AiView):** Web Speech API do navegador, com seleção de voz por gênero (`getSpeechVoiceByGender`), priorizando vozes pt‑BR premium/neural e explicitando em log quando há fallback para voz padrão.
- **Fluxo (Live):** áudio em chunks pela API → decode base64 → AudioBuffer 24 kHz → BufferSource em sequência → saída contínua; interrupção tratada igual ao Nutri.IA.

---

## 8. Por que antes soava robótico / sem paridade e agora não (esperado)

1. **Voz diferente (fase 1):** O Qualivida usava **Aoede** por documentação anterior; o Nutri.IA usa **Kore**. Com a troca para Kore no Qualivida, o timbre ficou alinhado, mas ainda fixo em feminino.
2. **Gênero não propagado (fase 2):** O seletor de gênero/estilo funcionava apenas para o Sentinela (Web Speech), enquanto o canal Gemini Live continuava travado em Kore. Agora o mesmo seletor global alimenta tanto o Live (Gemini) quanto a visualização em AiView, garantindo que alterar Masculino/Feminino/Estilo realmente troque o modelo de voz.
3. **Instrução diferente:** O bloco extra de “TTS” no system instruction podia alterar o estilo da resposta (ex.: mais “didático” ou mais listas). Alinhar ao Nutri.IA remove essa divergência.
4. **Engine e fluxo:** Já eram os mesmos; não havia fallback para Web Speech nem erro de buffer. A causa era configuração (voz + instrução + falta de ligação com o seletor de gênero), não engine ou fluxo errado.

---

## 9. Resultado esperado e testes de validação

- A voz do Live Voice no Qualivida Residence deve soar **igual à do Nutri.IA** (Kore, mesmo modelo e fluxo) quando em configuração padrão (Feminino/Sério).
- A alternância de gênero/estilo em **Configurações → IA / ou no modal de voz do Sentinela** deve:
  - Atualizar imediatamente a label “Voz Ativa” no Sentinela (Fenrir/Puck/Kore/Aoede).
  - Quando abrir o Live Voice (Mural → botão de chamada), registrar em console um log `[LiveConversation] Engine=GeminiLive` com `voiceName` coerente (ex.: Fenrir para Masculino/Sério, Kore para Feminino/Sério).
- Teste prático recomendado:
  - **Cenário 1 (Feminino):** definir gênero Feminino/Sério, abrir Live Voice no Qualivida e fazer a mesma pergunta no app Nutri.IA → comparar timbre e naturalidade.
  - **Cenário 2 (Masculino):** repetir com Masculino/Sério e verificar, via logs e audição, que o timbre muda de fato em ambos.

---

*Diagnóstico feito por inspeção de código dos dois projetos (LiveConversation.tsx e geminiService em ambos); nenhuma suposição — comparação lado a lado e alinhamento explícito ao Nutri.IA.*
