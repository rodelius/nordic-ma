# Open Nordic FICC in your browser with GitHub Codespaces

No Node.js, Docker, Xcode or VS Code installation is needed on your Mac. Use a browser supported by GitHub Codespaces. Very old browser versions may need updating, or another device with a supported browser.

## What is prepared

- `.devcontainer/devcontainer.json` configures a Node 24 workspace.
- `.devcontainer/Dockerfile` installs Chromium for the existing browser tests.
- First creation runs `npm ci --no-audit --no-fund` automatically.
- Every workspace start runs `node .devcontainer/start.mjs`: it starts the existing development server, checks the transaction API, and avoids starting another instance when one is already healthy.
- Port **3000** is forwarded automatically and requests a browser preview. Codespaces ports are private by default; keep this one private.
- `next.config.ts` allows the GitHub Codespaces preview hostname for development assets and hot reload.
- The five application views, application logic, test assertions and dependency lockfile are preserved. The browser test screenshot destination now uses a portable relative path instead of `/workspace/nordic-ficc`.

## Open this repository in Codespaces

1. Open <https://github.com/rodelius/nordic-ma> and sign in to GitHub.
2. Choose **Code → Codespaces → Create codespace on main**. You can also use <https://codespaces.new/rodelius/nordic-ma?quickstart=1> to open the creation page. Choose the root **Nordic FICC — browser workspace** configuration if prompted.
3. Wait for container creation and dependency installation. The app starts automatically.
4. If a preview does not open, open the **Ports** tab in browser VS Code and choose **Open in Browser** for port **3000**. Keep port visibility **Private**.
5. Explore the five application views. To enter a source, choose **Alerts & catalysts → Analyze source**.

No ZIP download or manual file upload is needed. The preview URL is issued by GitHub after the Codespace exists; this repository does not contain a pre-created preview URL. GitHub Codespaces availability and usage limits depend on your account.

Use a full browser tab rather than an embedded preview for notification permission or PWA experiments. Source analysis is optional and needs server credentials as described below; browsing the synthetic dashboard needs no key.

## Start, stop and resume

After an idle Codespace resumes, the app is started automatically. You can also run the idempotent startup command in its terminal:

```sh
node .devcontainer/start.mjs
```

For a foreground development session, stop the existing server first (see below), then:

```sh
npm run dev
```

The start command prints the actual log path, usually `/tmp/nordic-ficc-dev-1000/server.log`. Its adjacent `server.pid` records the npm process group it created. To stop that background server from the workspace terminal:

```sh
node --input-type=module -e 'import {readFileSync} from "node:fs"; import {tmpdir} from "node:os"; import {join} from "node:path"; const p=join(tmpdir(),`nordic-ficc-dev-${process.getuid()}`,"server.pid"); process.kill(-Number(readFileSync(p,"utf8")),"SIGTERM")'
```

Use this only for a server started by `.devcontainer/start.mjs` in the current workspace. Deleting and recreating a Codespace is different from stopping it: back up any local SQLite data first. Uncommitted source and `data/` are not restored from Git alone.

## Interact with the app

The synthetic dashboard needs no API key. Explore all five views from the sidebar. For **Analyze source**, choose **Alerts & catalysts → Analyze source**. AI extraction needs `INGEST_TOKEN` and `AI_API_KEY` in the Codespace's secure environment; manual structured intake needs `INGEST_TOKEN`. Do not put secret values in source control. Restart the server after environment changes. The app remains a synthetic demo until you add analyst records; live news feeds and a scheduler are not connected.

Private Codespaces previews require GitHub authentication. They are suitable for browser development, but are not a stable public PWA deployment or a verified iPhone background push service.

## Verify in the Codespace

```sh
npm test
npm run test:e2e
```

The app must be running for browser tests. Chromium is included by the container configuration, retaining the existing test executable path. A production build remains available with `npm run build`; it does not replace the running development workflow.

## What was verified here

The development server, transaction API, fresh and repeated startup commands, unit tests and desktop/mobile browser tests were exercised in the Codex machine. The JSON configuration and Next.js forwarded-origin setting were checked. This session exposes no Sites or user-facing forwarded-browser-preview capability, so the Codex server cannot be linked as an interactive preview here.

A fresh Codespace has not been provisioned. An attempt to inspect/download the Microsoft base image was blocked at its registry's artifact host in this environment, so a complete devcontainer image build was not verified here. GitHub must provision that image when you rebuild the Codespace.
