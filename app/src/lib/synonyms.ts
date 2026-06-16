// Bảng ĐỒNG NGHĨA thủ công cho tên món Việt — bù chỗ embedding không tách được sắc thái món
// (đo thật: "gà rán"~"gà nướng" còn gần hơn "gà chiên giòn"; "bún riêu"~"bún bò" gần hơn "bún cua").
// Mỗi nhóm = các từ/cụm coi như TƯƠNG ĐƯƠNG khi match tên món. Đều thường, CÓ DẤU (lexical ở
// dishes.ts khớp có dấu). Thêm cặp mới = sửa data, không đụng code. Xem plans/01_4_dishes.md.
// Đã hiệu chỉnh theo TẦN SUẤT THẬT trong menu_items.name (37k món). Số trong ngoặc = số món chứa
// từ đó như nguyên từ — chỉ giữ cặp mà cả hai phía đều có thật (hoặc phía DB ít nhưng query-side
// hay gõ). KHÔNG gộp món thực sự khác nhau (nướng≠quay, tôm≠tép) — đó là lỗi mà bảng này đi sửa.
const SYNONYM_GROUPS: string[][] = [
  // — cách chế biến —
  ["rán", "chiên"], // 454 / 1393
  // — chính tả / cách viết —
  ["mì", "mỳ"], // 612 / 557 (cũng bao "bánh mì"↔"bánh mỳ": 272/125)
  ["sốt", "xốt"], // 1263 / 106
  ["sả", "xả"], // 397 / 115
  ["hủ tiếu", "hủ tíu"], // 6 / 1 — hiếm nhưng đúng, zero false-positive
  ["phô mai", "phomai"], // 555 / 175 (phô mát = 0, bỏ)
  // — nguyên liệu / vùng miền —
  ["heo", "lợn"], // 416 / 122
  ["ngô", "bắp"], // 222 / 410
  ["lạc", "đậu phộng"], // 80 / 16
  // — Việt ↔ Anh (giá trị ở mở rộng query, kể cả DB ít) —
  ["cà phê", "cafe", "coffee"], // 550 / 299 / 91
  ["nước ép", "juice"], // 576 / 10
  ["sinh tố", "smoothie"], // 472 / 18
  ["bít tết", "beefsteak"], // 17 / 1
  ["khoai tây chiên", "french fries"], // 225 / 3 (chiên↔rán tự nối "khoai tây rán")
  // — đồng nghĩa cấp món (cụm nhiều từ) —
  // KHÔNG thêm "bún riêu cua": nó chứa nguyên từ "bún riêu" nên đã khớp sẵn; thêm vào gây đệ quy
  // (member lồng member) sinh biến thể rác. Member trong 1 nhóm không được là từ-con của nhau.
  ["bún riêu", "bún cua"], // 130 / 1 (gõ "bún cua" → trúng 130 "bún riêu")
];

// Trần số biến thể sinh ra (chặn bùng nổ tổ hợp khi tên dính nhiều nhóm). Tên món Việt ngắn nên
// thực tế hiếm khi chạm.
const MAX_VARIANTS = 16;

// Sinh các biến thể tên món bằng cách thay cụm đồng nghĩa (khớp NGUYÊN TỪ, có dấu). Query gốc luôn
// đứng ĐẦU mảng trả về — call site dựa vào đó để phân biệt khớp đích danh (dist=0) với khớp đồng
// nghĩa (dist nhỏ > 0). Compose qua nhiều nhóm: "gà rán" + nhóm rán/chiên → ["gà rán","gà chiên"].
export function expandSynonyms(query: string): string[] {
  const q = query.toLowerCase().trim();
  // Lặp tới điểm bất động (bounded) để compose ĐA TẦNG qua nhiều nhóm: vd "french fries" →
  // "khoai tây chiên" (nhóm Anh-Việt) → "khoai tây rán" (nhóm rán/chiên). 1 pass không đủ vì thứ tự
  // nhóm cố định. Dừng khi không sinh thêm hoặc chạm MAX_VARIANTS.
  const variants = new Set([q]);
  for (let pass = 0; pass < SYNONYM_GROUPS.length; pass++) {
    let grew = false;
    for (const group of SYNONYM_GROUPS) {
      for (const v of [...variants]) {
        for (const member of group) {
          if (!hasWord(v, member)) continue;
          for (const other of group) {
            if (other === member) continue;
            const rewritten = replaceWord(v, member, other);
            if (!variants.has(rewritten) && variants.size < MAX_VARIANTS) {
              variants.add(rewritten);
              grew = true;
            }
          }
        }
      }
    }
    if (!grew || variants.size >= MAX_VARIANTS) break;
  }
  return [q, ...[...variants].filter((v) => v !== q)];
}

// — helpers ranh giới từ phía JS (Unicode, để xử lý cụm có dấu khi sinh biến thể) —
function wordBoundary(term: string): RegExp {
  const esc = term.replace(/[.^$*+?()[\]{}|\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, "u");
}
function hasWord(s: string, term: string): boolean {
  return wordBoundary(term).test(s);
}
function replaceWord(s: string, term: string, repl: string): string {
  return s.replace(wordBoundary(term), (_m, a, b) => `${a}${repl}${b}`);
}
