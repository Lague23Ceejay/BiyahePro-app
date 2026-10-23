import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
if (!apiBase) throw new Error('EXPO_PUBLIC_API_URL is required to fetch the current mobile app icon.');

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const iconPath = path.join(directory, 'app-icon.png');
const response = await fetch(`${apiBase}/api/branding/app-icon/customer`);

if (response.status === 404) {
  await rm(iconPath, { force: true });
  console.log('No custom customer app icon is configured; using Expo defaults.');
} else if (!response.ok) {
  throw new Error(`Unable to download the current app icon (HTTP ${response.status}).`);
} else {
  const image = Buffer.from(await response.arrayBuffer());
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (image.length < 24 || image.length > 2 * 1024 * 1024 || !image.subarray(0, 8).equals(signature)) {
    throw new Error('The app icon endpoint returned an invalid or oversized PNG.');
  }
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width !== height || width < 512 || width > 2048) {
    throw new Error('The app icon must be square and between 512 and 2048 pixels.');
  }
  await mkdir(directory, { recursive: true });
  await writeFile(iconPath, image);
  console.log(`Downloaded the customer app icon (${width}x${height}).`);
}
