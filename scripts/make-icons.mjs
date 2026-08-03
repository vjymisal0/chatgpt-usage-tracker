import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SIZES = [16, 32, 48, 128];

function svgFor(size) {
  const stroke = size <= 16 ? 3 : size / 8;
  const radius = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.68; // ~68% filled, evokes a usage meter without alarming red
  const dashOffset = circumference * (1 - progress);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="#202123" />
      <circle
        cx="${cx}" cy="${cy}" r="${radius}"
        fill="none" stroke="#3a3b3d" stroke-width="${stroke}"
      />
      <circle
        cx="${cx}" cy="${cy}" r="${radius}"
        fill="none" stroke="#22c55e" stroke-width="${stroke}"
        stroke-linecap="round"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${dashOffset}"
        transform="rotate(-90 ${cx} ${cy})"
      />
    </svg>
  `;
}

await mkdir(new URL('../icons/', import.meta.url), { recursive: true });

for (const size of SIZES) {
  const svg = Buffer.from(svgFor(size));
  const outPath = fileURLToPath(new URL(`../icons/icon${size}.png`, import.meta.url));
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`wrote icon${size}.png`);
}
