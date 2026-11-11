import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const copy = (name) => fs.cpSync(path.join(root, name), path.join(dist, name), { recursive: true });
for (const name of ['index.html', 'styles.css', 'script.js', 'mascot.js', 'mascot-rig.js']) copy(name);
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
for (const name of ['blog-screenshot.png', 'tripbeam-screenshot.png', 'cheng607-mascot-poster.png']) copy(path.join('assets', name));
copy(path.join('assets', 'scenes'));
copy(path.join('assets', 'mascot'));
fs.mkdirSync(path.join(dist, 'assets', 'models'), { recursive: true });
copy(path.join('assets', 'models', 'cheng607-mascot-web.glb'));
copy(path.join('assets', 'vendor'));
fs.mkdirSync(path.join(dist, 'orbit-engine', 'assets'), { recursive: true });
for (const name of [
  'index-4CfOS7fy.js',
  'index-9ra7EZ0C.css',
  'ImageOrbitScene-CDTDzP_K.js',
  'DisplayTextureLoader-Ckk0UWAh.js',
  'display-atlases-D0wQs_JZ.js',
  'orbit-center-index-BPE4jiOK.js',
]) copy(path.join('orbit-engine', 'assets', name));
for (const name of ['index.html', 'content.json', 'favicon.svg', 'orbit-only.css']) copy(path.join('orbit-engine', name));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

const base = '/mywork';
const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, content) => fs.writeFileSync(file, content);

const mainScript = path.join(dist, 'script.js');
write(mainScript, read(mainScript).replace("frame.src = '/orbit-engine/index.html#image-orbit';", "frame.src = 'orbit-engine/index.html#image-orbit';"));

const mainHtml = path.join(dist, 'index.html');
let html = read(mainHtml);
html = html.replace('<head>', '<head>\n  <base href="/mywork/">');
const modelPath = path.join(dist, 'assets', 'models', 'cheng607-mascot-web.glb');
if (fs.existsSync(modelPath)) {
  html = html.replace(/data-glb-bytes="\d+"/, `data-glb-bytes="${fs.statSync(modelPath).size}"`);
  const modelVersion = createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex').slice(0, 12);
  html = html.replace('data-glb-src="assets/models/cheng607-mascot-web.glb"', `data-glb-src="assets/models/cheng607-mascot-web.glb?v=${modelVersion}"`);
}
const rigVersion = createHash('sha256').update(read(path.join(dist, 'mascot-rig.js'))).digest('hex').slice(0, 12);
const mascotScript = path.join(dist, 'mascot.js');
write(mascotScript, read(mascotScript).replace("import('./mascot-rig.js')", `import('./mascot-rig.js?v=${rigVersion}')`));
for (const name of ['styles.css', 'script.js', 'mascot.js']) {
  const version = createHash('sha256').update(fs.readFileSync(path.join(dist, name))).digest('hex').slice(0, 12);
  html = html.replace(`"${name}"`, `"${name}?v=${version}"`);
}
write(mainHtml, html);

const engineHtml = path.join(dist, 'orbit-engine', 'index.html');
let orbitHtml = read(engineHtml);
orbitHtml = orbitHtml
  .replaceAll('/orbit-engine/', `${base}/orbit-engine/`)
  .replace('location.pathname.startsWith("/mywork/orbit-engine/")', 'location.pathname.includes("/orbit-engine/")')
  .replace('history.replaceState(null,"","/"+location.search+location.hash)', 'history.replaceState(null,"","/"+location.search+location.hash)');
write(engineHtml, orbitHtml);

const bundlePath = path.join(dist, 'orbit-engine', 'assets', 'index-4CfOS7fy.js');
let bundle = read(bundlePath)
  .replaceAll('/orbit-engine/content.json', `${base}/orbit-engine/content.json`)
  .replaceAll('"orbit-engine/assets/', '"mywork/orbit-engine/assets/');
write(bundlePath, bundle);

const orbitCss = path.join(dist, 'orbit-engine', 'assets', 'index-9ra7EZ0C.css');
write(orbitCss, read(orbitCss).replace(/@font-face\{[^}]*\}/g, ''));

const contentPath = path.join(dist, 'orbit-engine', 'content.json');
const content = JSON.parse(read(contentPath), (_key, value) =>
  typeof value === 'string' ? value.replace(/^\/assets\//, `${base}/assets/`) : value);
write(contentPath, JSON.stringify(content));
console.log(`Prepared ${dist} for https://cheng607.github.io/mywork/`);

