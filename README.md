# Read Leva Alalloş — Portfolio

Animated portfolio site with a **real SQLite database** and a **hidden admin panel**.
Every word, number, link and image on the site is stored in the database and edited
from the admin panel — nothing is hard-coded in the HTML.

**Zero npm packages.** It runs on Node.js and nothing else.

---

## 1. Başlangıç / Quick start

You need **Node.js 22.5 or newer** — <https://nodejs.org> (download the LTS version).

```bash
cd portfolio
cp .env.example .env        # open .env and set your own ADMIN_PASSWORD
node server.js
```

Then open **http://localhost:3000**

The first time it starts, the terminal prints your admin username and password.
**Copy them.** They are shown only once.

```
────────────────────────────────────────────────
  ADMIN ACCOUNT CREATED (shown only once)
  username : read
  password : ····················
────────────────────────────────────────────────
```

Windows note: if `node` is not recognised, restart the terminal after installing Node.

---

## 2. Opening the hidden admin panel

Three ways, all equivalent:

| Method | How |
|---|---|
| **Secret** | Click your **profile photo 5 times** on the homepage |
| Keyboard | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> |
| Direct | Go to `http://localhost:3000/admin` |

### Why your password is safe

- The password is **never** written into any HTML, CSS or JavaScript file.
- Only a **scrypt hash** is stored, inside `data/portfolio.db`.
- The browser never receives the hash — the check happens on the server.
- The session is an **HttpOnly cookie**, so page scripts cannot read it.
- After **8 wrong attempts** from the same IP, logins lock for 15 minutes.
- `npm test` verifies all of the above automatically.

Forgot the password?

```bash
node scripts/reset-password.js
```

---

## 3. What you can change from the panel

| Tab | What it controls |
|---|---|
| **Profile** | Name, title, summary, photo, phone, email, CV link, **Google Schedule link** |
| **Stats** | The four animated counters under the hero |
| **Social links** | GitHub, LinkedIn, Instagram, Facebook, TikTok, X, YouTube, email — add or remove any |
| **Skills** | Skill groups and the 0–100 level of each animated bar |
| **Languages** | Arabic / Turkish / English … |
| **Experience** | Every job in the animated timeline |
| **Projects** | Title, period, **photo**, tags, bullets, link |
| **Education** | Degrees |
| **Section titles** | Rename any heading on the site |
| **Theme & SEO** | The two accent colours, page title, meta description |
| **Media library** | Everything you have uploaded |
| **Security** | Change your username and password |

Press **Save changes** (or <kbd>Ctrl</kbd>+<kbd>S</kbd>) to write to the database.
The previous 30 versions are kept automatically, so nothing is ever lost.

### Uploading photos

In **Projects** and **Profile**, click **Upload file…** and pick an image.
It is stored in `public/assets/uploads/` and linked automatically.
Allowed: PNG, JPG, WEBP, GIF, SVG, PDF — up to 12 MB.

### Linking your Google appointment schedule

There is no contact form, as you asked. Instead:

1. Open **Google Calendar** → **Create** → **Appointment schedule**
2. Set your available hours and save
3. Open the schedule → **Share** → **Copy link**
4. Paste it into **Admin → Profile → Google Schedule URL** → Save

The booking calendar then appears embedded in the Contact section.

### Replacing the CV

Drop your PDF over `public/assets/files/cv.pdf`, or upload a new one from the
admin panel and paste its URL into **Profile → CV link**. The CV button opens it
in a new tab.

---

## 4. The animations

| Where | What happens |
|---|---|
| **Loading screen** | Your signature draws itself with a glowing pen tip, a counter, a shine sweep, then fades away |
| **Logo** | The same signature, redrawing itself forever in the navbar |
| **Under your photo** | The signature again, always moving, glowing in the accent colour |
| **Footer** | A third, slower copy of the signature |
| **Background** | A neural network of nodes and links; the mouse pushes them away, draws lines to nearby nodes, and a click sends a shockwave |
| **Cursor** | A custom dot + trailing ring that grows and shows a label over anything clickable |
| **Projects & Experience** | 3D tilt following the mouse, with a light glare that tracks the pointer |
| **Hero** | Name scrambles into place, job titles type themselves, everything drifts with the mouse (parallax) |
| **Counters** | Numbers count up when scrolled into view |
| **Skill bars** | Fill up on scroll |
| **Timeline** | A glowing line that fills as you scroll through your jobs |
| **Social icons** | Lift, rotate, fill with gradient and show a label on hover |
| **Theme switch** | A wall light switch that sparks. Flip it too many times and it starts complaining — at 20 flips the lights go out |

Everything respects `prefers-reduced-motion` for visitors who need it off.

---

## 5. Project structure

```
portfolio/
├── server.js               HTTP server + API (no dependencies)
├── src/
│   ├── db.js               database access
│   ├── sqlite.js           SQLite driver (built-in, or better-sqlite3 if installed)
│   ├── crypto.js           scrypt password hashing + signed session tokens
│   ├── http.js             tiny router / static file server
│   └── defaultContent.js   your CV, used to seed the database once
├── scripts/
│   ├── reset-password.js   change the admin login from the terminal
│   └── test.js             end-to-end test suite
├── data/portfolio.db       ← the database (created on first run)
└── public/
    ├── index.html          the portfolio
    ├── admin.html          the hidden panel
    └── assets/
        ├── css/            style.css, admin.css
        ├── js/             signature.js, loader.js, app.js, admin.js
        ├── img/            placeholder images
        ├── files/cv.pdf    your CV
        └── uploads/        files you upload from the panel
```

### Database tables

| Table | Purpose |
|---|---|
| `users` | admin username + scrypt password hash |
| `content` | the whole site content as JSON |
| `revisions` | the last 30 saved versions |
| `media` | every uploaded file |
| `login_attempts` | brute-force protection |
| `settings` | the session signing secret |

---

## 6. Testing

```bash
node scripts/test.js
```

Runs 17 checks: content loading, every page and asset, authentication,
editing every section, uploads, file-type filtering, path traversal,
credential changes, rate limiting, and a scan proving no password or hash
appears in any client-side file.

---

## 7. Putting it online

The site needs a Node.js host (not plain static hosting, because of the database).
Free options that work as-is: **Render**, **Railway**, **Fly.io**, **Koyeb**.

1. Push this folder to GitHub (`.gitignore` already excludes `.env` and `data/`)
2. Create a new **Web Service**, build command: *(none)*, start command: `node server.js`
3. Set environment variables: `NODE_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
4. Make sure `data/` is on a persistent disk, otherwise your edits reset on redeploy

`NODE_ENV=production` turns on Secure cookies, so use HTTPS.

---

## 8. Optional speed-up

The built-in SQLite driver is fine for a portfolio. If you want the faster
native one:

```bash
npm install better-sqlite3
```

It is picked up automatically. Everything works without it.
