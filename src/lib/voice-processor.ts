/**
 * Inline AudioWorklet processor for PCM capture.
 * Registered as a blob URL so no separate file is needed.
 */
export const WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); }
  process(inputs, outputs, parameters) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.port.postMessage(input.buffer, [input.buffer]);
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;
