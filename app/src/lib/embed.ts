import OpenAI from "openai";

// Bước 3 — embed text → vector cho semantic match trên menu_items.embedding.
// PHẢI khớp model/dims đã dùng sinh embedding trong DB (pipeline), nếu không cosine vô nghĩa.
// Prefix ("Món: ") do bước dishes thêm ở call site, không thêm ở đây.
// Xem plans/01_3_embed.md.

const MODEL = "text-embedding-3-small";
const DIMS = 1536;

// pgvector nhận vector dạng literal '[1,2,3]'. THUẦN để test.
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY || !text.trim()) return null;
  const vecs = await embed([text]);
  return vecs ? vecs[0] : null;
}

// Embed nhiều chuỗi trong 1 call (mỗi phần tử 1 vector, đúng thứ tự input).
export async function embedMany(texts: string[]): Promise<number[][] | null> {
  if (!process.env.OPENAI_API_KEY || texts.length === 0) return null;
  return embed(texts);
}

async function embed(input: string[]): Promise<number[][] | null> {
  try {
    // Khởi tạo lazily (sau khi đã chắc có key) → không throw lúc import.
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.embeddings.create({ model: MODEL, input, dimensions: DIMS });
    return res.data.map((d) => d.embedding);
  } catch (e) {
    console.error("embed failed:", e);
    return null;
  }
}
