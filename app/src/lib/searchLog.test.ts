import { describe, expect, it } from "vitest";
import {
  formatLogLine,
  logFileName,
  type SearchLogEntry,
} from "./searchLog";

describe("logFileName", () => {
  it("trả YYYY-MM-DD.jsonl cho ngày thường", () => {
    expect(logFileName(new Date(2026, 5, 30))).toBe("2026-06-30.jsonl");
  });

  it("zero-pad tháng/ngày 1 chữ số", () => {
    expect(logFileName(new Date(2026, 0, 5))).toBe("2026-01-05.jsonl");
  });
});

describe("formatLogLine", () => {
  const entry: SearchLogEntry = {
    ts: "2026-06-30T10:00:00.000Z",
    userId: 42,
    q: "phở bò gần đây",
    location: "Hà Nội",
    deviceCoords: { lat: 21.0, lng: 105.8 },
    origin: { lat: 21.0, lng: 105.8 },
    parsed: {
      dishes: ["phở bò"],
      tags: [],
      location: "Hà Nội",
      maxPrice: null,
      wantsCheap: false,
    },
    resultCount: 3,
    error: null,
  };

  it("kết thúc bằng newline", () => {
    expect(formatLogLine(entry).endsWith("\n")).toBe(true);
  });

  it("round-trip JSON bằng entry gốc", () => {
    const parsed = JSON.parse(formatLogLine(entry).trimEnd());
    expect(parsed).toEqual(entry);
  });

  it("serialize ok với parsed/userId/origin null và error có message", () => {
    const e: SearchLogEntry = {
      ts: "2026-06-30T10:00:00.000Z",
      userId: null,
      q: "abc",
      location: null,
      deviceCoords: null,
      origin: null,
      parsed: null,
      resultCount: 0,
      error: "boom",
    };
    const parsed = JSON.parse(formatLogLine(e).trimEnd());
    expect(parsed).toEqual(e);
  });
});
