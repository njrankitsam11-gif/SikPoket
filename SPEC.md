# SikPoket Extension Architecture & Specifications

## Overview
SikPoket is a Chrome extension designed to save and organize data, including URLs, API keys, passwords, and notes.
It features two main interfaces:
1. **Popup:** A quick-access UI for saving and managing data on the fly.
2. **Dashboard:** A full-page UI (Workspace/Spaces) for more advanced organization and theming.

## Data Storage
- Both the Popup and Dashboard need to stay in sync.
- The primary storage key used by the `chrome.storage.local` API is unified across the application.
- The popup stores raw items categorized into `urls`, `apiKeys`, `passwords`, and `notes` under the `sikpoketData` key.
- The dashboard is responsible for reading the `sikpoketData` from the popup and migrating it into the active space. Once migrated, items are maintained inside the space. The dashboard uses a shared type mapping structure to translate these keys properly.

## Theming
- The extension supports multiple themes: `default`, `cyberpunk`, `lofi`, `nord`, and `lavender`.
- The theme is configured in the Dashboard's "Space Settings" and should be applied to both the Dashboard and the Popup.
- The `syncTheme` function is utilized in `popup.js` to read the active theme from the active space's configuration and applies the appropriate CSS classes or variables dynamically.

## Biometric / Auth
- For additional security, there is an authentication layer (`unlock.html` / `unlock.js`).

## New Features
1. **Password Generator:** Integrated directly into the popup. Uses cryptographically secure \`window.crypto.getRandomValues\` to generate strong passwords instantly.
2. **Global Search:** The dashboard sidebar search now aggregates and searches across all spaces, returning results mapped to their respective spaces.
3. **Right-Click Integration (Context Menu):** Users can right click links, selections, and pages to save them instantly to SikPoket from any page.
4. **Markdown Support:** Notes in the dashboard are now parsed via a lightweight regex-based Markdown engine, supporting bold, italics, lists, and headings.
5. **Custom Theme Builder:** Users can choose "Custom Theme Builder" in Space Settings and define custom Accent and Background colors utilizing native HTML5 color pickers.
