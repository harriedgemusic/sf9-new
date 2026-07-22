/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Final Beatspotto SVG Icon (Master Vector)
const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Dark Glass Backdrop -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c1524" />
      <stop offset="50%" stop-color="#070c17" />
      <stop offset="100%" stop-color="#03050a" />
    </linearGradient>

    <!-- Glowing Emerald Spotify Brand Gradient -->
    <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1ed760" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>

    <linearGradient id="brand-light" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>

    <!-- Extended Mix Zap Cyan Glow -->
    <linearGradient id="accent-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f59b" />
      <stop offset="50%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>

    <!-- Vinyl Ring Gradients -->
    <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.6" />
      <stop offset="50%" stop-color="#00f59b" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#059669" stop-opacity="0.5" />
    </linearGradient>

    <linearGradient id="border-glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.65" />
      <stop offset="50%" stop-color="#10b981" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#059669" stop-opacity="0.4" />
    </linearGradient>

    <!-- Filter Effects -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="zap-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.7" />
    </filter>
  </defs>

  <!-- Base Squircle Frame -->
  <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#bg)" stroke="url(#border-glow)" stroke-width="5" filter="url(#soft-shadow)" />

  <!-- Outer Vinyl Groove / Radial Sound Ring -->
  <circle cx="256" cy="256" r="192" fill="none" stroke="url(#ring-grad)" stroke-width="4" />
  <circle cx="256" cy="256" r="160" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.2" stroke-dasharray="12 8" />

  <!-- Spotify Sound Waves (Tilted & curved matching official Spotify wave geometry) -->
  <g filter="url(#glow)">
    <!-- Wave 1 (Top) -->
    <path d="M 125,205 C 195,160 305,180 360,225" fill="none" stroke="url(#brand-grad)" stroke-width="26" stroke-linecap="round" />
    <!-- Wave 2 (Middle) -->
    <path d="M 142,265 C 205,225 295,242 342,282" fill="none" stroke="url(#brand-grad)" stroke-width="26" stroke-linecap="round" />
    <!-- Wave 3 (Bottom) -->
    <path d="M 165,325 C 218,290 282,305 322,340" fill="none" stroke="url(#brand-grad)" stroke-width="26" stroke-linecap="round" />

    <!-- Equalizer Download Bars at Right Side -->
    <rect x="366" y="270" width="16" height="50" rx="8" fill="url(#brand-light)" />
    <rect x="390" y="240" width="16" height="85" rx="8" fill="url(#brand-grad)" />
    <rect x="414" y="285" width="16" height="40" rx="8" fill="url(#brand-light)" />
  </g>

  <!-- Extended Mix Zap Lightning Emblem (Top Right) -->
  <g filter="url(#zap-glow)">
    <path d="M 370,95 L 322,175 L 354,175 L 316,255 L 402,150 L 362,150 Z" fill="url(#accent-cyan)" />
  </g>
</svg>`;

async function generateAll() {
  const publicDir = path.join(__dirname, '..', 'public');
  const appDir = path.join(__dirname, '..', 'src', 'app');

  // Save SVG files
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterSvg);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), masterSvg);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), masterSvg);
  fs.writeFileSync(path.join(appDir, 'icon.svg'), masterSvg);

  const svgBuffer = Buffer.from(masterSvg);

  // Generate PNG files at various resolutions
  const targets = [
    { dir: publicDir, name: 'favicon-16x16.png', size: 16 },
    { dir: publicDir, name: 'favicon-32x32.png', size: 32 },
    { dir: publicDir, name: 'apple-icon.png', size: 180 },
    { dir: publicDir, name: 'icon-192.png', size: 192 },
    { dir: publicDir, name: 'icon-512.png', size: 512 },
    { dir: appDir, name: 'apple-icon.png', size: 180 },
    { dir: appDir, name: 'icon.png', size: 512 },
  ];

  for (const t of targets) {
    await sharp(svgBuffer).resize(t.size, t.size).png().toFile(path.join(t.dir, t.name));
  }

  // Generate ICO (32x32 PNG inside ico container)
  const ico32Buffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico32Buffer);
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), ico32Buffer);

  console.log('Successfully generated all Beatspotto favicons and icons!');
}

generateAll().catch(err => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
});
