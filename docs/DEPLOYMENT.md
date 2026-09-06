# Deployment

The site is a single static file (`dist/index.html`) served by **Cloudflare
Pages**. There is no server, no build step on Cloudflare's side, and no runtime
configuration: CI builds the file and uploads it.

- Cloudflare Pages project: **`omarchy-website`**
- Production domain: **https://omarchy.thehuman.sh**
- Cloudflare-owned alias: `https://omarchy-website.pages.dev`
- Project settings live in [`wrangler.toml`](../wrangler.toml)

## How a deploy happens

```
merge to main
   └─ .github/workflows/deploy.yml
        ├─ lint, format:check, test, build, test:e2e   (must all pass)
        └─ npx wrangler pages deploy dist --project-name omarchy-website --branch main
             └─ Cloudflare Pages  →  omarchy.thehuman.sh
```

Nothing ships that has not passed the full suite against the merge commit. The
workflow uses `concurrency: production` with `cancel-in-progress: false`, so
deploys queue rather than race, and the deployment URL is printed into the job
summary.

**`--branch main` is what makes a deployment production.** Any other branch
name produces a preview deployment on a `*.omarchy-website.pages.dev`
subdomain and never touches the live site.

## Pull-request previews

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the same verify
steps on every pull request and on every push to a non-`main` branch. On pull
requests it then deploys with `--branch <head branch>` and posts (or updates) a
single PR comment with the preview URL. Superseded runs are cancelled.

## Secrets

Two values are needed to deploy, always under these exact names:

| Name                    | What it is                                                        |
| ----------------------- | ----------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with the _Cloudflare Pages: Edit_ permission |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account that owns the Pages project                |

They live in two places:

- **Locally**: in 1Password, mapped by [`fnox.toml`](../fnox.toml) to
  `op://vault/cloudflare/token` and `op://vault/cloudflare/account_id`. Any
  command that needs them must be wrapped: `fnox run -- <command>`. Never
  export them into a shell profile or a `.env` file.
- **In CI**: as GitHub Actions _repository secrets_ with the same two names.
  The workflows read them via `secrets.*` and pass them as environment
  variables to `wrangler`; CI does not use `fnox` or 1Password.

### Rotating a secret

Rotate in Cloudflare first, update 1Password, then push the new value to GitHub
(the `gh` call needs a GitHub token, so it is wrapped too):

```sh
# 1. Create a new token in the Cloudflare dashboard (Pages: Edit), and update
#    the 1Password item that fnox.toml points at.
# 2. Confirm the local path works:
fnox run -- npx wrangler pages project list

# 3. Push the new values to the GitHub repository secrets:
fnox run -- sh -c 'gh secret set CLOUDFLARE_API_TOKEN --body "$CLOUDFLARE_API_TOKEN"'
fnox run -- sh -c 'gh secret set CLOUDFLARE_ACCOUNT_ID --body "$CLOUDFLARE_ACCOUNT_ID"'

# 4. Revoke the old Cloudflare token.
```

Verify by re-running the latest CI job, not by deploying to production.

## Manual deploy

Only for emergencies, or when CI itself is broken. It publishes whatever is in
your local `dist/`, so build first:

```sh
npm run build
mise run deploy      # fnox run -- npx wrangler pages deploy dist --project-name omarchy-website
```

`mise run deploy` deploys to **production** (no `--branch` flag means the
project's production branch). To publish a throwaway preview instead:

```sh
fnox run -- npx wrangler pages deploy dist \
  --project-name omarchy-website --branch scratch
```

## Rollback

Cloudflare Pages keeps every deployment, so a rollback is instant and does not
need a build:

1. Cloudflare dashboard → **Workers & Pages** → `omarchy-website` →
   **Deployments**.
2. Find the last known-good production deployment and use its
   **Rollback** action. The custom domain switches over immediately.
3. Fix the problem in git and merge to `main`; the next `deploy.yml` run
   supersedes the rollback.

If the dashboard is not an option, redeploy an older commit: check it out,
`npm run build`, then `mise run deploy`. Prefer the dashboard — it deploys the
exact artefact that was live, with no chance of a different build result.

## Adding the custom domain `c63.omarchy.org`

`omarchy.org` is not ours; DHH controls its DNS. The Pages side can be prepared
first, and the domain starts serving as soon as the CNAME appears.

1. **Cloudflare (us):** dashboard → **Workers & Pages** → `omarchy-website` →
   **Custom domains** → **Set up a domain** → enter `c63.omarchy.org`.
   Cloudflare will report the domain as _pending_ and show the CNAME target,
   which is `omarchy-website.pages.dev`.
2. **DNS (DHH's side):** ask for a DNS record on `omarchy.org`:

   ```
   c63    CNAME    omarchy-website.pages.dev.
   ```

   Proxying is irrelevant here — the zone is not in our account.

3. **Cloudflare (us):** once the record resolves, the custom domain flips to
   _active_ and Cloudflare issues the TLS certificate automatically (a few
   minutes).
4. Verify: `curl -sI https://c63.omarchy.org | head -1` should return
   `HTTP/2 200`.

Nothing in this repository changes: the Pages project already builds and hosts
the content, and a custom domain is purely a Cloudflare + DNS setting. Adding
it does not remove `omarchy.thehuman.sh`; a Pages project can serve several
custom domains at once.
