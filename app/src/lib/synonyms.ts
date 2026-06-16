// Bảng ĐỒNG NGHĨA thủ công cho tên món Việt — bù chỗ embedding không tách được sắc thái món
// (đo thật: "gà rán"~"gà nướng" còn gần hơn "gà chiên giòn"; "bún riêu"~"bún bò" gần hơn "bún cua").
// Mỗi nhóm = các từ/cụm coi như TƯƠNG ĐƯƠNG khi match tên món. Đều thường, CÓ DẤU (lexical ở
// dishes.ts khớp có dấu). Thêm cặp mới = sửa data, không đụng code. Xem plans/01_4_dishes.md.
const SYNONYM_GROUPS: string[][] = [
  // — cách chế biến —
  ["rán", "chiên"],
  ["nướng", "quay"], // cẩn trọng: chỉ bật nếu thực đơn coi gần nhau; gỡ nếu nhiễu
  // — nguyên liệu / vùng miền —
  ["heo", "lợn"],
  ["ngô", "bắp"],
  ["lạc", "đậu phộng"],
  ["dứa", "thơm", "khóm"],
  ["tôm", "tép"],
  // — biến thể chính tả —
  ["hủ tiếu", "hủ tíu"],
  ["bánh mỳ", "bánh mì"],
  // — đồng nghĩa cấp món (cụm nhiều từ) —
  ["bún riêu", "bún riêu cua", "bún cua"],
  ["nước ngọt", "nước có ga", "nước có gas"],
  ["sinh tố", "smoothie"],
];

// Trần số biến thể sinh ra (chặn bùng nổ tổ hợp khi tên dính nhiều nhóm). Tên món Việt ngắn nên
// thực tế hiếm khi chạm.
const MAX_VARIANTS = 16;

// Sinh các biến thể tên món bằng cách thay cụm đồng nghĩa (khớp NGUYÊN TỪ, có dấu). Query gốc luôn
// đứng ĐẦU mảng trả về — call site dựa vào đó để phân biệt khớp đích danh (dist=0) với khớp đồng
// nghĩa (dist nhỏ > 0). Compose qua nhiều nhóm: "gà rán" + nhóm rán/chiên → ["gà rán","gà chiên"].
export function expandSynonyms(query: string): string[] {
  const q = query.toLowerCase().trim();
  let variants = [q];
  for (const group of SYNONYM_GROUPS) {
    const next = new Set(variants);
    for (const v of variants) {
      for (const member of group) {
        if (!hasWord(v, member)) continue;
        for (const other of group) {
          if (other !== member) next.add(replaceWord(v, member, other));
        }
      }
    }
    variants = [...next].slice(0, MAX_VARIANTS);
  }
  return [q, ...variants.filter((v) => v !== q)];
}

// Pattern POSIX cho toán tử `~` của Postgres: khớp BẤT KỲ term nào như nguyên từ (ranh giới phi-alnum
// hai đầu). Dùng đúng quy ước [:alnum:] + escape như nhánh lexical cũ trong dishes.ts.
export function lexAlternationPattern(terms: string[]): string {
  const alt = terms
    .map((t) => t.toLowerCase().trim().replace(/[.^$*+?()[\]{}|\\]/g, "\\$&"))
    .join("|");
  return `(^|[^[:alnum:]])(${alt})([^[:alnum:]]|$)`;
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
