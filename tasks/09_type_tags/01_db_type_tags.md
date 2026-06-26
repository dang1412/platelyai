# 01 — DB: thêm tag + backfill

> Commit: `4068523` — feat(search): seed type-tags + backfill restaurant_tags ✅

## Vì sao
`quán ăn`/`giải khát` phải tồn tại trong vocab `tags` TRƯỚC khi extract gắn chúng
(`parseExtraction` chỉ giữ tag nằm trong vocab). `tráng miệng`/`ăn vặt` thêm vào làm tag vibe
thường (chỉ cần có trong vocab). Quán hiện có cần `restaurant_tags` cho `quán ăn`/`giải khát`
để rank cộng điểm, suy từ `serves_food`/`serves_drink` đang còn dữ liệu.

## Việc
- Tạo `db/init/09_type_tags.sql`:
  - `INSERT INTO tags (name) VALUES ('quán ăn'), ('giải khát'), ('tráng miệng'), ('ăn vặt')
     ON CONFLICT (name) DO NOTHING;` (cột `name` UNIQUE — xem `01_schema.sql:69`).
  - Backfill `restaurant_tags`:
    - `quán ăn` cho mọi quán `serves_food = true`.
    - `giải khát` cho mọi quán `serves_drink = true`.
    - dùng `INSERT … SELECT … ON CONFLICT (restaurant_id, tag_id) DO NOTHING` (PK đã có).
  - **Không** backfill "tráng miệng"/"ăn vặt" (chỉ INSERT vào `tags`, là tag vibe thường).
- File thuần literal cố định, không có input ngoài → không cần param hoá; vẫn KHÔNG sửa `01_schema.sql`.

## Done khi
- Chạy file trên DB dev có dữ liệu: `SELECT t.name, count(*) FROM tags t LEFT JOIN restaurant_tags rt
  ON rt.tag_id = t.id WHERE t.name IN ('quán ăn','giải khát','tráng miệng','ăn vặt') GROUP BY t.name;`
  → 4 tag tồn tại; `quán ăn`/`giải khát` có count khớp số quán serves_*; `tráng miệng`/`ăn vặt` count 0.
- Chạy lại file lần 2 không lỗi (idempotent nhờ `ON CONFLICT DO NOTHING`).
