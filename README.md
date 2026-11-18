# North Pole Gift Exchange

A Christmas themed exchange draw website. GitHub Pages hosts the public `index.html`; Supabase securely stores participant codes, sessions, and draw assignments so participants can sign in from different devices and browsers. Draw progress refreshes every three seconds.

## Files to publish

Keep this structure in the top level of your GitHub repository:

```text
index.html
README.md
supabase/
  config.toml
  schema.sql
  functions/
    exchange/
      index.ts
```

The page's design and browser code are inside `index.html`. The `supabase` folder contains the database setup and private server function. Do not upload only the ZIP, and never add a service-role key, organizer password, or `.env` file to GitHub.

## One-time Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**, copy all of `supabase/schema.sql`, and run it. This creates the private tables, seeds the 28 names, and installs the secure draw and login-rate-limit functions.
3. In the project dashboard, find the project URL and **publishable key** (sometimes shown as the `anon` key). These two values are safe to use in the public page.
4. Edit the two constants near the top of `index.html`:

   ```js
   const SUPABASE_URL='https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_PUBLISHABLE_KEY='YOUR-PUBLISHABLE-KEY';
   ```

5. Install the Supabase CLI, then from this folder run:

   ```sh
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set EXCHANGE_ADMIN_PASSWORD='choose-a-long-unique-password' EXCHANGE_PEPPER='use-a-long-random-secret-value'
   supabase functions deploy exchange
   ```

   Use a unique organizer password and a different random pepper. These are stored as Supabase server secrets. The function also uses the project service-role secret supplied by Supabase; **never copy it into `index.html` or GitHub**.

6. Upload `index.html`, `README.md`, and the complete `supabase` folder to the root of your GitHub repository and commit the changes.
7. In GitHub, open **Settings → Pages**. Select **Deploy from a branch**, choose your branch (usually `main`) and **`/ (root)`**, then save.
8. Open the website URL shown in the Pages settings. Do not use a `github.com/.../blob/...` URL; that displays source files.

## Before inviting participants

Open the Pages URL, select **Admin**, and sign in with the organizer password you set in Supabase. Set a personal access code for each participant, then share each code privately. Participant codes must be at least four characters; use unique codes.

The first participant to draw causes the server to create a complete no-self, one-to-one assignment. Each participant can retrieve only their own assignment. The admin ledger shows only completed draws. Public status shows only the number of completed draws, and refreshes every three seconds. Adding names after the first draw is blocked; reset the exchange first if the roster needs changing.

## Troubleshooting

- **Setup warning remains:** Check the two values in `index.html`, commit the changes, and wait for the Pages deployment to finish.
- **Login or draw request fails:** Confirm `supabase/schema.sql` ran successfully and `supabase functions deploy exchange` completed for the same project URL.
- **Organizer login fails:** Check the `EXCHANGE_ADMIN_PASSWORD` secret in Supabase. Updating a secret takes effect without redeploying the function.
- **The page shows README text or HTML source:** Open the GitHub Pages link shown under **Settings → Pages**, not the repository file view. Confirm `index.html` is at the publishing folder's top level.

## Privacy and operating notes

The service function hashes participant access codes with PBKDF2 and stores only hashes. Participant and organizer sessions expire after 12 hours. Login attempts are limited by source IP. Database tables have row-level security enabled without browser-access policies; the service function performs authorized access. Keep the repository's publishable key only; the project service-role key is highly privileged and must remain a Supabase secret.
