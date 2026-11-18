# North Pole Gift Exchange

A responsive Christmas themed participant and organizer interface for a secret gift exchange. Open `index.html` to preview it.

## Important: preview mode only

This prototype stores participants, access codes, the organizer password, and the full draw ledger in the browser's `localStorage`. Anyone with browser access can inspect or change that data. It is useful for previewing the experience, but **must not be used for a real secret draw or published with real draw information**.

GitHub Pages is static hosting. It cannot authenticate participants or keep the draw ledger private on its own. To run the real exchange, connect this interface to a trusted backend (for example Supabase, Firebase, or a small server) that:

- stores participant credentials and draw assignments privately;
- validates participant sign-in on the server;
- atomically assigns one eligible recipient per giver, excluding the giver and already-picked recipients;
- returns a participant only their own result;
- exposes the complete ledger only to an authenticated organizer;
- rate-limits login attempts and stores secrets as server-side environment variables.

Do not commit real participant access codes, passwords, or draw results to the public GitHub repository. The included starter roster is only the names supplied for this prototype.

## Included interactions

- Participant sign-in by registered name and organizer-issued access code
- Animated roulette-style reveal and sound effects
- Draw tracking that excludes an already-selected recipient
- Organizer view with participant list, access-code setup, private ledger, export, and reset controls
- Responsive layout and reduced reliance on external assets

The default organizer password in preview mode is `santa`. Change it in the organizer view for local demonstration only; this does not make the public deployment secure.
