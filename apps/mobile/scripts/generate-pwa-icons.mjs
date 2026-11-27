import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const mobileRoot = path.resolve(__dirname, '..');
const sourceLogoPath = path.join(repoRoot, 'Logo.png');
const publicDir = path.join(mobileRoot, 'public');
const iconsDir = path.join(publicDir, 'icons');
const assetsImagesDir = path.join(mobileRoot, 'assets', 'images');

const DARK_TITANIUM_BG = { r: 20, g: 22, b: 26, alpha: 1 }; // #14161A

async function extractTransparentSquircleBuffer(inputPath) {
  const size = 592;
  const { data, info } = await sharp(inputPath)
    .resize(size, size, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const total = w * h;
  const out = Buffer.from(data);
  const exterior = new Uint8Array(total);

  const isNearWhite = (idx) => {
    const o = idx * 4;
    return out[o] >= 235 && out[o + 1] >= 235 && out[o + 2] >= 235;
  };

  // 1. 4-corner BFS flood-fill for exterior near-white pixels
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const seeds = [
    0,
    w - 1,
    (h - 1) * w,
    h * w - 1,
  ];

  for (const seed of seeds) {
    if (!exterior[seed] && isNearWhite(seed)) {
      exterior[seed] = 1;
      queue[tail++] = seed;
    }
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx / w) | 0;

    if (x > 0) {
      const n = idx - 1;
      if (!exterior[n] && isNearWhite(n)) {
        exterior[n] = 1;
        queue[tail++] = n;
      }
    }
    if (x + 1 < w) {
      const n = idx + 1;
      if (!exterior[n] && isNearWhite(n)) {
        exterior[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y > 0) {
      const n = idx - w;
      if (!exterior[n] && isNearWhite(n)) {
        exterior[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y + 1 < h) {
      const n = idx + w;
      if (!exterior[n] && isNearWhite(n)) {
        exterior[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  // 2. Identify non-exterior pixels within 2px of exterior
  const nearExterior = new Uint8Array(total);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      if (exterior[idx]) continue;

      let touchesExterior = false;
      for (let dy = -2; dy <= 2 && !touchesExterior; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          if (exterior[ny * w + nx]) {
            touchesExterior = true;
            break;
          }
        }
      }
      if (touchesExterior) {
        nearExterior[idx] = 1;
      }
    }
  }

  const isFringeCandidate = (idx) => {
    const o = idx * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= 150 && maxC - minC <= 22;
  };

  // 3. De-fringe anti-aliased boundary pixels & clear exterior
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const o = idx * 4;

      if (exterior[idx]) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
        continue;
      }

      if (nearExterior[idx] && isFringeCandidate(idx)) {
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];

        // Estimate local foreground rim color from nearby interior non-fringe pixels
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let dy = -4; dy <= 4; dy += 1) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -4; dx <= 4; dx += 1) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const nIdx = ny * w + nx;
            if (!exterior[nIdx] && !isFringeCandidate(nIdx)) {
              const no = nIdx * 4;
              sumR += data[no];
              sumG += data[no + 1];
              sumB += data[no + 2];
              count += 1;
            }
          }
        }

        const fgR = count > 0 ? Math.round(sumR / count) : 115;
        const fgG = count > 0 ? Math.round(sumG / count) : 119;
        const fgB = count > 0 ? Math.round(sumB / count) : 123;

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const fgLum = Math.min(245, 0.299 * fgR + 0.587 * fgG + 0.114 * fgB);
        const rawAlpha = (255 - lum) / Math.max(1, 255 - fgLum);
        const alpha = Math.max(0, Math.min(1, rawAlpha));

        out[o] = fgR;
        out[o + 1] = fgG;
        out[o + 2] = fgB;
        out[o + 3] = Math.round(alpha * 255);
      }
    }
  }

  return sharp(out, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function generateOpaqueCenteredIcon(squirclePng, canvasSize, innerSize, outPath) {
  const resized = await sharp(squirclePng)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((canvasSize - innerSize) / 2);
  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: DARK_TITANIUM_BG,
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .flatten({ background: DARK_TITANIUM_BG })
    .png()
    .toFile(outPath);
}

async function generateTransparentCenteredIcon(squirclePng, canvasSize, innerSize, outPath) {
  const resized = await sharp(squirclePng)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((canvasSize - innerSize) / 2);
  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(sourceLogoPath)) {
    throw new Error(`No se encontró el archivo fuente: ${sourceLogoPath}`);
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(assetsImagesDir, { recursive: true });

  const squirclePng = await extractTransparentSquircleBuffer(sourceLogoPath);

  // Transparent in-app & web logos
  await sharp(squirclePng).resize(512, 512).png().toFile(path.join(assetsImagesDir, 'logo.png'));
  await sharp(squirclePng).resize(512, 512).png().toFile(path.join(publicDir, 'logo.png'));

  // Native Expo icons
  await generateTransparentCenteredIcon(
    squirclePng,
    1024,
    720,
    path.join(assetsImagesDir, 'adaptive-icon.png')
  );
  await generateOpaqueCenteredIcon(
    squirclePng,
    1024,
    1024,
    path.join(assetsImagesDir, 'icon.png')
  );

  // Web & PWA icons
  await sharp(squirclePng).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'));
  await sharp(squirclePng).resize(32, 32).png().toFile(path.join(iconsDir, 'favicon-32.png'));
  await sharp(squirclePng).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  await sharp(squirclePng).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  await generateOpaqueCenteredIcon(
    squirclePng,
    512,
    416,
    path.join(iconsDir, 'icon-maskable-512.png')
  );
  await generateOpaqueCenteredIcon(
    squirclePng,
    180,
    180,
    path.join(iconsDir, 'apple-touch-icon.png')
  );

  console.log('Generated all Organiza logo, PWA, and Expo icon assets from Logo.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
