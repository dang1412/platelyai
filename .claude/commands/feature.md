---
description: Từ một idea → research → plan (plans/NN_<slug>.md) → tasks (tasks/NN_<slug>/)
argument-hint: <mô tả tính năng muốn làm>
---

Bạn nhận một **ý tưởng tính năng**: $ARGUMENTS

Mục tiêu của lệnh này: biến idea đó thành tài liệu thiết kế + danh sách task nhỏ, **chưa code**.
Làm theo đúng các bước sau, theo convention trong `AGENTS.md`.

## Bước 1 — Research (đọc trước khi viết)
- Đọc `AGENTS.md` để nắm rule (stack, file structure, SQL/validate/token MUST).
- Tìm code liên quan tới idea trong repo hiện tại (`app/src/…`, `db/init/…`) và code tham
  khảo cũ trong `old/` nếu có. Đọc các file then chốt (schema, lib, route, component) để plan
  bám đúng cấu trúc THỰC TẾ — đừng tin trí nhớ.
- Nếu idea còn mơ hồ ở điểm ảnh hưởng tới việc làm (lựa chọn không có default rõ), hỏi 1–2 câu
  quyết định bằng AskUserQuestion trước khi viết plan. Còn lại tự chọn default hợp lý + ghi rõ.

## Bước 2 — Tạo plan `plans/NN_<slug>.md`
- `NN` = số thứ tự kế tiếp (nhìn số lớn nhất đang có trong `plans/`). `<slug>` = kebab-case ngắn.
- Nội dung plan (tiếng Việt, súc tích — KISS/YAGNI):
  - **Mục tiêu** 1–2 câu + đường dẫn route/màn hình nếu có.
  - **Luồng** (sơ đồ ASCII nếu giúp ích) — nêu rõ ranh giới client/server, đâu chạm DB/AI.
  - **Backend**: lib thuần (đặt `src/lib/…`, có `.test.ts` cạnh bên), route handler
    (`src/app/api/…/route.ts`, `runtime="nodejs"` nếu cần), validate-at-the-edge, SQL tham số hoá.
  - **Frontend**: component (`src/components/…`), server-first, chỉ `"use client"` khi cần;
    dùng semantic token / bám style hàng xóm, chạy được light + dark.
  - **Schema**: chỉ additive (thêm `db/init/NN_*.sql` mới, không sửa file đã apply).
  - **Bảng file đụng tới** + **Test & guardrails** (unit cho logic thuần; integration chạm
    Postgres thật cho SQL) + **Mở rộng ngoài scope**.
- Ghi rõ mọi quyết định mặc định đã chọn để user có thể chỉnh.

## Bước 3 — Tạo tasks `tasks/NN_<slug>/`
- Cùng `NN_<slug>` với plan.
- `00_overview.md`: tên feature, link tới plan, **checklist** các task (`- [ ] NN_*.md — mô tả`)
  theo thứ tự phụ thuộc, branch đề xuất (`feat/<slug>`), nhắc lại các MUST của AGENTS.
- Mỗi task = 1 file `NN_<slug-task>.md`, nhỏ và làm được độc lập, gồm: **Vì sao**, **Việc**
  (file cụ thể + điểm mấu chốt), **Done khi** (tiêu chí kiểm). Chia theo *concern*, không theo
  số dòng. Thứ tự thường: lib/db helper → logic + test → API route → UI → finalize (lint/test/build + PR).

## Bước 4 — Chốt
- KHÔNG viết code feature trong lệnh này — chỉ docs (plan + tasks).
- Tóm tắt: đường dẫn plan, cây thư mục tasks, các quyết định mặc định đã chọn, và hỏi user có
  muốn bắt đầu task đầu tiên không.
- Đừng tự commit trừ khi user yêu cầu.
