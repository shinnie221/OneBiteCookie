// Renders video/scene.html frame by frame with headless Chrome and pipes JPEG frames into ffmpeg.
// usage: node render.mjs <scene.html> <out.mp4> <ffmpeg.exe> [--stills t1,t2,... <outDir>]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [scene, out, ffmpeg, flag, stillTimes, stillDir] = process.argv.slice(2);
const FPS = 30, DURATION = 30;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(scene)).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.ready);

const frameAt = async (t, opts) => {
  await page.evaluate(tt => window.seek(tt), t);
  return page.screenshot({ type: 'jpeg', quality: 96, optimizeForSpeed: true, ...opts });
};

if (flag === '--stills') {
  for (const t of stillTimes.split(',').map(Number)) {
    await frameAt(t, { path: path.join(stillDir, `still-${t.toFixed(2)}.jpg`) });
    console.log('still', t);
  }
} else {
  const ff = spawn(ffmpeg, [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    // JPEG frames are full-range BT.601; deliver standard limited-range BT.709 for player compatibility
    '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
    '-r', String(FPS), '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = FPS * DURATION;
  const started = Date.now();
  for (let f = 0; f < total; f++) {
    const buf = await frameAt(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 90 === 0) console.log(`frame ${f}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
