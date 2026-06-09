import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpeechPracticeItem } from "../types";

type SpeechAvailability = "supported" | "unsupported";

export const SPEECH_RATE = {
  default: 0.92,
  max: 1.15,
  min: 0.1,
  step: 0.05,
} as const;

const QUEUE_GAP_MS = 240;

export function useKoreanSpeech() {
  const availability: SpeechAvailability =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
      ? "supported"
      : "unsupported";

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [rate, setRawRate] = useState<number>(SPEECH_RATE.default);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (availability !== "supported") {
      return undefined;
    }

    const loadVoices = () => {
      const nextVoices = window.speechSynthesis.getVoices();
      setVoices(nextVoices);
      setSelectedVoiceURI((currentVoiceURI) => {
        if (currentVoiceURI) {
          return currentVoiceURI;
        }
        return pickKoreanVoice(nextVoices)?.voiceURI ?? "";
      });
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [availability]);

  const selectableVoices = useMemo(() => {
    const koreanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ko"));
    return koreanVoices.length > 0 ? koreanVoices : voices;
  }, [voices]);

  const hasKoreanVoice = useMemo(
    () => voices.some((voice) => voice.lang.toLowerCase().startsWith("ko")),
    [voices],
  );

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === selectedVoiceURI) ?? null,
    [selectedVoiceURI, voices],
  );

  const setRate = useCallback((nextRate: number) => {
    setRawRate(clampSpeechRate(nextRate));
  }, []);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    if (availability === "supported") {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setCurrentItemId(null);
  }, [availability]);

  const speakInternal = useCallback(
    (item: SpeechPracticeItem, runId: number) =>
      new Promise<void>((resolve) => {
        if (availability !== "supported" || runIdRef.current !== runId) {
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(item.korean);
        utterance.lang = "ko-KR";
        utterance.rate = rate;
        utterance.voice = selectedVoice;

        utterance.onend = () => {
          resolve();
        };
        utterance.onerror = () => {
          resolve();
        };

        setCurrentItemId(item.id);
        window.speechSynthesis.speak(utterance);
      }),
    [availability, rate, selectedVoice],
  );

  const playOne = useCallback(
    async (item: SpeechPracticeItem) => {
      if (availability !== "supported") {
        return;
      }

      window.speechSynthesis.cancel();
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setIsPlaying(true);

      try {
        await speakInternal(item, runId);
      } finally {
        if (runIdRef.current === runId) {
          setIsPlaying(false);
          setCurrentItemId(null);
        }
      }
    },
    [availability, speakInternal],
  );

  const playQueue = useCallback(
    async (items: SpeechPracticeItem[], startItemId?: string) => {
      if (availability !== "supported" || items.length === 0) {
        return;
      }

      const startIndex = startItemId
        ? Math.max(
            0,
            items.findIndex((item) => item.id === startItemId),
          )
        : 0;
      const queue = items.slice(startIndex);

      window.speechSynthesis.cancel();
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setIsPlaying(true);

      try {
        for (const item of queue) {
          if (runIdRef.current !== runId) {
            break;
          }

          await speakInternal(item, runId);
          if (runIdRef.current !== runId) {
            break;
          }
          await wait(QUEUE_GAP_MS);
        }
      } finally {
        if (runIdRef.current === runId) {
          setIsPlaying(false);
          setCurrentItemId(null);
        }
      }
    },
    [availability, speakInternal],
  );

  return {
    availability,
    currentItemId,
    hasKoreanVoice,
    isPlaying,
    playOne,
    playQueue,
    rate,
    selectableVoices,
    selectedVoiceURI,
    setRate,
    setSelectedVoiceURI,
    stop,
  };
}

function pickKoreanVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "ko-kr") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")) ??
    null
  );
}

function clampSpeechRate(rate: number) {
  return Math.min(SPEECH_RATE.max, Math.max(SPEECH_RATE.min, rate));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
