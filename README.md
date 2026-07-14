<h1 align="center">ctct</h1>

<p align="center">
  <strong>The Constant Contact v3 API on your command line — built for humans and AI agents.</strong>
</p>

<p align="center">
  <a href="https://github.com/mattmaynes/ctct-cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/mattmaynes/ctct-cli/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/mattmaynes/ctct-cli/releases/latest"><img alt="Latest release" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmattmaynes%2Fctct-cli%2Fmain%2Fpackage.json&query=%24.version&label=release&color=blue"></a>
  <a href="https://developer.constantcontact.com/api_reference/index.html"><img alt="Constant Contact v3 API" src="https://img.shields.io/badge/Constant%20Contact-v3%20API-1852cc?logo=constantcontact&logoColor=white"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Node 18+" src="https://img.shields.io/badge/node-18%2B-339933?logo=nodedotjs&logoColor=white">
</p>

---

> [!IMPORTANT]
> **Unofficial project.** `ctct` is a community-built, third-party CLI. It is **not affiliated with, endorsed by, or supported by Constant Contact**. "Constant Contact" and related names are trademarks of their respective owner. Use at your own risk.

`ctct` wraps the [Constant Contact v3 API](https://developer.constantcontact.com/api_reference/index.html) —
contacts, lists, tags, segments, custom fields, email campaigns, scheduling, reporting, and bulk
activities. It handles its own OAuth (device flow), stores a long-lived token in your OS keychain, refreshes
it automatically, and speaks JSON so scripts and AI agents can drive it. Human-friendly tables when you're at
a terminal; structured JSON the moment output is piped.

Built on the official [`ctct-api-client`](https://www.npmjs.com/package/ctct-api-client) SDK.

## Quick Start

### Install

**From npm** (recommended):

```bash
npm install -g @mattmaynes/ctct-cli
```

**From GitHub** (latest `main`):

```bash
npm install -g mattmaynes/ctct-cli
```

**From source:**

```bash
git clone https://github.com/mattmaynes/ctct-cli.git
cd ctct-cli
npm install
npm run build
npm link          # puts `ctct` on your PATH
```

Requires Node.js ≥ 18. Verify with `ctct --version`.

### Authenticate & go

```bash
ctct init --client-id <your-client-id>   # see "Constant Contact developer setup" below
ctct login                                # approve in your browser (device flow)
ctct status                               # confirm you're authenticated

ctct account show
ctct contact add --email ada@example.com --first-name Ada --list <listId>
ctct email create --data @campaign.json
```

## Constant Contact developer setup

To use `ctct` you need an **API key (client_id)** from a Constant Contact app that you register. It's a public
identifier — the device flow uses no client secret.

- 📚 Developer portal: <https://developer.constantcontact.com>
- 📖 API reference: <https://developer.constantcontact.com/api_reference/index.html>
- 🔑 Authentication guide (Device Flow): <https://developer.constantcontact.com/api_guide/device_flow.html>

**Get an API token:**

1. Sign in to the [Constant Contact developer portal](https://app.constantcontact.com/pages/dma/portal/)
   with your Constant Contact account (create one if needed).
2. Go to **My Applications → New Application**. Give it a name.
3. Under the app's **OAuth2** settings, enable the **Device Flow** grant type, then **Save**.
4. Copy the app's **API Key** — this is your `client_id`.
5. Register it and log in:
   ```bash
   ctct init --client-id <API-Key>     # or set CTCT_CLIENT_ID
   ctct login                          # optionally: --scopes contact_data,campaign_data
   ```
   `ctct login` prints a short code and a URL. Open the URL, enter the code, approve, and you're done —
   `ctct` stores an access token plus a **rotating refresh token** (good for 180 days of use) and refreshes
   automatically before every call.

See available scopes any time with `ctct scopes` (default requests all of them).

## Usage

### Command groups

| Group | What it does |
| --- | --- |
| `init` / `login` / `logout` / `status` / `scopes` / `refresh-token` | Auth & configuration |
| `account` | Account details, sender emails, privileges |
| `contact` | Add / list / get / update / delete / upsert contacts |
| `list` | Manage contact lists |
| `tag` · `custom-field` · `segment` | Contact organization |
| `email` | Create, schedule, send, test-send, preview campaigns |
| `abtest` | Email A/B tests |
| `report` | Email & contact reporting |
| `bulk` | Bulk import / export / update activities |

Run `ctct <group> --help` for subcommands and flags.

### Email: create → test → send

Create a campaign straight from an HTML file. Save your sender once with `ctct init` and a single
`--subject` covers both the subject line and the (unique) campaign name:

```bash
ctct init --from-name "Your Name" --from-email you@example.com   # one time; must be a verified sender
ctct email create --subject "New post: My Title" --html-file email.html   # returns campaign_id
```

`--from-email`/`--from-name`/`--reply-to` fall back to the configured defaults, `--name` falls back to
`--subject`, and `--reply-to` falls back to `--from-email` — so the common case needs only a subject and a
file. Use `--data @campaign.json` for full control over the request body.

Email campaigns contain *activities*; `schedule`, `send`, `test-send`, `preview`, and `unschedule` take a
**campaign id** and resolve the `primary_email` activity for you:

```bash
ctct email test-send <campaignId> --to you@example.com  # goes only to that address
ctct email schedule <campaignId> --at 2026-08-01T15:00:00Z
ctct email send <campaignId>                            # send immediately
```

### The `--data` escape hatch

Every create/update command accepts convenience flags **and** a `--data` option that maps straight onto the
SDK request body, so you can use the full API without per-field flags:

```bash
ctct contact add --data '{"email_address":{"address":"a@x.com","permission_to_send":"implicit"},"create_source":"Account"}'
ctct email create --data @campaign.json      # from a file
cat campaign.json | ctct email create --data @-   # from stdin
```

Convenience flags are merged **under** `--data` (explicit `--data` fields win).

## Scripting & AI agents

- **JSON automatically when piped** (non-TTY), or force it anywhere with `--json`.
- Stable **exit codes**: `0` ok · `1` generic · `2` usage · `3` not authenticated / refresh failed · `4` API error.
  In JSON mode errors print as `{ "error": ..., "exit_code": N }`.
- Set `CTCT_DEBUG=1` to include raw API error bodies on failures.

### Keeping a refresh token alive (`refresh-token`)

`ctct refresh-token` exchanges a refresh token for a fresh 24h access token and prints the result as
JSON. It reads the token from `--refresh-token`, else `CTCT_REFRESH_TOKEN`, else the stored login
session (and `--client-id`, else `CTCT_CLIENT_ID`, else config). When the token comes from a flag or
env var it is treated as **stateless** and never written to the session store - so it is safe to run
against an app's own `.env` credentials.

This exists because a Constant Contact **long-lived refresh token still expires after ~180 days of
inactivity**, and the clock resets only when the token is used. A scheduled `refresh-token` keeps it
warm and exits non-zero (code `3`) the moment it breaks, so a cron can alert well before a real
request fails:

```bash
# cron: exercise the token daily; alert on failure via your own channel
set -a; . /path/to/.env.site; set +a          # CTCT_CLIENT_ID, CTCT_REFRESH_TOKEN
ctct refresh-token >/dev/null || notify "CTCT token refresh failed"
```

On a host without Node, run it from the container image (no install, pinned):

```bash
docker run --rm --env-file /path/to/.env.site ghcr.io/mattmaynes/ctct-cli refresh-token >/dev/null
```

## Configuration & token storage

The config directory is resolved in order: `--config <dir>` → `CTCT_CONFIG_DIR` → nearest `.ctct/` walking up
from the current directory → `~/.ctct/` (global default). `ctct init --local` writes to `./.ctct` for
per-project credentials.

Tokens are stored in the **OS keychain** (macOS Keychain, Windows Credential Manager, Linux Secret Service)
when available, and fall back to a `0600` `token.json` otherwise. Force a backend with
`ctct init --storage keychain|file`. For headless agents where no keychain is unlocked, `file` is the
predictable choice.

## Development

```bash
npm install
npm run build     # compile TypeScript -> dist/
npm test          # compile + run the node:test suite
```

## License

[MIT](LICENSE) © Matthew Maynes
