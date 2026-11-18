# North Pole Gift Exchange

A Christmas themed, single-page gift exchange prototype. The site is the `index.html` file in this repository.

## See the website on GitHub

Opening `index.html` in the GitHub repository shows the **HTML source code** as text. That is GitHub's file viewer; it does not run the page. To see the designed website, publish the repository with GitHub Pages and open its Pages address.

1. Upload `index.html` and `README.md` to the **top level** of your GitHub repository. Keep the file name exactly `index.html` (lowercase).
2. On GitHub, open the repository and select **Settings**.
3. In the left menu, select **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your website branch (usually `main`) and folder **`/ (root)`**, then select **Save**.
6. Wait for the Pages deployment to finish. The Pages panel will show the website link. Open that link to use the site; it usually looks like `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

After editing the website, commit the updated `index.html` to the selected branch and refresh the Pages link. It can take a few minutes for a new deployment to appear. If you still see source text, check that you opened the Pages link (not the `github.com/.../blob/.../index.html` file link), that `index.html` is at the selected publishing folder's top level, and that the latest Pages deployment succeeded under the repository's **Actions** tab.

## Important: preview mode only

This prototype stores participant names, access codes, the organizer password, and the draw ledger in that browser's `localStorage`. Anyone with access to the browser can inspect or change the data. Browser data also does not sync between participants' devices. Use this only to preview the interface; **do not use it for the real secret exchange**.

GitHub Pages is static hosting. It cannot authenticate participants or keep the draw ledger private by itself. For the real exchange, connect the site to a trusted backend (for example Supabase, Firebase, or a small server) that:

- stores participant credentials and draw assignments privately;
- validates participant sign-in on the server;
- assigns one eligible recipient per giver without assigning anyone to themselves or assigning a recipient twice;
- returns a participant only their own result;
- exposes the complete ledger only to an authenticated organizer; and
- rate-limits login attempts and keeps secrets in server-side environment variables.

Do not commit real participant access codes, passwords, or draw results to a public repository. The starter roster is the list supplied for this prototype.

## Included interactions

- Participant sign-in by registered name and organizer-issued access code
- A 10-second animated roulette popup with sound effects and a large recipient reveal
- Draw tracking that excludes already-selected recipients and avoids a dead-end assignment
- Organizer view with participant management, access-code setup, draw ledger, export, and reset controls
- Responsive layout with a Christmas theme

The default organizer password in preview mode is `santa`. Change it in the organizer view for local demonstration only; this does not make a public deployment secure.
