// Genera los iconos PNG de la PWA a partir de un SVG (requiere sharp).
// Uso: npm run icons
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "public", "icons");
const publicDir = path.join(root, "..", "public");

function makeSvg({ maskable = false } = {}) {
  // Con maskable el fondo llena todo el lienzo y el glifo se encoge
  // a la zona segura (80% central).
  const glyphSize = maskable ? 250 : 310;
  const glyphY = maskable ? 344 : 368;
  const rx = maskable ? 0 : 116;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  <circle cx="380" cy="120" r="170" fill="#ffffff" opacity="0.08"/>
  <text x="256" y="${glyphY}" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-weight="800"
    font-size="${glyphSize}" fill="#ffffff">$</text>
</svg>`;
}

const standard = Buffer.from(makeSvg());
const maskable = Buffer.from(makeSvg({ maskable: true }));

await mkdir(outDir, { recursive: true });

const jobs = [
  { src: standard, size: 192, file: "icon-192.png" },
  { src: standard, size: 512, file: "icon-512.png" },
  { src: standard, size: 180, file: "apple-touch-icon.png" },
  { src: maskable, size: 512, file: "maskable-512.png" },
];

for (const job of jobs) {
  await sharp(job.src).resize(job.size, job.size).png().toFile(path.join(outDir, job.file));
  console.log("✓", job.file);
}

await writeFile(path.join(publicDir, "favicon.svg"), makeSvg());
console.log("✓ favicon.svg");
