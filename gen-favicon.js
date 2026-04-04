const { Jimp, JimpMime } = require('jimp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'frontend/public');

const C1 = { r: 62,  g: 114, b: 174 };
const C2 = { r: 22,  g: 160, b: 133 };

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function gradientInt(x, y, size) {
  const t = (x + y) / (size * 2);
  const r = lerp(C1.r, C2.r, t);
  const g = lerp(C1.g, C2.g, t);
  const b = lerp(C1.b, C2.b, t);
  return (r << 24) | (g << 16) | (b << 8) | 0xff;
}

function setPixel(img, x, y, colorInt) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  img.setPixelColor(colorInt >>> 0, x, y);
}

function drawRoundedRect(img, size, radius) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      if (cx < radius && cy < radius) {
        const dx = radius - cx - 1, dy = radius - cy - 1;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      setPixel(img, x, y, gradientInt(x, y, size));
    }
  }
}

function drawN(img, size) {
  const pad   = Math.round(size * 0.20);
  const thick = Math.max(2, Math.round(size * 0.13));
  const top   = pad;
  const bot   = size - pad - 1;
  const left  = pad;
  const right = size - pad - 1;
  const white = (255 << 24) | (255 << 16) | (255 << 8) | 255;

  // Left vertical
  for (let y = top; y <= bot; y++)
    for (let dx = 0; dx < thick; dx++)
      setPixel(img, left + dx, y, white);

  // Right vertical
  for (let y = top; y <= bot; y++)
    for (let dx = 0; dx < thick; dx++)
      setPixel(img, right - dx, y, white);

  // Diagonal top-left → bottom-right
  const steps = bot - top;
  const xStart = left + thick;
  const xEnd   = right - thick;
  for (let s = 0; s <= steps; s++) {
    const px = Math.round(xStart + (s / steps) * (xEnd - xStart));
    const py = top + s;
    for (let dx = 0; dx < thick; dx++)
      for (let dy = 0; dy < thick; dy++)
        setPixel(img, px + dx, py + dy, white);
  }
}

async function makeIcon(size) {
  const radius = Math.round(size * 0.22);
  const img = new Jimp({ width: size, height: size, color: 0x00000000 });
  drawRoundedRect(img, size, radius);
  drawN(img, size);
  return img;
}

async function buildIco(sizes) {
  const images = [];
  for (const size of sizes) {
    const img = await makeIcon(size);
    const buf = await img.getBuffer(JimpMime.png);
    images.push({ size, buf });
  }
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const parts = [header];
  images.forEach(({ size, buf }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1,  e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8);
    header.writeUInt32LE(offset,     e + 12);
    offset += buf.length;
    parts.push(buf);
  });
  return Buffer.concat(parts);
}

(async () => {
  const ico = await buildIco([16, 32, 48]);
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), ico);
  console.log('✓ favicon.ico');

  const img192 = await makeIcon(192);
  fs.writeFileSync(path.join(OUT, 'logo192.png'), await img192.getBuffer(JimpMime.png));
  console.log('✓ logo192.png');

  const img512 = await makeIcon(512);
  fs.writeFileSync(path.join(OUT, 'logo512.png'), await img512.getBuffer(JimpMime.png));
  console.log('✓ logo512.png');

  const imgApple = await makeIcon(180);
  fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), await imgApple.getBuffer(JimpMime.png));
  console.log('✓ apple-touch-icon.png');
})();
