import * as React from "react";

const startInterview:React.FC = () => {
    type mergeBuffersProps ={
        lhs: Int16Array;
        rhs: Int16Array;
    };
    const mergeBuffers= ({ lhs, rhs }: mergeBuffersProps): Int16Array=>{
        const mergedBuffer = new Int16Array(lhs.length + rhs.length)
        mergedBuffer.set(lhs, 0)
        mergedBuffer.set(rhs, lhs.length)
        return mergedBuffer
    }
    const createMicrophone=()=>{
        let stream: MediaStream;
        let audioContext: AudioContext;
        let audioWorkletNode:AudioWorkletNode;
        let source: MediaStreamAudioSourceNode;
        let audioBufferQueue:Int16Array = new Int16Array(0);
        return {
            async requestPermission() {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            },
            async startRecording(onAudioCallback: (arg0: Uint8Array) => void) {
                if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContext = new AudioContext({
                    sampleRate: 16_000,
                    latencyHint: 'balanced'
                });
                source = audioContext.createMediaStreamSource(stream);

                await audioContext.audioWorklet.addModule('audio-processor.js');
                audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

                source.connect(audioWorkletNode);
                audioWorkletNode.connect(audioContext.destination);
                audioWorkletNode.port.onmessage = (event) => {
                    const currentBuffer = new Int16Array(event.data.audio_data);
                    audioBufferQueue = mergeBuffers({
                        lhs:audioBufferQueue,
                        rhs:currentBuffer
                        }
                    );

                    const bufferDuration =
                        (audioBufferQueue.length / audioContext.sampleRate) * 1000;
                    // wait until we have 100ms of audio data
                    if (bufferDuration >= 100) {
                        const totalSamples = Math.floor(audioContext.sampleRate * 0.1);

                        const finalBuffer = new Uint8Array(
                            audioBufferQueue.subarray(0, totalSamples).buffer
                        );

                        audioBufferQueue = audioBufferQueue.subarray(totalSamples)
                        if (onAudioCallback) onAudioCallback(finalBuffer);
                    }
                }
            },
            stopRecording() {
                stream?.getTracks().forEach((track) => track.stop());
                audioContext?.close();
                audioBufferQueue = new Int16Array(0);
            }
        }
    }
    return (
        <button style={{position: 'absolute', right: '3vw', top: '1vw', zIndex: 2}}>Start interview</button>
    );
    const run=async()=>{

    }
};


export default startInterview;

