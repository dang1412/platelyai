"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// STT bằng Web Speech API (SpeechRecognition) — chạy hẳn trong trình duyệt, miễn phí,
// không cần backend. Hỗ trợ tốt trên Chrome/Edge (cả Android); Firefox không có.

// Web Speech API chưa nằm trong lib DOM mặc định -> khai báo tối thiểu phần dùng tới.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: { readonly transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(opts: {
  lang?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
}) {
  const { lang = "vi-VN" } = opts;
  // Bắt đầu false để khớp SSR (server không có SpeechRecognition); bật sau khi mount
  // trong effect bên dưới — phát hiện API trình duyệt phải xảy ra sau hydration.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Giữ callback mới nhất trong ref để không phải tạo lại recognition mỗi render.
  const onResultRef = useRef(opts.onResult);
  useEffect(() => {
    onResultRef.current = opts.onResult;
  });

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true; // cập nhật text khi đang nói
    rec.continuous = false; // dừng sau khi user ngừng nói
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let transcript = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      onResultRef.current(transcript.trim(), isFinal);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);

    return () => {
      rec.onresult = rec.onend = rec.onerror = null;
      rec.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || listening) return;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() ném nếu đang chạy — bỏ qua.
    }
  }, [listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
