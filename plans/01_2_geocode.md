# Plan 01.2 — Geocode (địa điểm → toạ độ)

> Bước 2 của [Search API](./01_search_api.md). File: `app/src/lib/geocode.ts`.
> Trạng thái: **✅ xong** — 9/9 test xanh (parse + cache + fail-safe), typecheck sạch. Kiểm key thật để sau.

## Mục tiêu

Đổi tên địa điểm trong câu (yếu tố 4) thành `{ lat, lng }` để làm `origin`. Chỉ chạy khi request
KHÔNG có toạ độ thiết bị (`lat,lng` ưu tiên hơn — xử lý ở route, bước sau).

## Input / Output

```ts
function geocode(location: string): Promise<LatLng | null>   // LatLng = { lat, lng }
```

- Trả `null` khi: chuỗi rỗng, thiếu `GOOGLE_API_KEY`, API lỗi, hoặc không tìm thấy địa điểm.

## Thiết kế

- Gọi **Google Places `searchText`** (`POST .../v1/places:searchText`), `X-Goog-FieldMask:
  places.location` (chỉ lấy toạ độ → rẻ), `languageCode: "vi"`. Port từ `old/app/src/lib/geocode.ts`.
- **Cache in-memory** theo tên đã chuẩn hoá (`trim().toLowerCase()`) trong vòng đời process — cùng
  địa điểm không gọi API lại.
- **Tách core thuần để test**: `parseGeocodeResponse(data) → LatLng | null` (đọc
  `places[0].location`), không chạm mạng.
- Lỗi mạng / HTTP !ok / không có key → `null` (fail-safe, route tự xử khi origin null).

## Test (`app/src/lib/geocode.test.ts`, vitest)

**`parseGeocodeResponse`** (thuần):

| data | kỳ vọng |
|---|---|
| `{places:[{location:{latitude:21.0,longitude:105.8}}]}` | `{lat:21.0,lng:105.8}` |
| `{places:[]}` | `null` |
| `{}` (không field places) | `null` |
| `{places:[{}]}` (location thiếu) | `null` |

**`geocode`** (mock `fetch` + `GOOGLE_API_KEY` qua `vi.stubGlobal`/`vi.stubEnv`, reset cache mỗi test):

| Tình huống | kỳ vọng |
|---|---|
| location rỗng / toàn space | `null`, **không** gọi fetch |
| thiếu `GOOGLE_API_KEY` | `null`, **không** gọi fetch |
| response ok có toạ độ | `LatLng`; gọi lần 2 cùng tên → **cache hit** (fetch chỉ 1 lần) |
| response `!ok` (vd 403) | `null` |
| fetch throw | `null` |

## Done khi
- `pnpm test geocode` xanh; typecheck sạch.
- (Tay) gọi `geocode("Vincom Bà Triệu")` với key thật → ra toạ độ Hà Nội hợp lý.
