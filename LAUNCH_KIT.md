# 🚀 SikPoket v1.8.0 — Complete Launch Marketing Kit

Everything is tailored around SikPoket's core superpowers:
**100% local-first, zero-knowledge encryption, 2D force-directed knowledge graph, distraction-free reader mode with TTS, and instant Notion/Obsidian export.**

---

## 1. 🐱 Product Hunt Launch

### Listing Metadata
- **Product Name:** SikPoket
- **Tagline (under 60 chars):** Zero-knowledge knowledge vault & 2D mindmap for your web
- **Pricing:** Free & 100% Open Source
- **Topics:** `Productivity`, `Developer Tools`, `Privacy`, `Open Source`, `Chrome Extensions`
- **Live Demo Link:** https://sikpoket.vercel.app
- **GitHub Repository:** https://github.com/njrankitsam11-gif/SikPoket

---

### Product Hunt Description (Short Bio)
> Most bookmark tools are clunky, collect your personal browsing habits, and store your data on centralized servers.
> 
> **SikPoket** is a 100% local-first, zero-knowledge browser vault and knowledge operating system:
> - 🔒 **Zero-Knowledge Security:** Client-side AES-256-GCM + PBKDF2 (100,000 iterations). Your secrets and notes never touch any server.
> - 🕸️ **2D Interactive Knowledge Graph:** Canvas-driven force-directed mindmap linking your notes, tags, and articles visually.
> - ⚡ **Spotlight Palette (`Cmd+K`):** Blazing-fast keyboard search and actions across all your spaces.
> - 📖 **Reader Mode + Text-to-Speech:** Clean read view with voice narration and reading time estimates.
> - 🎧 **Ambient Audio:** Rain, Lo-Fi, and Cafe sounds built right into the app.
> - 💎 **Multi-Format Export:** 1-click export to Obsidian markdown vaults, Notion CSVs, or Netscape HTML bookmarks.

---

### Product Hunt Maker Comment (Post immediately after publishing)
```markdown
Hey Product Hunt! 👋

I'm the creator of SikPoket, and I built this because I was tired of bookmark managers that:
1. Lock my data behind paid subscriptions
2. Upload every page I browse to their company servers
3. Become graveyard lists of links I never look at again

SikPoket is designed to feel like a high-end knowledge studio right in your browser:

✨ 100% Local-First & Zero-Knowledge: Everything runs on your machine using the Web Crypto API (SubtleCrypto). No telemetry, no cloud accounts required.
✨ 2D Knowledge Graph: Watch your topics cluster into an interactive physics-based mindmap built with zero external dependencies.
✨ Spotlight Command Palette: Press `Cmd+K` to search, switch workspaces, change themes, or run tools with pure keyboard navigation.
✨ Smart Spaces: Separate Startups, Research, and Personal projects with customizable atmospheric wallpapers and lo-fi sound generators.
✨ One-Click Export: Full data portability to Obsidian, Notion, or standard HTML bookmarks whenever you want.

Try the live web dashboard right now (no signup required):
👉 https://sikpoket.vercel.app

It's fully open source:
⭐ https://github.com/njrankitsam11-gif/SikPoket

I'd love your honest feedback, feature requests, and questions! What’s your current bookmarking or vault setup?
```

---

## 2. 🐦 Twitter / X Launch Thread (Copy & Paste)

### Tweet 1 (The Hook 🎣)
> 🚨 Introducing SikPoket v1.8.0: The 100% local-first, zero-knowledge knowledge vault & 2D mindmap for your browser.
> 
> Most bookmark tools spy on your browsing habits and store data on cloud servers.
> 
> SikPoket is different: Zero servers. Military-grade AES-256-GCM encryption. Blazing fast. 🧵👇
> 
> [Attach screenshot: 01_dashboard_grid.png]

### Tweet 2 (The 2D Knowledge Graph 🕸️)
> 1/ Turn your bookmarks into a living 2D Mindmap.
> 
> SikPoket features a custom Canvas-based force-directed physics engine that connects your notes, research, and bookmarks by topic and tags in real time.
> 
> Zero external libraries. 60 FPS smooth interactions.
> 
> [Attach screenshot: 02_knowledge_graph.png]

### Tweet 3 (Spotlight Cmd+K ⚡)
> 2/ Blazing speed with Spotlight Command Palette (`Cmd+K`).
> 
> Search anything instantly, switch themes, navigate spaces, or trigger soundscapes without taking your hands off the keyboard. Full Vim shortcuts supported (`j`, `k`, `o`, `f`).
> 
> [Attach screenshot: 03_command_palette.png]

### Tweet 4 (Privacy & Crypto 🔒)
> 3/ True Zero-Knowledge Architecture.
> 
> - Web Crypto API (SubtleCrypto)
> - PBKDF2 (100,000 iterations)
> - AES-256-GCM authenticated encryption
> - Works 100% offline as a PWA
> 
> Not even I can see what you save.

### Tweet 5 (Export & Workflow 💎)
> 4/ Zero vendor lock-in.
> 
> Export your entire knowledge vault in 1 click:
> • 💎 Obsidian Markdown Vault (.zip with frontmatter & backlinks)
> • 📑 Notion Database CSV
> • 🌐 Standard Netscape HTML bookmarks
> • 📱 Mobile QR Code sync

### Tweet 6 (CTA & Links 🚀)
> Try the live web version right now (no signup required):
> 🔗 https://sikpoket.vercel.app
> 
> Star on GitHub:
> ⭐ https://github.com/njrankitsam11-gif/SikPoket
> 
> If you like privacy-focused tools, a RT & feedback is greatly appreciated! ❤️🔄

---

## 3. 📰 Hacker News (Show HN)

### Title:
`Show HN: SikPoket – Local-first, zero-knowledge knowledge vault with 2D force graph`

### Body:
```text
Hey HN,

I built SikPoket, an open-source, local-first knowledge manager and browser vault that runs completely client-side with zero server dependencies.

Live Web Demo: https://sikpoket.vercel.app
GitHub: https://github.com/njrankitsam11-gif/SikPoket

Key Architecture Choices:
1. Zero Knowledge Encryption: Uses the browser's native Web Crypto API (SubtleCrypto) with PBKDF2 (100,000 iterations) and AES-256-GCM. Passwords and secrets are encrypted with a unique salt per item before touching localStorage or chrome.storage.
2. Custom 2D Knowledge Graph: Built using HTML5 Canvas and Verlet/Euler numerical integration for force-directed node repulsion and spring forces. No external graph libraries (like D3 or Vis.js) were used, keeping CSP strict and bundle size small.
3. No Backend / No Telemetry: The app runs 100% inside your browser or as an offline PWA. It has zero external tracking or analytics scripts.
4. Data Portability: Generates structured Obsidian markdown vaults with YAML frontmatter, Notion CSVs, and Netscape bookmark HTML files natively.

Would love technical feedback on the crypto implementation and canvas physics engine!
```

---

## 4. 💬 Reddit Post (r/privacy, r/webdev, r/selfhosted)

### Title:
`I built a 100% local-first, zero-knowledge knowledge vault & 2D mindmap (Open Source)`

### Post Content:
```text
Hey everyone!

Like many of you, I've tried Pocket, Raindrop, and various bookmark managers, but I always hated having my reading habits and personal notes stored on third-party servers.

So I built **SikPoket** — a zero-knowledge, local-first knowledge operating system for your browser.

### Key Features:
- 🔒 **Zero-Knowledge Encryption:** Client-side AES-256-GCM + PBKDF2 (100k rounds) via Web Crypto SubtleCrypto.
- 🕸️ **2D Interactive Knowledge Graph:** Canvas-based physics graph that links your tags, notes, and research.
- ⚡ **Spotlight (`Cmd+K`):** Keyboard-driven command palette and search.
- 📖 **Reader Mode:** Distraction-free reader with native SpeechSynthesis text-to-speech.
- 🎧 **Focus Ambience:** Built-in rain, coffee shop, and lo-fi audio.
- 💎 **Export:** One-click export to Obsidian (.zip with markdown notes), Notion (.csv), or browser HTML.

Everything is completely open source under MIT. No signups, no servers, no ads.

- **Live Web Demo:** https://sikpoket.vercel.app
- **GitHub:** https://github.com/njrankitsam11-gif/SikPoket

Let me know what you think or if there are features you'd like to see!
```
