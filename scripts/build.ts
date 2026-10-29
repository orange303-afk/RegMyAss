import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');

async function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

function copyStatic() {
  const publicDir = resolve(rootDir, 'public');
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, distDir, { recursive: true });
  }
  const manifestPath = resolve(distDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function runBuild() {
  console.log('🚀 Building RegMyAss Extension...');
  await cleanDist();

  // 1. Build UI pages (popup & options)
  console.log('📦 1/3 Building Popup and Options UI...');
  await build({
    root: rootDir,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: distDir,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          popup: resolve(rootDir, 'popup.html'),
          options: resolve(rootDir, 'options.html'),
        },
      },
    },
  });

  // 2. Build Background Service Worker (ES module)
  console.log('⚙️  2/3 Building Background Service Worker...');
  await build({
    root: rootDir,
    plugins: [],
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'src/background/service-worker.ts'),
        name: 'QuickPassBackground',
        formats: ['es'],
        fileName: () => 'background.js',
      },
    },
  });

  // 3. Build Content Script (IIFE - self contained for webpage isolation)
  console.log('🛡️  3/3 Building Content Script...');
  await build({
    root: rootDir,
    plugins: [],
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'src/content/content-script.ts'),
        name: 'QuickPassContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
    },
  });

  // 4. Copy static assets (manifest.json, icons)
  copyStatic();
  console.log('✅ Build complete! Unpacked extension is ready in dist/');
}

runBuild().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
