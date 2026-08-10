// AudioWorkletProcessor para captura de áudio de microfone em streaming.
// - Copia o canal de entrada (mono) e envia via port.postMessage como Float32Array
// - Faz passthrough simples para a saída (evita silêncio caso conectado ao destino)

class LiveVoiceProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];

      // Envia uma cópia do frame para a thread principal
      this.port.postMessage(channel.slice(0));

      // Opcional: passthrough para a saída de áudio
      const output = outputs[0];
      if (output && output[0]) {
        output[0].set(channel);
      }
    }

    // Mantém o worklet rodando continuamente
    return true;
  }
}

registerProcessor('live-voice-processor', LiveVoiceProcessor);

