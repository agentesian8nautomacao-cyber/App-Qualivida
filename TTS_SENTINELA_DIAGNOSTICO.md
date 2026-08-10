## Diagnóstico TTS Sentinela — Gestão Qualivida

### 1. Onde o texto vira áudio

- **Sentinela (Interface Neural / `AiView.tsx`)**
  - Antes: fluxo de voz usava **Web Speech API**:
    - Reconhecimento: `window.SpeechRecognition / webkitSpeechRecognition`.
    - TTS: `window.speechSynthesis` + `SpeechSynthesisUtterance`, com humanização via `splitIntoSpeakableChunks` / `humanizeTextForSpeech`.
    - Resultado: voz dependente das vozes instaladas no navegador/SO → **timbre robótico**, inconsistente entre máquinas.
  - Agora: fluxo de voz usa **apenas Gemini Live (native audio)**:
    - Hook: `useLiveVoiceConversation` (`hooks/useLiveVoiceConversation.ts`).
    - Entrada: áudio do microfone (Web Audio API) em PCM16 → enviado a `GoogleGenAI().live.connect`.
    - Saída: áudio base64 (`msg.serverContent.modelTurn.parts[0].inlineData.data`) → decodificado com `AudioContext` e reproduzido por `createBufferSource`.
    - **Nenhum uso de `speechSynthesis` ou `SpeechSynthesisUtterance` permanece no projeto.**

### 2. Comparação com Nutri.ai (paridade)

- **Engine**
  - Ambos os projetos usam `GoogleGenAI().live.connect` (Gemini Live API) no hook `useLiveVoiceConversation`.
- **Modelo**
  - `model: "gemini-2.5-flash-native-audio-preview-09-2025"` em ambos.
- **Voz prebuilt**
  - Helper compartilhado `getGeminiVoiceName(gender, style)` (`utils/voiceConfig.ts`) mapeia:
    - Masculino / sério → Fenrir
    - Masculino / animado → Puck
    - Feminino / sério → Kore
    - Feminino / animado → Aoede
  - `AiView.tsx` usa `activeGeminiVoiceName = getGeminiVoiceName(voiceGender, voiceStyle)` e passa isso como `voiceName` para o hook:

```150:166:components/views/AiView.tsx
const {
  isConnected: liveIsConnected,
  isMicOn: liveIsMicOn,
  volume: liveVolume,
  status: liveStatus,
  secondsActive: liveSecondsActive,
  isLimitReached: liveIsLimitReached,
  loggedItem: liveLoggedItem,
  start: liveStart,
  stop: liveStop,
  toggleMic: liveToggleMic,
} = useLiveVoiceConversation({
  apiKey: ((import.meta as any).env?.VITE_GEMINI_LIVE_KEY as string) || '',
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  voiceName: activeGeminiVoiceName,
  systemInstruction: liveSystemInstruction,
  timeLimitSeconds: 15 * 60,
  contextData: liveContextData,
  enableLogMealTool: false,
});
```

- **Idioma e persona**
  - `systemInstruction` é montado com:
    - Instruções internas (`getInternalInstructions`).
    - Personalização do agente (`aiName`, instruções externas configuráveis).
    - Bloco de fala em PT‑BR com orientação de frases curtas, tom conversacional.
  - `contextData` usa o mesmo padrão do Nutri.ai: agrega dados em tempo real (ocorrências, avisos, chat etc.).

Conclusão: **engine, modelo de voz, idioma e fluxo de áudio do Sentinela agora são equivalentes ao Nutri.ai.**

### 3. Eliminação de fallback robótico

- **Código antigo (removido)**
  - Existia um fluxo em `AiView.tsx` que fazia:
    - `fetch('/api/ai')` com `action: 'chat'`.
    - TTS via `window.speechSynthesis` / `SpeechSynthesisUtterance` com seleção de voz por gênero.
  - Esse caminho foi integralmente removido:
    - Não há mais referências a `speechSynthesis`, `SpeechSynthesisUtterance`, `getVoices` em `components/`, `hooks/` ou `App.tsx`.
    - `utils/speechHumanize.ts` permanece apenas como utilitário isolado, **não importado em lugar nenhum**.

- **Comportamento atual**
  - Se a chave do Live (`VITE_GEMINI_LIVE_KEY`) estiver ausente ou inválida:
    - `useLiveVoiceConversation` **não tenta** usar nenhuma voz do navegador:

```204:224:hooks/useLiveVoiceConversation.ts
const initSession = async () => {
  const apiKeyTrim = (apiKey || '').trim();
  if (!apiKeyTrim) {
    setStatus("Chave não configurada (VITE_GEMINI_LIVE_KEY)");
    console.warn('[LiveVoice] TTS neural: chave ausente. Configure VITE_GEMINI_LIVE_KEY no .env.local e no Vercel. Nenhum fallback para voz do navegador.');
    return;
  }

  try {
    setStatus("Conectando...");
    const ai = new GoogleGenAI({ apiKey: apiKeyTrim });
    console.info('[LiveVoice/TTS] Engine=GeminiLive', {
      engine: 'Gemini Live (native audio)',
      model,
      voiceName,
      sampleRateIn: 16000,
      sampleRateOut: 24000,
      noBrowserTTS: true,
    });
    // ...
```

  - Se não houver áudio retornado pelo modelo, **nenhum som é reproduzido**; não existe qualquer caminho que chame `speechSynthesis`.

### 4. Alternância de gênero e recriação de sessão

- O gênero/estilo da voz é configurado em `AppConfigContext` e exposto em `AiView` como:

```68:72:components/views/AiView.tsx
const voiceSettings: VoiceSettings = { 
  gender: config.aiConfig?.voiceGender ?? 'male', 
  style: config.aiConfig?.voiceStyle ?? 'serious' 
};
```

- O helper `getGeminiVoiceName` traduz `(gender, style)` → `activeGeminiVoiceName`.
- `useLiveVoiceConversation` recebe `voiceName` como dependência da `useEffect` que inicia a sessão:

```218:259:hooks/useLiveVoiceConversation.ts
useEffect(() => {
  if (!started) return;
  if (isLimitReached) { /* ... */ }

  const initSession = async () => {
    // usa model, voiceName, systemInstruction, contextData ...
  };

  initSession();

  return () => {
    cleanup();
  };
}, [
  started,
  apiKey,
  model,
  voiceName,
  systemInstruction,
  contextData,
  logMealTool,
  isMicOn,
  cleanup,
  isLimitReached,
  enableLogMealTool,
  onLogMeal,
]);
```

- Quando o usuário troca **gênero** ou **estilo** no modal de voz do Sentinela:
  - `voiceSettings` muda.
  - `activeGeminiVoiceName` muda.
  - A `useEffect` no hook roda novamente:
    - chama `cleanup()` (encerra sessão corrente, para todos buffers/áudios),
    - abre nova sessão `live.connect` com o **novo `voiceName`**.

Resultado: a instância de áudio é recriada com a voz correta sempre que o gênero/estilo é alterado.

### 5. Logs de prova (engine, modelo, voz, gênero)

- **Ao iniciar o modo Sentinela Live** (`AiView.tsx`):

```277:286:components/views/AiView.tsx
const startLiveMode = async () => {
  setIsLiveConnecting(true);
  setIsLiveActive(true);
  // Log de prova: engine única é Gemini Live; gênero/estilo aplicados à voz
  console.info('[Sentinela/TTS] Iniciando canal de voz', {
    engine: 'Gemini Live (native audio)',
    voiceName: activeGeminiVoiceName,
    gender: voiceSettings.gender,
    style: voiceSettings.style,
    noBrowserTTS: true,
  });
  liveStart();
};
```

- **Ao conectar no Gemini Live** (`useLiveVoiceConversation`):

```204:224:hooks/useLiveVoiceConversation.ts
console.info('[LiveVoice/TTS] Engine=GeminiLive', {
  engine: 'Gemini Live (native audio)',
  model,
  voiceName,
  sampleRateIn: 16000,
  sampleRateOut: 24000,
  noBrowserTTS: true,
});
```

- **Ao reproduzir áudio neural**:

```278:295:hooks/useLiveVoiceConversation.ts
const audioData =
  msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
if (audioData && outputAudioContextRef.current) {
  const ctx = outputAudioContextRef.current;
  const buffer = await decodeAudioData(audioData, ctx);
  // ...
  activeSourcesRef.current.add(source);
  source.onended = () => activeSourcesRef.current.delete(source);
  // Prova: TTS é 100% neural (Gemini Live). Nenhum fallback para voz do navegador.
  if ((import.meta as any)?.env?.DEV) {
    console.info('[LiveVoice/TTS] Playback=neural', { duration: buffer.duration });
  }
}
```

- **Status exibido no overlay do Sentinela**:

```406:420:components/views/AiView.tsx
<span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.5em] text-cyan-400/90">
  {isLiveConnecting
    ? 'Sincronizando...'
    : liveIsConnected
      ? (liveIsMicOn ? 'Canal ativo — Fale agora' : 'Canal ativo — Microfone em pausa')
      : liveStatus || `Voz: ${activeGeminiVoiceName} (${voiceSettings.style})`}
</span>
```

### 6. Resumo do diagnóstico

- **Onde estava a inconsistência**
  - O Sentinela originalmente usava **Web Speech API** para TTS, diferente do Nutri.ai que usa **apenas Gemini Live**.
  - Isso fazia o Qualivida depender da voz local do navegador/SO → timbre robótico e inconsistente.

- **Qual fallback estava ativo**
  - Em caso de erro na IA, o código podia cair em mensagens faladas pela voz padrão do navegador (via `speechSynthesis`).
  - Esse fluxo foi totalmente removido; hoje, **nenhuma parte do app usa Web Speech para TTS**.

- **Quais arquivos foram alterados**
  - `components/views/AiView.tsx`
    - Removido fluxo de TTS via Web Speech / `/api/ai`.
    - Integrado `useLiveVoiceConversation` com `voiceName = activeGeminiVoiceName`.
    - Ajustado overlay do Sentinela para refletir o estado do Gemini Live.
    - Adicionados logs estruturados da engine/voz/gênero.
  - `hooks/useLiveVoiceConversation.ts`
    - Adicionado bloqueio quando `apiKey` do Live está ausente (`VITE_GEMINI_LIVE_KEY`).
    - Adicionados logs de engine/modelo/voz e prova de playback neural.
  - `utils/voiceConfig.ts`
    - Mantido mapeamento de gênero/estilo → Fenrir/Puck/Kore/Aoede (paridade com Nutri.ai).

- **Por que antes a voz era robótica**
  - Porque o TTS do Sentinela vinha da **Web Speech API** (voz do navegador/Windows), não da engine neural do Gemini.
  - Mesmo com IA respondendo corretamente (texto bom), a última etapa (transformar texto em áudio) usava um motor diferente do Nutri.ai.

- **Situação atual (esperada)**
  - Sentinela:
    - **Engine**: Gemini Live (native audio).
    - **Modelo**: `gemini-2.5-flash-native-audio-preview-09-2025`.
    - **Voz**: Fenrir/Puck/Kore/Aoede, conforme gênero/estilo.
    - **Fallback**: nenhum caminho usa voz padrão do navegador; se o Live falhar, **não há som**.
  - Nutri.ai:
    - Mesmo hook, mesmo modelo, mesmo fluxo de áudio.

