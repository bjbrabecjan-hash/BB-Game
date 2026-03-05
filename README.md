# Bubbles & Balloons

A tiny toddler-friendly web game for very young children (around 15 months): tap the screen or press keys to create one gentle bubble or balloon.

The project is intentionally calm and non-addictive:
- No score, no levels, no rewards, no streaks.
- Calm Mode is ON by default.
- Sound is OFF by default.
- Session ends after 3 minutes with a break message.
- Idle state appears after 30 seconds without interaction.

## Tech

- Plain HTML, CSS, and Vanilla JavaScript
- Static files only (works on GitHub Pages)
- No frameworks, no analytics, no external fonts, no CDNs
- Offline-ready (all assets local, no network dependencies)

## File Structure

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `LICENSE` (MIT)

## Run Locally

You can open `index.html` directly, or serve the folder with a simple static server.

### Option 1: Open directly

1. Double-click `index.html`.

### Option 2: Use Python static server

1. In this folder, run:
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Add these files to the repository root.
3. Commit and push:
   ```bash
   git init
   git add .
   git commit -m "Add toddler-friendly Bubbles & Balloons"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   ```
4. In GitHub: `Settings` -> `Pages`.
5. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/** (root)
6. Save and wait for deployment.
7. Open the provided Pages URL.

## Parent Controls

A small `Parent` panel in the corner includes:
- `Sound` toggle (default Off)
- `Calm Mode` toggle (default On)
- `Fullscreen` toggle
- `Restart` button (requires 2-second press-and-hold)

When Calm Mode is On:
- Motion is reduced.
- Sound is automatically disabled.

If the device has `prefers-reduced-motion` enabled, Calm Mode is forced on.

In Fullscreen mode:
- On mouse play, pointer lock is requested automatically to keep focus in the play area.
- Browsers still allow system-level exit (for example `Esc`) for safety.
- Fullscreen uses standard + Safari (`webkit`) APIs. On older iOS versions, element fullscreen can still be limited by browser policy.
- On phones where element fullscreen is blocked, the app uses an immersive fallback mode from the same button.
- For the most reliable true fullscreen on iPhone, open it from Home Screen (Add to Home Screen).

### Sound Profiles

`app.js` includes 3 gentle sound profiles:
- `extra-soft`
- `soft` (default)
- `soft-plus`

To switch, change:

```js
const ACTIVE_SOUND_PROFILE = "soft";
```

## Toddler-Safe / Non-Addictive Design Notes

- Gentle pastel visuals and subtle gradient background.
- No flashing, no strobing, no rapid scale effects.
- Spawn rate throttled to max 1 object per 300 ms.
- Maximum 12 objects on screen (oldest removed first).
- No competitive or reward mechanics.
- Automatic break prompt after 3 minutes.
- Idle calm screen after 30 seconds with no interaction.

## Accessibility & Safety

- Supports touch/mouse via pointer events and keyboard input.
- Uses low-motion defaults and honors `prefers-reduced-motion`.
- Prevents text selection and scroll/bounce behavior for smoother mobile use.
- Keeps CPU use low with simple DOM elements and capped object count.

## License

MIT License. See `LICENSE`.
