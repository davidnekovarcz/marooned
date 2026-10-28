import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'public', 'icons', 'icon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [192, 512];

Promise.all(
  sizes.map((size) =>
    sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(__dirname, 'public', 'icons', `icon-${size}.png`))
  )
).then(() => {
  console.log('Icons generated successfully!');
}).catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
