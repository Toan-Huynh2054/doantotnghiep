import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const imagesDir = fileURLToPath(new URL("./public/Images", import.meta.url));
const distDir = fileURLToPath(new URL("./dist", import.meta.url));

const IMG_EXT = new Set([".jpg", ".jpeg", ".png"]);
const MAX_DIM = 2000; // cạnh dài tối đa cho web — đủ nét, cắt phần thừa nặng nề

/** Liệt kê đệ quy mọi file trong Images/, bỏ qua thư mục video. */
function walkImages(dir, rootRel = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.join(rootRel, entry.name);
    if (entry.isDirectory()) out.push(...walkImages(abs, rel));
    else out.push({ abs, rel });
  }
  return out;
}

/** Nén 1 ảnh bằng sharp; trả Buffer tối ưu, hoặc null nếu nên giữ bản gốc. */
async function optimize(abs, ext) {
  const pipeline = sharp(abs, { failOn: "none" })
    .rotate() // áp EXIF orientation rồi bỏ metadata
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });
  const buf =
    ext === ".png"
      ? await pipeline.png({ compressionLevel: 9, quality: 80, effort: 8 }).toBuffer()
      : await pipeline.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toBuffer();
  // Chỉ dùng bản nén nếu thực sự nhỏ hơn gốc
  return buf.length < statSync(abs).size ? buf : null;
}

async function writeOut(rel, buf, abs) {
  const dest = path.join(distDir, "Images", rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  if (buf) writeFileSync(dest, buf);
  else copyFileSync(abs, dest);
}

/**
 * Nén ảnh bằng sharp (resize ≤2000px, JPEG q80 / PNG nén sâu).
 * Vì file đã nằm trong public/Images, Vite sẽ tự động copy sang dist/Images.
 * Plugin này chỉ chạy sau khi build xong để GHI ĐÈ các ảnh trong dist/Images 
 * bằng bản đã nén, giúp tối ưu dung lượng.
 */
function optimizeImages() {
  return {
    name: "vx-optimize-images",
    apply: "build",
    async closeBundle() {
      if (!existsSync(imagesDir)) return;
      const files = walkImages(imagesDir);
      let optimized = 0;
      let saved = 0;
      const concurrency = 6;
      let i = 0;
      const worker = async () => {
        while (i < files.length) {
          const { abs, rel } = files[i++];
          const ext = path.extname(rel).toLowerCase();
          if (IMG_EXT.has(ext)) {
            try {
              const before = statSync(abs).size;
              const buf = await optimize(abs, ext);
              // Chỉ ghi đè nếu nén thành công (buf != null)
              if (buf) {
                await writeOut(rel, buf, abs);
                optimized++;
                saved += before - buf.length;
              }
            } catch {
              // Lỗi giải mã -> bỏ qua (giữ nguyên file Vite đã copy)
            }
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
      console.log(
        `\n[vx-images] đã nén ${optimized}/${files.length} ảnh · tiết kiệm ${(saved / 1048576).toFixed(1)}MB`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), optimizeImages()],
  server: {
    port: 5173
  }
});
