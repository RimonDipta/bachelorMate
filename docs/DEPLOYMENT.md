# Deploying BachelorMate

BachelorMate needs a **long-running Node server**, because chat, typing indicators and presence use WebSockets (Socket.IO). Vercel/Netlify *serverless functions* can't host the API. The recommended setup:

| Piece | Service | Cost |
| --- | --- | --- |
| Database | MongoDB Atlas | Free M0 cluster |
| App (API + frontend, one URL) | Render web service | Free tier works (sleeps after 15 min idle); Starter for always-on |

> **Option A (recommended): one service.** The API serves the built React app, so the frontend, API and WebSockets share one domain. Cookies are first-party and there's no CORS setup.
> **Option B: frontend on Vercel, API on Render.** See the end of this guide.

---

## Step 1: Create the database (MongoDB Atlas)

1. Sign up at https://www.mongodb.com/cloud/atlas and create a **free M0 cluster**.
2. **Database Access** → *Add New Database User* → username + strong password (role: *Read and write to any database*).
3. **Network Access** → *Add IP Address* → `0.0.0.0/0` (Render's IPs change, so the password is the protection).
4. **Connect** → *Drivers* → copy the connection string and add a database name before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/bachelormate?retryWrites=true&w=majority
   ```
   Atlas clusters are replica sets, so money operations run inside transactions.

## Step 2: Push the code to GitHub

```bash
git push -u origin feature/bachelormate-rebuild
```
Deploy that branch, or merge it into `main` first and deploy `main`.

## Step 3: Create the app on Render

1. Sign up at https://render.com with GitHub.
2. **New → Blueprint** → choose the `bachelorMate` repository (and branch). Render reads [`render.yaml`](../render.yaml) and proposes a web service called **bachelormate**.
3. Fill in the three values it asks for:
   | Key | Value |
   | --- | --- |
   | `MONGO_URI` | the Atlas string from step 1 |
   | `CLIENT_URL` | `https://bachelormate.onrender.com` (your service URL; if the name is taken Render shows the real one, so update it after the first deploy) |
   | `CORS_ORIGINS` | same as `CLIENT_URL` |
4. Click **Apply**. The first build takes 3–5 minutes. `JWT_ACCESS_SECRET` is generated automatically.
5. Open your URL. Because `SEED_DEMO=true`, the demo home is created on the first start.

If you'd rather create the service by hand (**New → Web Service**), use:
* Build command: `npm ci --prefix server --omit=dev && npm ci --prefix client --include=dev && npm --prefix client run build`
* Start command: `npm --prefix server start`
* Health check path: `/health`
* Environment: everything listed in `render.yaml`

## Step 4: Try the demo accounts

All demo accounts share the password **`Demo@1234`** (set `DEMO_PASSWORD` to change it).

| Role | Email | What to try |
| --- | --- | --- |
| Admin (owner) | `admin@demo.bachelormate.app` | Settings, permissions, roles, everything |
| Manager | `manager@demo.bachelormate.app` | Confirm the pending payment, record expenses, members |
| Meal manager | `meal@demo.bachelormate.app` | Daily meal list, review meal-off/guest requests, close the meal period |
| Member | `member@demo.bachelormate.app` | My account, request meal off, chat |
| Member | `member2@demo.bachelormate.app` | Guest meal request, pending payment |

The demo home includes two weeks of meals, bazar and bills, payments (one pending), pending requests, announcements, a grocery list, calendar events, home chat, a friend DM and a pending friend request.

* **Reset the demo** (wipes and recreates only the `@demo.bachelormate.app` accounts and their home):
  ```bash
  npm --prefix server run seed:demo
  ```
  Run it locally with `MONGO_URI` pointing at Atlas, or from Render's *Shell* tab (paid plans).
* **Turn the demo off** for a real launch: set `SEED_DEMO=false`. The demo users can stay or be removed by an Admin; they never touch other homes.

## Step 5: Recommended production settings

| Setting | Why |
| --- | --- |
| **Email:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Verification, password reset and invitation emails. Without it, emails are only written to the Render logs. Any SMTP works: Resend (`smtp.resend.com`, port 465, `SMTP_SECURE=true`, user `resend`, password = API key), Brevo, Mailgun, SendGrid, or a Gmail app password |
| **Google sign-in:** `FIREBASE_PROJECT_ID` on Render, plus the `VITE_FIREBASE_*` vars at build time | Create a Firebase project → Authentication → enable Google → add your Render domain under *Authorized domains*. Put the web config values as `VITE_FIREBASE_*` env vars on Render (Vite reads them during the build) |
| **Persistent uploads:** add a Render *Disk* (paid) mounted at e.g. `/var/data` and set `UPLOAD_DIR=/var/data/uploads` | On the free plan, avatars and receipts are lost on each redeploy |
| **Always on:** Starter plan | Free instances sleep after 15 minutes; the first request then takes ~30 s and chat reconnects automatically |
| **Custom domain:** Render → Settings → Custom Domains | Then update `CLIENT_URL` and `CORS_ORIGINS` |

## Step 6: Moving existing data (optional)

If your old Vercel deployment's MongoDB has real data from the original *family* version, preview the migration first (a dry run that writes nothing):
```bash
MONGO_URI="your-atlas-uri" npm --prefix server run migrate
```
Then apply it:
```bash
MONGO_URI="your-atlas-uri" npm --prefix server run migrate -- --apply
```
Old collections are only read, never changed.

## Checking it works

* `https://YOUR-APP/health` → `{"status":"ok"}`
* Sign in as `admin@demo…` → the dashboard shows numbers
* Open **Home chat** in two browsers (admin and manager) → messages appear instantly and the other user shows "Online"
* Render → *Logs* should show `MongoDB connected … transactions enabled`

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails with `vite: not found` | The build command must include `--include=dev` for the client install |
| `JWT_ACCESS_SECRET must be at least 32 characters` | Use the generated value or a longer secret |
| `MongoServerSelectionError` | Atlas Network Access must allow `0.0.0.0/0`; check the user and password in `MONGO_URI` (URL-encode special characters) |
| Logged out on every refresh | `CLIENT_URL`/`CORS_ORIGINS` don't match the URL you're using, or `COOKIE_SECURE=true` on plain http |
| Email links point to localhost | Set `CLIENT_URL` to the public URL |

---

## Option B: frontend on Vercel, API on Render

Use this if you want to keep the frontend on Vercel.

1. Deploy the API on Render as above, but set `SERVE_CLIENT=false`. Its URL is, for example, `https://bachelormate-api.onrender.com`.
2. In [`client/vercel.json`](../client/vercel.json), replace `YOUR-API-HOST` with that host (no `https://` repeated). Vercel then proxies `/api` and `/uploads`, so cookies stay first-party.
3. Vercel → New Project → import the repo → **Root Directory: `client`**, framework *Vite*. Environment variables:
   * `VITE_SOCKET_URL=https://bachelormate-api.onrender.com` (WebSockets can't go through Vercel rewrites, so they connect to Render directly with the access token)
   * `VITE_API_URL` stays **empty**
   * `VITE_FIREBASE_*` if you use Google sign-in
4. On Render set `CLIENT_URL` and `CORS_ORIGINS` to your Vercel URL (e.g. `https://bachelormate.vercel.app`), and `COOKIE_SAMESITE=lax`.
5. Disable or delete the old Vercel project that deployed the `server/` folder; it can't run the real-time features.
