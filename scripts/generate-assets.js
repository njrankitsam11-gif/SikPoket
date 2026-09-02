#!/usr/bin/env node

/**
 * SikPoket Chrome Web Store Asset Generator
 * Generates official high-resolution promo tiles (1280x800 marquee and 440x280 small tile) in SVG format.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets/store');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Large Promo Tile / Marquee (1280x800)
const marqueeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#1f1828"/>
      <stop offset="60%" stop-color="#120f17"/>
      <stop offset="100%" stop-color="#09070c"/>
    </radialGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="50%" stop-color="#7c6af7"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="60" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1280" height="800" fill="url(#bgGrad)"/>

  <!-- Ambient Glow Orbs -->
  <circle cx="640" cy="380" r="300" fill="#7c6af7" opacity="0.18" filter="url(#glow)"/>
  <circle cx="1000" cy="600" r="220" fill="#a78bfa" opacity="0.12" filter="url(#glow)"/>

  <!-- Top Badge -->
  <g transform="translate(640, 100)">
    <rect x="-140" y="-18" width="280" height="36" rx="18" fill="rgba(167, 139, 250, 0.12)" stroke="rgba(167, 139, 250, 0.35)" stroke-width="1.5"/>
    <text text-anchor="middle" y="5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#c4b5fd" letter-spacing="1.5">🔒 ZERO-KNOWLEDGE ENCRYPTION</text>
  </g>

  <!-- Main Title -->
  <text text-anchor="middle" x="640" y="190" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="56" font-weight="800" fill="#ffffff" letter-spacing="-1">
    SikPoket
  </text>
  <text text-anchor="middle" x="640" y="240" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#9ca3af">
    Your Private Web Sanctuary — Bookmarks, Notes, Side Panel &amp; On-Device AI
  </text>

  <!-- Main Dashboard / UI Mockup Container -->
  <g transform="translate(190, 290)">
    <!-- Outer Window Card -->
    <rect width="900" height="460" rx="16" fill="#17131d" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5"/>
    
    <!-- Window Header -->
    <rect width="900" height="42" rx="16" fill="#130f18"/>
    <circle cx="24" cy="21" r="6" fill="#ef4444"/>
    <circle cx="44" cy="21" r="6" fill="#f59e0b"/>
    <circle cx="64" cy="21" r="6" fill="#10b981"/>
    <text x="450" y="26" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#6b7280">sikpoket.app — Private Vault (AES-GCM)</text>

    <!-- Sidebar Mock -->
    <rect x="0" y="42" width="200" height="418" fill="#130f18" opacity="0.8"/>
    <text x="24" y="80" font-family="sans-serif" font-size="11" font-weight="700" fill="#9ca3af" letter-spacing="1">SPACES</text>
    <rect x="16" y="96" width="168" height="32" rx="6" fill="rgba(124, 106, 247, 0.2)"/>
    <text x="32" y="117" font-family="sans-serif" font-size="13" font-weight="600" fill="#ffffff">🧠 Research &amp; AI</text>
    <text x="32" y="152" font-family="sans-serif" font-size="13" font-weight="500" fill="#9ca3af">💼 Work Projects</text>
    <text x="32" y="186" font-family="sans-serif" font-size="13" font-weight="500" fill="#9ca3af">🎧 Focus &amp; Lo-Fi</text>
    <text x="32" y="220" font-family="sans-serif" font-size="13" font-weight="500" fill="#9ca3af">📖 Reading List</text>

    <!-- Content Cards Grid -->
    <g transform="translate(224, 60)">
      <!-- Card 1 -->
      <rect width="310" height="170" rx="10" fill="#1f1a26" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
      <text x="16" y="32" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff">Anthropic Prompt Engineering</text>
      <text x="16" y="54" font-family="sans-serif" font-size="11" fill="#7c6af7">docs.anthropic.com</text>
      <rect x="16" y="70" width="278" height="44" rx="6" fill="#16121c"/>
      <text x="26" y="96" font-family="sans-serif" font-size="11" fill="#c4b5fd">✨ AI: Chain-of-thought system prompts…</text>
      <rect x="16" y="130" width="70" height="20" rx="4" fill="rgba(144, 152, 212, 0.15)"/>
      <text x="26" y="144" font-family="sans-serif" font-size="10" fill="#a78bfa">#ai-research</text>
      <text x="235" y="144" font-family="sans-serif" font-size="11" fill="#9ca3af">📱 QR Code</text>

      <!-- Card 2 -->
      <g transform="translate(330, 0)">
        <rect width="310" height="170" rx="10" fill="#1f1a26" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
        <text x="16" y="32" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff">Deep Work Research Notes</text>
        <text x="16" y="54" font-family="sans-serif" font-size="11" fill="#10b981">⏱ 4 min read (840 words)</text>
        <text x="16" y="86" font-family="sans-serif" font-size="12" fill="#9ca3af">Flow state triggers &amp; time blocks…</text>
        <rect x="16" y="130" width="80" height="20" rx="4" fill="rgba(16, 185, 129, 0.15)"/>
        <text x="24" y="144" font-family="sans-serif" font-size="10" fill="#34d399">#productivity</text>
      </g>

      <!-- Card 3 (Bottom) -->
      <g transform="translate(0, 190)">
        <rect width="640" height="170" rx="10" fill="#1f1a26" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>
        <text x="16" y="32" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff">📑 Active Research Session (8 Tabs)</text>
        <text x="16" y="54" font-family="sans-serif" font-size="11" fill="#9ca3af">Captured from Window 1 • 1-Click Restore Available</text>
        <rect x="16" y="72" width="140" height="28" rx="6" fill="#7c6af7"/>
        <text x="36" y="90" font-family="sans-serif" font-size="12" font-weight="600" fill="#ffffff">⚡ Restore All Tabs</text>
      </g>
    </g>
  </g>
</svg>`;

// 2. Small Promo Tile (440x280)
const smallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280" width="440" height="280">
  <defs>
    <radialGradient id="smGrad" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#241a30"/>
      <stop offset="100%" stop-color="#0f0c13"/>
    </radialGradient>
  </defs>
  <rect width="440" height="280" fill="url(#smGrad)"/>
  <circle cx="220" cy="140" r="120" fill="#7c6af7" opacity="0.25" filter="blur(40px)"/>
  
  <g transform="translate(220, 75)">
    <rect x="-24" y="-24" width="48" height="48" rx="12" fill="#7c6af7"/>
    <text x="0" y="8" text-anchor="middle" font-size="24">🔐</text>
  </g>
  
  <text text-anchor="middle" x="220" y="145" font-family="sans-serif" font-size="28" font-weight="800" fill="#ffffff" letter-spacing="-0.5">SikPoket</text>
  <text text-anchor="middle" x="220" y="172" font-family="sans-serif" font-size="13" font-weight="500" fill="#c4b5fd">Secure Bookmarks, Side Panel &amp; Notes</text>
  <text text-anchor="middle" x="220" y="215" font-family="sans-serif" font-size="11" font-weight="700" fill="#9ca3af" letter-spacing="1">100% LOCAL-FIRST • ZERO-KNOWLEDGE</text>
</svg>`;

fs.writeFileSync(path.join(assetsDir, 'promo-1280x800.svg'), marqueeSvg, 'utf8');
fs.writeFileSync(path.join(assetsDir, 'promo-440x280.svg'), smallSvg, 'utf8');

console.log('✅ Successfully generated Chrome Web Store promo assets (SVG):');
console.log('   - assets/store/promo-1280x800.svg (Marquee 1280x800)');
console.log('   - assets/store/promo-440x280.svg (Small Tile 440x280)\n');

// On macOS, automatically render SVG to pixel-perfect PNG using native qlmanage & sips
try {
  execSync(`qlmanage -t -s 1280 -o "${assetsDir}" "${path.join(assetsDir, 'promo-1280x800.svg')}" > /dev/null 2>&1`);
  execSync(`qlmanage -t -s 440 -o "${assetsDir}" "${path.join(assetsDir, 'promo-440x280.svg')}" > /dev/null 2>&1`);
  
  const raw1280 = path.join(assetsDir, 'promo-1280x800.svg.png');
  const raw440 = path.join(assetsDir, 'promo-440x280.svg.png');
  
  if (fs.existsSync(raw1280)) {
    execSync(`sips --cropToHeightWidth 800 1280 "${raw1280}" --out "${path.join(assetsDir, 'promo-1280x800.png')}" > /dev/null 2>&1`);
    fs.unlinkSync(raw1280);
  }
  if (fs.existsSync(raw440)) {
    execSync(`sips --cropToHeightWidth 280 440 "${raw440}" --out "${path.join(assetsDir, 'promo-440x280.png')}" > /dev/null 2>&1`);
    fs.unlinkSync(raw440);
  }

  console.log('✅ Successfully rendered Chrome Web Store promo assets (PNG):');
  console.log('   - assets/store/promo-1280x800.png (1280x800 Marquee PNG)');
  console.log('   - assets/store/promo-440x280.png (440x280 Small Tile PNG)\n');
} catch (e) {
  console.log('ℹ PNG generation skipped or not supported on this platform.');
}

