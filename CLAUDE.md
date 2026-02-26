# LinkedIn Writer — Project Guide

## Overview
Single-page web app for generating AI-powered LinkedIn posts with optional infographic generation. No build step, no framework — vanilla HTML/CSS/JS.

## Files
- `index.html` — all markup and UI structure
- `app.js` — all application logic (~814 lines)
- `styles.css` — all styling
- `package.json` — dev script only (`npx serve . -p 3000`)
- `start.bat` — launches `python -m http.server 3000` and opens browser

## Running
```
npm start          # npx serve . -p 3000
# or
start.bat          # python http.server on port 3000
```
Open `http://localhost:3000`

## Architecture

### State & DOM
- Global `state` object holds runtime data and settings (persisted to `localStorage`)
- All DOM refs are in the `els` object (keyed by element ID, via `$ = id => document.getElementById(id)`)

### AI Providers
- **OpenAI**: GPT-4o for post text; `gpt-image-1` for infographic images
- **Anthropic**: Claude 3.5 for post text only (no infographic support)
- `callAI()` — unified text call (routes to provider based on `state.settings.provider`)
- `callOpenAI()` — OpenAI-only calls (used internally for takeaway extraction)
- Infographics require an OpenAI key regardless of the selected text provider

### Key Functions (app.js)
| Function | Lines | Purpose |
|---|---|---|
| `handleGenerate()` | ~224 | Main post generation pipeline |
| `generateInfographic()` | 399–524 | Infographic pipeline (takeaways + image) |
| `renderImageOnCanvas()` | 526–546 | Renders base64 image to canvas |
| `regenerateInfographic()` | 548–554 | Re-runs infographic with current theme |
| `downloadInfographic()` | 556–572 | PNG download from canvas |
| `handleAnalyze()` | — | Post analysis tab |
| `loadSettings()` / `saveSettings()` | — | localStorage persistence |

## Infographic Pipeline
1. Extract 3 short takeaways from post text via `callOpenAI()`
2. Determine headline using priority chain:
   - **Custom infographic title** (`#infographicTitle`) — user override
   - **Post Title** (`#postTitle`) — if provided
   - **Topic** (`#topic`)
   - First AI takeaway
   - "Key Insights" (hard default)
3. Build theme-specific DALL-E prompt with headline + takeaways
4. Call `gpt-image-1` API → base64 image
5. Render to `#infographicCanvas`

### Infographic Themes
- `shock` — dark background, fiery orange/gold, high-impact editorial
- `dark` — near-black, gold accents, cinematic illustration
- `light` — white/light background, clean professional
- `sign` — minimalist typographic white sign on wall

## Key Input Fields
| ID | Purpose |
|---|---|
| `topic` | Main subject for post generation |
| `postTitle` | Opening headline for the post (optional) |
| `roleContext` | User's role/persona for AI context |
| `infographicTitle` | Manual override for infographic headline (optional) |
| `stylePost` | Example post used to match writing style |

## Settings (persisted to localStorage)
Provider, API keys (OpenAI + Anthropic), writing tone, post length (1–3 scale), emoji toggle, hashtag toggle, style post example, show-prompts toggle.
