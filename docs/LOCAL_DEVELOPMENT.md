# Run Cozy Digital locally on Windows with WSL and SSH

Repository: [ElvinLearning/cozy_hub2.0](https://github.com/ElvinLearning/cozy_hub2.0)

Finished landing-page branch: **`codex/cozy-cinematic-landing-20261009`**

The branch includes the site, Node server, admin panel, local fonts, existing
reel, and finished Higgsfield media. Viewing these committed assets does not
request new generations or spend Higgsfield credits.

## Quick start

If Ubuntu / WSL, nvm, and GitHub SSH access already work, run this in your
**Ubuntu terminal**:

```bash
mkdir -p ~/projects
cd ~/projects
git clone --depth 1 --single-branch \
  --branch codex/cozy-cinematic-landing-20261009 \
  git@github.com:ElvinLearning/cozy_hub2.0.git cozy-digital
cd cozy-digital
nvm install
nvm use
npm test
npm start
```

Open **http://localhost:8080** in your Windows browser. The admin panel is at
**http://localhost:8080/admin/**. Unless you supplied `ADMIN_PASSWORD`, use the
one-time admin password printed by the server at startup. Leave the terminal
running while you use the site; press **Ctrl+C** to stop it.

`nvm install` installs the Node version selected by `.nvmrc` (Node 24). It does
not install this project's development packages. The landing page, server,
and tests require **no `npm install`, no build command, and no API keys**.

The shallow, single-branch clone limits downloaded history. It still contains
all files needed to run and edit the finished site. If you later need the full
history of this branch, run `git fetch --unshallow`.

## First-time setup

### 1. Install Ubuntu in WSL, if needed

Run this once in **PowerShell as Administrator**:

```powershell
wsl --install -d Ubuntu
```

Restart Windows if prompted, open **Ubuntu** from the Start menu, and create
your Linux username and password. If Ubuntu is already installed, open it and
continue. These steps follow Microsoft's [WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install).

Run all remaining shell commands in **Ubuntu**, not PowerShell. Keep the project
in `~/projects` inside WSL's Linux filesystem, as recommended by Microsoft's
[Node on WSL guide](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl).

```bash
sudo apt update
sudo apt install -y git curl ca-certificates openssh-client
```

### 2. Set up GitHub SSH access in WSL

Connecting GitHub to ChatGPT does not install an SSH key in your WSL instance.
Check whether your WSL SSH access already works:

```bash
ssh -T git@github.com
```

On a first connection, verify the host fingerprint against
[GitHub's published fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
before accepting it. Successful authentication names your GitHub account and
says GitHub does not provide shell access. That successful test returns exit
code 1; this is expected. The account must have access to this repository.

If authentication works, skip to step 3. If you already have a WSL SSH key,
reuse it and add its public key to the appropriate GitHub account if necessary.
If you need a new key, run:

```bash
ssh-keygen -t ed25519 -C "cozy-digital-wsl"
```

The comment is just a label. Choose a passphrase. Accept the default filename
only if it will not overwrite an existing key; if asked to overwrite, answer
**no** and reuse the existing key or choose a new filename. The next commands
assume the default filename; substitute your filename if you chose another:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copy the **public key** printed by the last command into
[GitHub → Settings → SSH and GPG keys → New SSH key](https://github.com/settings/keys).
Select an authentication key and use a title such as `Cozy Digital WSL`.
Keep the private key (the file without `.pub`) private. Then run
`ssh -T git@github.com` again.

GitHub's official guides cover [creating and loading a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=linux),
[adding the public key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account),
and [testing the connection](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection?platform=linux).

### 3. Install nvm

If `command -v nvm` already prints `nvm`, skip the installer. Otherwise use the
installer from the [official nvm README](https://github.com/nvm-sh/nvm):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
source ~/.bashrc
command -v nvm
```

The last command should print `nvm`. This guide assumes Ubuntu's default Bash
shell. If you use another shell, follow nvm's shell setup instructions.

Continue with the [quick-start commands](#quick-start) to clone and run the app.

## Starting again later

Open Ubuntu and run:

```bash
cd ~/projects/cozy-digital
nvm use
npm start
```

For development, use `npm run dev` instead of `npm start`. Node restarts when
watched server modules change. Refresh the browser after editing HTML, CSS,
or browser JavaScript; there is no browser hot reload or frontend build step.

If you use VS Code with its WSL extension, `code .` from the project directory
opens the checkout using WSL.

## Getting updates and saving your edits

To download later changes on this branch, first stop the server. Check your
working tree, then pull when it is clean:

```bash
git status
git pull --ff-only
nvm use
npm test
npm start
```

Commit or otherwise preserve your own edits before pulling if Git reports
changes. To work on an independent feature, create your own branch:

```bash
git switch -c my/cozy-changes
```

Use your own Git author name and email when committing. Push that branch with
`git push -u origin my/cozy-changes` when you want to share it and your account
has write access. You do not need to merge the landing-page branch into `main`
to run it locally.

## Optional API access and local data

Previewing the page and playing its existing clips need no Higgsfield account
or key. The admin's generation and Agent actions require your own authorized
Higgsfield API credentials and can spend that account's credits.

Supply credentials through the **process environment**, not a committed file
or browser code. To enter a combined `key_id:key_secret` without displaying it
or putting its value in shell history, use this optional Bash prompt before
starting the server:

```bash
read -rsp "Higgsfield key_id:key_secret: " HF_KEY
printf '\n'
export HF_KEY
npm start
```

After stopping the server, `unset HF_KEY` removes it from that shell's
environment. Your hosting provider's secret settings are appropriate for a
deployed server. `.env.example` is a variable reference, not a request to put
API keys in a file. See the [README environment table](../README.md#environment)
for other options.

Leave `PUBLIC_URL` unset for ordinary local HTTP use. It is for an actual
public HTTPS origin and Higgsfield completion webhooks.

The server stores local leads, uploads, jobs, and other runtime data under
`data/` by default. Git ignores its contents except the empty `.gitkeep` file.
The ignore rules prevent accidental commits; they do not back up your data.
If you set a different `DATA_DIR`, use an absolute path.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `Permission denied (publickey)` | Run `ssh -T git@github.com` from Ubuntu. Load your key with `ssh-add`, add its public key to GitHub, and confirm that the named account has repo access. Windows and WSL may use different SSH keys. |
| `Repository not found` | Check the exact clone URL and that the GitHub account named by the SSH test can access `ElvinLearning/cozy_hub2.0`. |
| `nvm: command not found` | Run `source ~/.bashrc` or open a new Ubuntu terminal. If it still fails, complete the nvm installer step. |
| The clone destination already exists | Use your existing checkout if it is this project, or choose a different empty destination directory. Do not delete your work to retry a clone. |
| Wrong Node version | From the repo directory, run `nvm install`, then `nvm use` and `node --version`. `.nvmrc` selects Node 24. |
| `EADDRINUSE` on port 8080 | Stop the other server or run `PORT=8081 npm start`, then open `http://localhost:8081`. |
| Changes do not appear | Refresh the browser. Restart the server for server-side changes, or use `npm run dev`. |
| A video is showing a still image | Reduced-motion preferences or the on-page motion control may have paused it. Off-screen videos also pause deliberately. |
| Admin generation fails without a key | Local preview works without API access; generation requires credentials and a valid provider model configuration. See the README's Higgsfield section. |

## Optional maintenance tools

The app and its Node tests use built-ins. `npm ci` is only needed for optional
development packages used by font, logo, and vendor maintenance tools. The
historical `tools/smoke-admin.mjs` script also imports Playwright, which is not
declared in `package.json`; it needs a separate Playwright/browser setup and
is not part of the quick start. Old workbench capture scripts may depend on
earlier page hooks; see the README before using them.
