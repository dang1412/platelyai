"use client";

import { useState } from "react";
import { useSpeechInput } from "@/lib/useSpeechInput";

export default function SearchBar({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (v: string) => void;
}) {
  // Giữ giá trị đang gõ ở local; chỉ commit (gọi onSearch) khi nhấn Enter
  // hoặc khi blur (click ra ngoài). Không gọi API trong lúc gõ.
  const [text, setText] = useState(value);

  // Đồng bộ khi query bị thay đổi từ bên ngoài bằng pattern "chỉnh state lúc render"
  // (React khuyến nghị, thay cho useEffect) — so prop trước để chỉ reset khi value đổi.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  const commit = (v: string = text) => {
    if (v !== value) onSearch(v);
  };

  // Nhập bằng giọng nói (STT): cập nhật ô input khi đang nói, tự tìm khi nói xong.
  const { supported, listening, start, stop } = useSpeechInput({
    lang: "vi-VN",
    onResult: (transcript, isFinal) => {
      setText(transcript);
      if (isFinal) commit(transcript);
    },
  });

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
        🔍
      </span>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="Tìm bằng câu tự nhiên (vd: quán bún ngon gần VinUni 40k)…"
        className={`w-full rounded-full border border-zinc-300 bg-white py-3 pl-11 text-zinc-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${supported ? "pr-12" : "pr-4"}`}
      />
      {supported && (
        <button
          type="button"
          onClick={() => (listening ? stop() : start())}
          aria-label={listening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
          title={listening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
          className={`absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition ${
            listening
              ? "animate-pulse bg-red-500 text-white"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          🎤
        </button>
      )}
    </div>
  );
}
