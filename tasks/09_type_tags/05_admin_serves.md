# 05 — Admin: gỡ serves_food / serves_drink

> Commit: `e952ccf` — feat(admin): gỡ serves_food/serves_drink khỏi tạo/sửa quán ✅

## Vì sao
2 cột này thôi không còn vai trò (food/drink → tag). Gỡ khỏi luồng tạo/sửa quán để không còn
ghi dữ liệu chết trước khi DROP cột (task 07).

## Việc
- `app/src/components/admin/InfoForm.tsx`: bỏ field `serves_food`/`serves_drink` (state + input + payload, ≈ 69–70).
- `app/src/app/api/admin/restaurants/route.ts`: bỏ `servesFood`/`servesDrink` (parse + cột INSERT, ≈ 47–54).
- `app/src/app/api/admin/restaurants/[id]/route.ts`: bỏ khỏi parse + câu UPDATE (≈ 29–37).
- `app/src/lib/authz.ts`: bỏ 2 cột `"servesFood"`/`"servesDrink"` trong SELECT (≈ 64–65, 77–78) +
  field tương ứng ở type trả về.
- `app/src/lib/adminRestaurant.ts`: bỏ `"servesFood"`/`"servesDrink"` trong SELECT (≈ 46–47) + type.
- **Giữ validate-at-the-edge** cho các field còn lại; chỉ bỏ phần serves_*.

## Done khi
- Tạo quán mới + sửa quán qua admin chạy được, không còn input/field serves.
- `pnpm build` xanh, không còn tham chiếu `serves_food`/`serves_drink` trong code (chỉ còn cột DB tới task 07).
