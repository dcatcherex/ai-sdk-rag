/**
 * AudioWorklet processor: converts browser mic audio to 16kHz 16-bit PCM
 * for Gemini Live API.
 *
 * Browser mic is typically 48kHz Float32. Gemini expects 16kHz Int16 PCM.
 * We accumulate samples and flush every ~250ms.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._targetSampleRate = 16000;
    this._flushIntervalFrames = Math.round((sampleRate * 0.25)); // flush every 250ms
    this._frameCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32 = input[0];

    // Downsample from sampleRate (e.g. 48000) to 16000
    const ratio = sampleRate / this._targetSampleRate;
    for (let i = 0; i < float32.length; i += ratio) {
      const sample = float32[Math.floor(i)];
      // Clamp and convert Float32 to Int16
      const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
      this._buffer.push(int16);
    }

    this._frameCount += float32.length;
    if (this._frameCount >= this._flushIntervalFrames) {
      this._frameCount = 0;
      if (this._buffer.length > 0) {
        const int16Array = new Int16Array(this._buffer);
        this.port.postMessage({ pcm: int16Array }, [int16Array.buffer]);
        this._buffer = [];
      }
    }

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
