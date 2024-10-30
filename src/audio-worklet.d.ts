declare class AudioWorkletProcessor {
    constructor();
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean;
}

declare function registerProcessor(
    name: string,
    processorCtor: typeof AudioWorkletProcessor
): void;

interface AudioWorkletGlobalScope {
    registerProcessor: typeof registerProcessor;
}

declare var globalThis: AudioWorkletGlobalScope;