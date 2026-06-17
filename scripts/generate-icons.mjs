import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'resources', 'icon.png');
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');

const LAUNCHER = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const FOREGROUND = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function writePng(size, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(outputPath);
}

async function generateAndroidIcons() {
  for (const [folder, size] of Object.entries(LAUNCHER)) {
    const dir = path.join(androidRes, folder);
    await writePng(size, path.join(dir, 'ic_launcher.png'));
    await writePng(size, path.join(dir, 'ic_launcher_round.png'));
  }

  for (const [folder, size] of Object.entries(FOREGROUND)) {
    const dir = path.join(androidRes, folder);
    await writePng(size, path.join(dir, 'ic_launcher_foreground.png'));
  }
}

async function generateWindowsIcon() {
  const buildDir = path.join(root, 'build');
  await mkdir(buildDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer(),
    ),
  );

  const ico = await toIco(pngBuffers);
  await writeFile(path.join(buildDir, 'icon.ico'), ico);
  await sharp(source)
    .resize(256, 256, { fit: 'cover' })
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
}

await generateAndroidIcons();
await generateWindowsIcon();
console.log('Generated Android launcher icons and Windows icon.ico');
