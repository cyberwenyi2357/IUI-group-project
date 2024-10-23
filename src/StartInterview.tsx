import * as React from "react";
import {useRef,useState} from "react";

const StartInterview=()=>{
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const chunks = useRef<Blob[]>([]);
    const [audioBlob, setAudioBlob] = useState<Blob|null>(null);
    const [isRecording, setRecording] = useState<boolean>(false);
    const streamingAudio= async (blob)=>{

    }
    const StartRecording= async() => {
        try {
            //open microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                chunks.current.push(event.data);
            };
if(mediaRecorderRef.current) {
    mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunks.current, { type: "audio/wav" });
        setAudioBlob(blob);
        chunks.current = [];
        //streaming the audio and select key point
        await streamingAudio(blob);
    };

    mediaRecorderRef.current.start();
    setRecording(true);
}

        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };
}



export default StartInterview;

