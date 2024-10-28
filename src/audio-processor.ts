// audio-processor.ts
const MAX_16BIT_INT = 32767;

class AudioProcessor extends AudioWorkletProcessor {
    process(inputs: Float32Array[][]): boolean {
        try {
            const input = inputs[0];
            if (!input) throw new Error('No input');

            const channelData = input[0];
            if (!channelData) throw new Error('No channelData');

            const float32Array = Float32Array.from(channelData);
            const int16Array = Int16Array.from(
                float32Array.map((n) => n * MAX_16BIT_INT)
            );
            const buffer = int16Array.buffer;

            // 使用 TypeScript 的类型断言来确保 buffer 是可转移的
            this.port.postMessage({ audio_data: buffer }, [buffer]);

            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}

registerProcessor('audio-processor', AudioProcessor);