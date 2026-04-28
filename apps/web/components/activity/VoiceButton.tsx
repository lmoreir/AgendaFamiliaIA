"use client";

import { useState, useRef, useEffect } from "react";

type VoiceState = "idle" | "recording" | "processing";

interface VoiceButtonProps {
  onResult: (transcript: string) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function getSpeechRecognitionConstructor(): (new () => AnyRecognition) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceButton({ onResult }: VoiceButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<AnyRecognition>(null);

  useEffect(() => {
    if (!getSpeechRecognitionConstructor()) setSupported(false);
  }, []);

  function startRecording() {
    const SpeechRec = getSpeechRecognitionConstructor();
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setVoiceState("recording");

    recognition.onresult = async (event: AnyRecognition) => {
      const transcript: string = event.results[0][0].transcript;
      setVoiceState("processing");
      try {
        await onResult(transcript);
      } finally {
        setVoiceState("idle");
      }
    };

    recognition.onerror = () => setVoiceState("idle");

    recognition.onend = () =>
      setVoiceState((s) => (s === "recording" ? "idle" : s));

    recognition.start();
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  if (!supported) return null;

  function handleClick() {
    if (voiceState === "recording") stopRecording();
    else if (voiceState === "idle") startRecording();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={voiceState === "processing"}
      title={
        voiceState === "recording"
          ? "Parar gravacao"
          : "Criar atividade por voz"
      }
      className={[
        "flex h-10 w-10 items-center justify-center rounded-lg border transition-all",
        voiceState === "recording"
          ? "animate-pulse border-red-500 bg-red-50 text-red-600"
          : voiceState === "processing"
          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
          : "border-gray-200 bg-white text-gray-600 hover:border-brand-400 hover:text-brand-600",
      ].join(" ")}
    >
      {voiceState === "processing" ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 1 0 4 0V5a2 2 0 0 0-2-2zm-1 15.93V21h-2v-2.07A9 9 0 0 1 3 11h2a7 7 0 1 0 14 0h2a9 9 0 0 1-8 7.93z" />
        </svg>
      )}
    </button>
  );
}
