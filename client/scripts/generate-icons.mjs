// Genera los recursos de marca de la PWA a partir del logo oficial
// (../logo-icon gordofinance.png en la raíz del repo). Requiere sharp.
// Uso: npm run icons
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(root, "..", "..", "logo-icon gordofinance.png");
const publicDir = path.join(root, "..", "public");
const outDir = path.join(publicDir, "icons");

await mkdir(outDir, { recursive: true });

// 1) Wordmark completo recortado (login, splash, encabezado)
const trimmed = await sharp(logoPath).trim().png().toBuffer();
const { width: W, height: H } = await sharp(trimmed).metadata();
await sharp(trimmed)
  .resize({ width: 900, withoutEnlargement: true })
  .png()
  .toFile(path.join(publicDir, "logo.png"));
console.log(`✓ logo.png (wordmark ${W}x${H})`);

// 2) La "G" del oso como icono de app: franja izquierda de la línea "Gordo"
//    (la fila "FINANCE" queda fuera por la altura del recorte)
const gRegion = await sharp(trimmed)
  .extract({
    left: 0,
    top: 0,
    width: Math.round(W * 0.253),
    height: Math.round(H * 0.74),
  })
  .trim()
  .png()
  .toBuffer();

async function iconOnWhite(source, size, contentRatio, file) {
  const content = Math.round(size * contentRatio);
  const glyph = await sharp(source)
    .resize(content, content, { fit: "inside" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toFile(path.join(outDir, file));
  console.log("✓", file);
}

await iconOnWhite(gRegion, 192, 0.74, "icon-192.png");
await iconOnWhite(gRegion, 512, 0.74, "icon-512.png");
await iconOnWhite(gRegion, 180, 0.74, "apple-touch-icon.png");
// Maskable: el glifo vive en la zona segura (60% central)
await iconOnWhite(gRegion, 512, 0.56, "maskable-512.png");

// 3) Favicon PNG
const fav = await sharp(gRegion).resize(56, 56, { fit: "inside" }).png().toBuffer();
await sharp({
  create: { width: 64, height: 64, channels: 4, background: "#ffffff" },
})
  .composite([{ input: fav, gravity: "center" }])
  .png()
  .toFile(path.join(publicDir, "favicon.png"));
console.log("✓ favicon.png");
