# ChatGPT Usage Tracker

A browser extension that shows your estimated ChatGPT message usage - per model, per plan - right in the corner of the chat page. Same idea as the Claude usage tracker extensions, adapted to how ChatGPT actually works.

## Why "estimated"

Claude's web app has a real internal `/usage` endpoint the official UI itself calls, so a browser extension can just call that same endpoint and show an exact number. **ChatGPT's main chat app has no equivalent.** There is no live "you have N messages left" API for the regular chat interface - OpenAI's UI only tells you *after* you've hit a limit.

So this extension does the same thing every other ChatGPT usage tracker does: it watches the model name in your own outgoing chat requests, timestamps each one locally, and compares the count in a rolling time window against OpenAI's *published* (but not officially guaranteed, and they change periodically) per-plan limits. The numbers you see are a good-faith estimate based on your real usage, not a value ChatGPT reports directly.

Because the underlying limits drift over time and aren't always public, every model's quota and time-window is editable right in the popup (**Edit limit**) if what you see doesn't match reality.

## What it does

- Detects which model you're chatting with from your own message requests (no new network traffic - it only reads requests your browser already sends).
- Tracks usage per model in a rolling time window (e.g. "142 / 160 in the last 3 hours").
- Shows a collapsible progress-bar overlay in the corner of chatgpt.com, plus the same view in the toolbar popup.
- Lets you switch between Free / Plus / Pro / Team so the right set of models and limits are shown.
- Lets you override any model's quota/window, or reset counts, if the defaults are wrong for your account.
- 100% local - see [PRIVACY.md](./PRIVACY.md) for the full breakdown.

## Install (developer mode, for now)

This isn't on the Chrome Web Store yet. To try it:

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder.
4. Open [chatgpt.com](https://chatgpt.com) - a small "Usage" tab appears in the bottom-right corner.
5. Click the extension icon in the toolbar to change your plan or edit limits.

The tracker starts counting from when you install it - it has no way to see messages sent before that.

## Project structure

```
manifest.json       Manifest V3 config
src/background.js   Service worker: detects model + records timestamps, computes usage snapshots
src/logic.js         Pure calculation logic (model matching, quota-window math) - unit tested
src/content.js       Injects the on-page overlay (Shadow DOM, no CSS collisions with ChatGPT's own styles)
src/popup.html/js    Toolbar popup: plan selector, per-model breakdown, custom limit editor
src/quota.json       Default per-plan model limits (editable per-model in the popup)
icons/               Extension icons
test/                Automated tests for src/logic.js, plus a dev-only visual harness for the popup
```

## Development

```bash
npm install
npm test          # runs test/logic.test.js against src/logic.js
npm run make-icons  # regenerates icons/*.png from scripts/make-icons.mjs
```

`test/popup-harness.html` loads the real `popup.html`/`popup.js` with a stubbed `chrome.*` API and mock usage data, for checking the popup's visual layout without a real extension install. Serve the project root over HTTP (not `file://`, which blocks the harness's `fetch` call) and open `test/popup-harness.html`.

## Known limitations

- **Estimates only** - see "Why estimated" above. Counts reset to zero on install/reinstall and don't retroactively account for messages sent before the extension was active.
- **Model-slug drift** - if OpenAI renames or adds a model slug this extension doesn't recognize, that model's messages won't be counted until `src/quota.json` is updated (PRs welcome).
- Only detects the plain `/backend-api/conversation` (and versioned variants) request shape as of this writing - if OpenAI changes the request format, detection may need an update.

## License

MIT
