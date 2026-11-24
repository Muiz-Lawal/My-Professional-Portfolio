# Muiz Lawal Portfolio

A responsive personal engineering portfolio built with React and Vite.

## Development

```powershell
npm install
npm run dev
npm run server:start
```

## Quality checks

```powershell
npm run lint
npm run build
npm run typecheck
npm run preview
```

The development site runs on `http://127.0.0.1:4317`. The reserved API port is `5057`.

The portfolio uses the standard Vite React plugin.

## Routes and content

The homepage keeps Home, About, Expertise, Projects, Experience, Education and Contact as section anchors. `/about`, `/projects`, `/projects/:slug`, `/writing`, `/writing/:slug` and `/certifications` provide the longer-form views. The build pre-renders the known public routes and published content records to `dist/`; the SPA still handles client navigation and unknown routes.

To use the content dashboard:

1. Copy `.env.example` to `.env`.
2. Set `ADMIN_TOKEN` to a strong random server-only value. For example, generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never use a `VITE_` variable for this token.
   For cookie-based login instead of the legacy token, set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`. Generate the hash locally:
   ```powershell
   node -e "const c=require('node:crypto');const p='Choose-A-Strong-Password';const s=c.randomBytes(16).toString('hex');console.log('scrypt$'+s+'$'+c.scryptSync(p,Buffer.from(s,'hex'),64).toString('hex'))"
   ```
   Store the complete `scrypt$...` result in `ADMIN_PASSWORD_HASH`. The owner password must not be committed to Git.
3. Keep `DATA_DIR` on a persistent, private filesystem. The default local `data/` directory is ignored by Git.
4. Run `npm run server:start`, open `/admin`, and sign in with the token.

The dashboard edits homepage section visibility, order, navigation, text, image and calls to action; it also manages pages, projects and articles, including drafts, publication state, SEO, templates and project case-study details. New pages are excluded from navigation unless explicitly selected. Only published, public content is exposed by the public API. Publishing or editing content updates the API immediately; run `npm run build` and redeploy to refresh pre-rendered HTML and the sitemap for search engines.

The Security panel supports authenticator-app MFA setup and verification. The Backup panel creates a local full snapshot of the SQLite database, published/draft content, and uploaded media; restore first creates a safety backup and preserves the current administrator accounts, sessions, and MFA configuration. Download the complete snapshot as a portable `.tar.gz` archive, or download its database and content files separately. Run `npm run test:admin` to exercise MFA, media privacy/replacement/deletion, all page block types, and backup/restore workflows.

Set `SITE_URL` and `VITE_SITE_URL` to the real HTTPS site origin before a production build. The build then writes canonical metadata and a sitemap containing eligible public pages. `/admin` is excluded from indexing. Configure the web host to serve `dist/` and use an SPA fallback for routes that are not pre-rendered. The API should be deployed separately with `HOST=0.0.0.0`, HTTPS termination, a persistent `DATA_DIR`, a restrictive `CORS_ORIGINS` list and server-side secrets.

The generated site uses static HTML for public route discovery and client-side React Router navigation. Newly created routes are included in static HTML after the next build; dynamic runtime publishing does not trigger a build automatically.

## Docker deployment

```powershell
docker compose up --build
```

The container listens on port `5057`, stores SQLite state in `/app/data`, and exposes `/api/health` for health checks. Mount or back up the `/app/data` volume. Set `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `CORS_ORIGINS`, `SITE_URL`, and email/integration secrets.

## PostgreSQL migration

SQLite remains the supported local foundation. PostgreSQL migration SQL is in `migrations/001_initial.sql`. Set `POSTGRES_URL` and run `npm run migrate`. The migration runner tracks applied files and is safe to rerun.

## S3-compatible media

Set `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, and `S3_PUBLIC_BASE_URL`. The adapter in `scripts/s3-media-adapter.js` performs server-side uploads and deletions only.

## Project documentation

- `src/App.tsx` contains the typed page structure and content model.
- `src/App.css` and Tailwind CSS provide the design system and responsive layout.
- `src/main.tsx` is the strict-TypeScript React entry point.
- `server/contact-server.js` provides validation, rate limiting and Resend delivery.
- `src/index.css` contains global defaults and theme variables.
- `public/` contains static branding and metadata assets.

Project concept entries are distinguished from verified implementations. Contact delivery uses the API server and requires a server-side Resend key; delivery is not reported as successful when the service is unconfigured or unavailable.

## Optional privacy-focused analytics

Analytics are disabled by default. To enable Plausible, copy `.env.example` to `.env.local`, set `VITE_ANALYTICS_ENABLED=true`, and set `VITE_ANALYTICS_DOMAIN` to the exact public hostname configured in your Plausible account. Restart Vite after changing environment values.

By default, the app loads Plausible's hosted script only when enabled and a valid hostname is configured. `VITE_ANALYTICS_SCRIPT_URL` and `VITE_ANALYTICS_API_URL` may point to your own HTTPS-hosted or proxied Plausible endpoints. Client-side analytics variables are public configuration, not secrets.

The app records page views through Plausible and the following custom events: navigation section clicks, project outbound clicks (using a fixed project ID), CV downloads, and successful contact submissions. It does not send names, email addresses, message contents, terminal commands, or free-form values to analytics. Plausible is configured as a cookie-free analytics service; review the provider's current privacy and retention documentation and your local disclosure requirements before enabling it.
