# Humanização da Live Voice — Documentação

## 1. Engine utilizada

- **Stack:** **Web Speech API** (nativa do navegador).
- **APIs:** `window.speechSynthesis`, `SpeechSynthesisUtterance`, `speechSynthesis.getVoices()`.
- **Não utilizados neste fluxo:** ElevenLabs, Azure TTS, Google Cloud TTS, OpenAI TTS (apenas Web Speech no Live Voice do Sentinela em `AiView.tsx`).
- **Tipo de voz:** As vozes disponíveis dependem do SO/navegador. O código **prioriza vozes de melhor qualidade** quando existirem: Google, Microsoft, Natural, Premium, Neural, Online, Enhanced (regex em `getSpeechVoiceByGender`). Fallback para voz padrão pt-BR.

**Observação:** O componente `LiveConversation.tsx` usa **Google Gemini Live API** (áudio nativo) com voz prebuilt. A humanização também foi aplicada ali (ver § Arquitetura de áudio e § LiveConversation).

### Arquitetura de áudio no projeto

| Onde | O quê |
|------|--------|
| **LiveConversation.tsx** | Todo o áudio ao vivo: microfone, envio/recebimento via Gemini Live API, modelo de voz (TTS do assistente). Quem abre a tela (ex.: botão em NoticesView com `onLiveCall`) só chama `setIsLiveOpen(true)`; não processa áudio. |
| **geminiService.ts** | `transcribeAudio`: transcrição avulsa (ex.: upload de áudio). Não é usada no canal ao vivo. |
| **AiView.tsx** | Live Voice do Sentinela: Web Speech API para TTS da resposta da IA (chat por voz no condomínio). |

### Humanização em LiveConversation.tsx (Gemini Live)

- **Voz padrão:** **Kore** (paridade com o app Nutri.IA, onde a voz soa humanizada). O perfil do usuário pode sobrescrever com `userProfile.aiVoice`. Não usar Aoede neste fluxo para manter o mesmo timbre do Nutri.IA.
- **System instruction:** Alinhado ao Nutri.IA (instruções 1–5, sem bloco TTS extra), para garantir o mesmo comportamento de geração de fala.

---

## 2. Parâmetros finais de fala

| Parâmetro | Valor | Justificativa |
|-----------|--------|----------------|
| **rate** | `0.88` | Velocidade um pouco abaixo de 1 reduz sensação de leitura acelerada e melhora clareza e naturalidade. |
| **pitch** | `1` | Tom neutro evita entonação robótica ou metálica. |
| **volume** | `1` | Volume máximo; ajuste fino fica por conta do sistema. |
| **lang** | `pt-BR` | Idioma e variante para pronúncia e prosódia corretas. |
| **Pausa entre frases** | `280 ms` | Delay entre chunks (frases) para respiração e ritmo conversacional, sem SSML (não suportado no Chrome para `SpeechSynthesisUtterance`). |

---

## 3. Trechos de código alterados

### 3.1 `components/views/AiView.tsx`

- **Import:** adicionado `splitIntoSpeakableChunks` e `humanizeTextForSpeech` de `utils/speechHumanize`.
- **Persona (getSystemPersona):** incluído bloco **"INSTRUÇÕES PARA FALA"** para a IA gerar respostas com frases curtas, ritmo conversacional e linguagem natural quando a resposta for reproduzida por voz.
- **sendVoiceToAI:**
  - Resposta da IA é normalizada com `humanizeTextForSpeech(replyText)` e quebrada em chunks com `splitIntoSpeakableChunks(humanized)`.
  - Em vez de um único `SpeechSynthesisUtterance` com o texto inteiro, a fala é feita **por frase**, em sequência, com **pausa de 280 ms** entre cada chunk (`setTimeout` no `onend` do utterance).
  - Parâmetros de cada utterance: `rate = 0.88`, `pitch = 1`, `volume = 1`, `lang = 'pt-BR'`, mesma voz escolhida por gênero.
  - Callback `onSpeechDone` (reativar reconhecimento de voz) só é chamado ao terminar o **último** chunk, evitando cortes no meio da resposta.
  - Tratamento de `onerror` no utterance para seguir para o próximo chunk ou finalizar.

### 3.2 Novo arquivo `utils/speechHumanize.ts`

- **splitIntoSpeakableChunks(text):** quebra o texto em frases (`.!?\n`) e, se uma frase for longa (> 120 caracteres), subdivide por vírgula/ponto-e-vírgula/dois-pontos, mantendo chunks entre 10 e 120 caracteres para ritmo mais natural.
- **humanizeTextForSpeech(text):** normaliza espaços e pontuação (espaços em volta de `.,!?;:`) para evitar leitura truncada ou com pausas estranhas.

---

## 4. Justificativa técnica das escolhas

1. **Rate 0.88:** Valores próximos de 0.9–0.95 são comuns em TTS para “fala clara e não apressada”. 0.88 deixa a fala um pouco mais pausada, reduzindo sensação de robótico.
2. **Pitch 1:** Mantém o tom da voz sem alteração artificial; variações grandes de pitch em TTS costumam soar artificiais.
3. **Pausas entre frases (280 ms):** Como o Chrome não interpreta SSML em `SpeechSynthesisUtterance`, as pausas são implementadas com vários utterances em sequência e `setTimeout` no `onend`. 280 ms aproxima-se de pausas curtas entre frases em fala natural.
4. **Chunks por frase:** Falar um bloco único longo tende a soar como leitura contínua; quebrar por frase e dar uma pausa entre elas melhora prosódia e compreensão.
5. **Humanização do texto (persona + utils):** O modelo é instruído a produzir texto “falável” (frases curtas, ritmo conversacional). O pós-processamento em `speechHumanize` garante normalização e quebra adequada mesmo quando a resposta vier mais longa ou com pontuação atípica.
6. **Voz neural/premium:** O navegador expõe vozes “online” ou com nomes como Google/Microsoft/Natural; priorizá-las em `getSpeechVoiceByGender` usa as vozes de melhor qualidade disponíveis no ambiente do usuário (pt-BR).

---

## 5. Testes sugeridos (antes x depois)

| Aspecto | Antes (voz robótica) | Depois (voz humanizada) |
|--------|----------------------|--------------------------|
| **Naturalidade** | Leitura contínua, pouco ritmo | Frases com pausas, ritmo mais conversacional |
| **Entonação** | Monótona, velocidade uniforme | Velocidade 0.88 e pausas entre frases |
| **Conforto auditivo** | Fadiga em uso prolongado | Menos cansativo pelo ritmo e pausas |
| **Cortes** | Um único utterance longo | Vários utterances em sequência, sem cancel no meio |
| **Texto** | Sem orientação para fala | Persona pede frases curtas e linguagem natural |

**Como validar:** Ativar Live Voice no Sentinela (AiView), fazer uma pergunta que gere resposta de 2–4 frases e comparar: (1) uma única frase longa lida de uma vez vs (2) mesma resposta com frases separadas e pausas de 280 ms. Verificar também se, ao final da fala, o reconhecimento de voz volta a ouvir sem cortar a última frase.

---

## 6. Resultado esperado

- A voz soa mais **humana** e menos mecânica.
- **Ritmo** próximo ao de conversa real (frases curtas + pausas).
- Não parece **leitura mecânica** contínua.
- Uso contínuo mais **agradável** (velocidade e pausas adequadas).

Engine utilizada: **Web Speech API**. Parâmetros finais: **rate 0.88, pitch 1, volume 1, pt-BR, pausa 280 ms entre frases**. Alterações principais em **AiView.tsx** (persona + sendVoiceToAI) e novo **utils/speechHumanize.ts**.
