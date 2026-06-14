# platelyai

Tìm quán ăn / giải khát quanh bạn bằng câu hỏi tự nhiên — search hiểu món, vibe, địa điểm, giá.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `app/` | Web app Next.js (Next 16 + React 19 + TypeScript + Tailwind 4) |
| `db/init/` | Schema PostgreSQL (PostGIS + pgvector) — SQL thuần |
| `plans/` | Tài liệu thiết kế từng tính năng |
| `Dockerfile.postgres`, `docker-compose.yml` | Postgres 16 + PostGIS + pgvector cho dev |

## Chạy local

```bash
cp .env.example .env        # điền giá trị thật
docker compose up -d        # khởi động Postgres (init schema lần đầu)

cd app
pnpm install
pnpm dev
```

## Stack

- **Web**: Next.js (App Router), TypeScript, Tailwind CSS
- **DB**: PostgreSQL 16 + PostGIS (geo) + pgvector (semantic search), truy vấn SQL thuần qua `pg`
- **AI**: Gemini (hiểu query) + OpenAI embeddings (semantic match món)
