# 05 — Admin upload ảnh menu → parse → lưu DB · Tasks

Chia nhỏ từ `plans/05_admin_menu_parse.md`. Làm tuần tự, tick khi xong.
Branch: `feat/admin-menu-parse`.

- [x] `01_db_transaction.md` — thêm `withTransaction` vào `src/lib/db.ts`
- [x] `02_menuparse_lib.md` — `src/lib/menuParse.ts` (prompt Vision + normalize) + test
- [x] `03_parse_route.md` — `POST .../menu/parse` (upload ảnh → JSON preview)
- [ ] `04_import_route.md` — `POST .../menu/import` (merge/upsert trong transaction) + test
- [ ] `05_ui_menu_import.md` — `MenuImport.tsx` + gắn vào page + adminFetch FormData
- [ ] `06_finalize.md` — lint/test/build + PR

Quy ước MUST (AGENTS): validate-at-the-edge trước khi chạm DB/AI, SQL tham số hoá `$1,$2…`,
không raw hex/`bg-zinc-*` trong JSX, không gọi Gemini trong vòng lặp render.
