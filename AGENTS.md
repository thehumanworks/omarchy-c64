# AGENTS.md

## Deployment

- use Cloudflare Pages
- deploy the page to a custom domain under the host I own "thehuman.sh". Custom domain name: 'omarchy.thehuman.sh'

## Secret Management

- wrap all calls that rely on secrets (e.g. 'github' interactions, 'wrangler' commands) with `fnox run --`.
