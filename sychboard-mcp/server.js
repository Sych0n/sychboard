#!/usr/bin/env node
/**
 * sychboard-mcp — Phase 1 of turning SychBoard into a personal AI OS.
 *
 * Minimal local MCP server (stdio transport), read-only tools only.
 * Every tool is gated by permissions.json: no entry or an unrecognized
 * mode means the call is refused server-side. The "confirm" vs "auto"
 * distinction is enforced by the SERVER, not the connecting client:
 * "confirm"-tier tools try MCP elicitation first (client shows the
 * approval prompt), and if the connected client doesn't support
 * elicitation, fall back to a native OS confirm dialog spawned by this
 * process itself. Either way, the tool cannot run without a real user
 * approval — no client can silently skip the gate.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// powershell.exe is a real OS process with no knowledge of Electron's asar
// virtual filesystem — a "-File" path pointing inside app.asar fails to open.
// electron-builder's asarUnpack (see package.json) copies this script next
// to the archive at app.asar.unpacked/...; this maps __dirname onto that
// real path when running packaged, and is a no-op in dev (no "app.asar" in
// __dirname there).
const COMMIT_DIALOG_PS1 = path.join(
  __dirname.includes(`app.asar${path.sep}`) || __dirname.endsWith("app.asar")
    ? __dirname.replace("app.asar", "app.asar.unpacked")
    : __dirname,
  "commit-dialog.ps1",
);

// permissions.json is documented (README) as a file a user may hand-edit to
// change tool gating; a syntax mistake there previously crashed this whole
// process with a raw JSON.parse stack trace on stderr — indistinguishable
// from an internal bug — instead of pointing at the actual cause. The parent
// process (mcp-client.js) already handles a failed/missing server the same
// way either way (child exits, teardown() rejects pending calls), so this
// only improves the diagnosis, not the failure mode itself.
let permissions;
try {
  permissions = JSON.parse(
    fs.readFileSync(path.join(__dirname, "permissions.json"), "utf8"),
  );
} catch (err) {
  console.error(`[mcp-server] failed to load permissions.json: ${err.message}`);
  process.exit(1);
}

const CHUCKBIRD_SSH_HOST = process.env.CHUCKBIRD_SSH_HOST || "opc@152.67.159.196";
const CHUCKBIRD_SERVICE = "chuckbird.service";
// Exact, fixed restart command — no interpolation, no other commands. This
// is the ONLY write action any tool in this server can take on the prod box.
const CHUCKBIRD_RESTART_CMD = "sudo systemctl restart chuckbird";

// Directories that are never interesting as "recent project files".
const IGNORED_DIRS = new Set([
  "node_modules", ".git", "__pycache__", ".venv", "venv",
  "dist", "build", "out", "release", ".next", "coverage",
]);

// The ONLY two repos any git_* tool can touch. No free-text path is ever
// accepted for these tools — the input schema is a closed enum over these
// keys, so there is no wildcard repo discovery possible.
const GIT_REPOS = {
  sychboard: "C:\\Users\\danie\\Downloads\\sychboard-electron\\sychboard-electron",
  "chuck-bird": "C:\\Users\\danie\\Desktop\\chuck-bird-bot",
};
const PROTECTED_BRANCHES = new Set(["main", "master"]);

// Spawns a native Windows confirm dialog and blocks until the user answers.
// This is the server-owned fallback for when the connected client doesn't
// support MCP elicitation — it does not depend on the client at all.
async function serverSideApprovalDialog(toolName, detail) {
  const message = `sychboard-mcp wants to run "${toolName}".${detail ? ` ${detail}` : ""}\n\nAllow this?`;
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$msg = $env:SYCHMCP_CONFIRM_MSG",
    "$result = [System.Windows.Forms.MessageBox]::Show(" +
      "$msg, 'sychboard-mcp - confirm tool call', " +
      "[System.Windows.Forms.MessageBoxButtons]::YesNo, " +
      "[System.Windows.Forms.MessageBoxIcon]::Question, " +
      "[System.Windows.Forms.MessageBoxDefaultButton]::Button2, " +
      "[System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly)",
    "if ($result -eq [System.Windows.Forms.DialogResult]::Yes) { Write-Output 'APPROVED' } else { Write-Output 'DENIED' }",
  ].join("; ");

  const { stdout } = await execFileP(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { timeout: 120_000, env: { ...process.env, SYCHMCP_CONFIRM_MSG: message } },
  );
  return stdout.includes("APPROVED");
}

// Enforced server-side, regardless of which client connected. "auto" tools
// run immediately; "confirm" tools require a real approval before running —
// first via MCP elicitation (client-rendered), and if the client doesn't
// support that, via a native OS dialog this process spawns itself.
async function confirmPermission(toolName, detail) {
  const entry = permissions.tools?.[toolName];
  if (!entry) {
    throw new Error(
      `Tool "${toolName}" has no entry in permissions.json — refusing to run.`,
    );
  }
  if (entry.mode === "auto") return;
  if (entry.mode !== "confirm") {
    throw new Error(
      `Tool "${toolName}" is set to mode "${entry.mode}" in permissions.json — refusing to run.`,
    );
  }

  const summary = `sychboard-mcp wants to run "${toolName}".${detail ? ` ${detail}` : ""} Allow?`;

  // A client can claim elicitation support but silently auto-resolve it
  // (accept or decline) without ever showing the user anything — observed
  // in practice, not hypothetical. So a clean "accept" is trusted (it's
  // the only outcome a real prompt and a fake one can't both produce for
  // free), but anything else — decline, cancel, or an outright error — is
  // NOT trusted as a genuine user decision. It always falls through to the
  // server-owned native dialog, which this process controls directly and
  // which the user just watched appear on screen. Only that dialog's
  // result is treated as final.
  let elicitationAccepted = false;
  try {
    const result = await server.server.elicitInput({
      message: summary,
      requestedSchema: { type: "object", properties: {} },
    });
    elicitationAccepted = result.action === "accept";
  } catch {
    elicitationAccepted = false;
  }

  if (elicitationAccepted) return;

  const approved = await serverSideApprovalDialog(toolName, detail);
  if (!approved) {
    throw new Error(`Tool "${toolName}" was declined by the user.`);
  }
}

// Same double-gate philosophy as confirmPermission, but specialized for
// git_commit: the user must see the REAL staged diff and the AI-drafted
// message, and must be able to edit the message before it's used. A plain
// yes/no dialog can't do that, so this spawns a custom WinForms dialog
// (commit-dialog.ps1) with a read-only diff pane and an editable message
// box. Same trust rule as confirmPermission: a clean elicitation "accept"
// is trusted, anything else falls through to the native dialog — but here
// only the native dialog's returned text is ever used as the final message
// (an accepted-but-unedited elicitation just keeps the AI's draft, since
// there's no UI in that path to prove a human reviewed/edited it).
async function confirmCommitMessage(toolName, repoLabel, diffText, draftMessage) {
  const entry = permissions.tools?.[toolName];
  if (!entry) {
    throw new Error(`Tool "${toolName}" has no entry in permissions.json — refusing to run.`);
  }
  if (entry.mode !== "auto" && entry.mode !== "confirm") {
    throw new Error(`Tool "${toolName}" is set to mode "${entry.mode}" in permissions.json — refusing to run.`);
  }
  if (entry.mode === "auto") return draftMessage;

  const diffPreview = diffText.length > 4000 ? diffText.slice(0, 4000) + "\n... (truncated for this preview)" : diffText;

  let elicitationAccepted = false;
  try {
    const result = await server.server.elicitInput({
      message: `sychboard-mcp wants to commit to "${repoLabel}".\n\nProposed message: ${draftMessage}\n\nDiff:\n${diffPreview}\n\nAllow?`,
      requestedSchema: {
        type: "object",
        properties: { message: { type: "string", default: draftMessage } },
      },
    });
    elicitationAccepted = result.action === "accept";
  } catch {
    elicitationAccepted = false;
  }
  if (elicitationAccepted) return draftMessage;

  // Native dialog: real diff + editable message, via temp files (diffs can
  // be too large/quote-hostile for a command-line/env-var round trip).
  const tmp = os.tmpdir();
  const stamp = `sychmcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const diffPath = path.join(tmp, `${stamp}-diff.txt`);
  const msgPath = path.join(tmp, `${stamp}-msg.txt`);
  const outPath = path.join(tmp, `${stamp}-out.txt`);
  try {
    fs.writeFileSync(diffPath, diffText, "utf8");
    fs.writeFileSync(msgPath, draftMessage, "utf8");

    const { stdout } = await execFileP(
      "powershell.exe",
      [
        "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", COMMIT_DIALOG_PS1,
        "-RepoLabel", repoLabel, "-DiffPath", diffPath, "-MsgPath", msgPath, "-OutPath", outPath,
      ],
      { timeout: 300_000 },
    );
    if (!stdout.includes("APPROVED") || !fs.existsSync(outPath)) {
      throw new Error(`Tool "${toolName}" was declined by the user.`);
    }
    return fs.readFileSync(outPath, "utf8");
  } finally {
    for (const f of [diffPath, msgPath, outPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

function jsonResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function errorResult(err) {
  return {
    content: [{ type: "text", text: `Error: ${err.message || err}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------- tools ----

async function getChuckBirdStatus() {
  // Read-only probe over SSH — same access path the deploy script uses.
  const remote = [
    `echo "ACTIVE=$(systemctl is-active ${CHUCKBIRD_SERVICE})"`,
    `echo "SINCE=$(systemctl show ${CHUCKBIRD_SERVICE} -p ActiveEnterTimestamp --value)"`,
    `echo "COGS=$(journalctl -u ${CHUCKBIRD_SERVICE} -o cat --no-pager | grep -oE 'Loaded [0-9]+ cogs' | tail -n 1)"`,
  ].join("; ");

  const { stdout } = await execFileP(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", CHUCKBIRD_SSH_HOST, remote],
    { timeout: 30_000 },
  );

  const get = (key) =>
    stdout.split("\n").find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? "";

  const active = get("ACTIVE");
  const since = get("SINCE");
  const cogsMatch = get("COGS").match(/Loaded (\d+) cogs/);

  // systemd timestamp looks like "Fri 2026-07-25 03:12:44 GMT" — drop the
  // weekday and let Date.parse handle the timezone token.
  let uptime = null;
  const ts = since.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*(\S*)/);
  if (ts) {
    const parsed = Date.parse(`${ts[1]} ${ts[2]}`.trim());
    if (!Number.isNaN(parsed)) {
      const secs = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
      const d = Math.floor(secs / 86400);
      const h = Math.floor((secs % 86400) / 3600);
      const m = Math.floor((secs % 3600) / 60);
      uptime = `${d}d ${h}h ${m}m`;
    }
  }

  return {
    service: CHUCKBIRD_SERVICE,
    host: CHUCKBIRD_SSH_HOST,
    state: active || "unknown",
    healthy: active === "active",
    active_since: since || null,
    uptime,
    cogs_loaded: cogsMatch ? Number(cogsMatch[1]) : null,
  };
}

async function getSystemStatus() {
  // CPU: sample the per-core counters twice and diff, since os.loadavg()
  // is always zero on Windows.
  const snap = () => os.cpus().map((c) => c.times);
  const a = snap();
  await new Promise((r) => setTimeout(r, 300));
  const b = snap();
  let idle = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    for (const k of Object.keys(b[i])) total += b[i][k] - a[i][k];
    idle += b[i].idle - a[i].idle;
  }
  const cpuPercent = total > 0 ? Math.round((1 - idle / total) * 100) : null;

  const gib = (bytes) => Math.round((bytes / 1024 ** 3) * 10) / 10;

  let disks = [];
  try {
    const { stdout } = await execFileP(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json",
      ],
      { timeout: 15_000 },
    );
    const parsed = JSON.parse(stdout);
    for (const d of Array.isArray(parsed) ? parsed : [parsed]) {
      disks.push({
        drive: d.DeviceID,
        total_gb: gib(d.Size),
        free_gb: gib(d.FreeSpace),
        used_percent: d.Size ? Math.round(((d.Size - d.FreeSpace) / d.Size) * 100) : null,
      });
    }
  } catch (err) {
    disks = [{ error: `disk query failed: ${err.message}` }];
  }

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    cpu_model: os.cpus()[0]?.model?.trim() ?? "unknown",
    cpu_cores: os.cpus().length,
    cpu_usage_percent: cpuPercent,
    ram_total_gb: gib(os.totalmem()),
    ram_free_gb: gib(os.freemem()),
    ram_used_percent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    disks,
    system_uptime_hours: Math.round((os.uptime() / 3600) * 10) / 10,
  };
}

async function restartChuckBird() {
  // Fixed command, no arguments, nothing else runs on the box.
  await execFileP(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", CHUCKBIRD_SSH_HOST, CHUCKBIRD_RESTART_CMD],
    { timeout: 30_000 },
  );
  return {
    command: CHUCKBIRD_RESTART_CMD,
    host: CHUCKBIRD_SSH_HOST,
    restarted: true,
  };
}

function requireRepoDir(repoKey) {
  const dir = GIT_REPOS[repoKey];
  if (!dir) throw new Error(`Unknown repo "${repoKey}" — only ${Object.keys(GIT_REPOS).join(", ")} are in scope.`);
  return dir;
}

// Stages everything and returns the staged diff — the exact content that
// would be committed. Staging is non-destructive/reversible (index only,
// no commit), so it's safe to do this just to preview.
async function stageAndDiff(dir) {
  await execFileP("git", ["-C", dir, "add", "-A"], { timeout: 30_000 });
  const { stdout } = await execFileP(
    "git", ["-C", dir, "diff", "--staged"],
    { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
  );
  return stdout;
}

async function gitDiff(repoKey) {
  const dir = requireRepoDir(repoKey);
  const diff = await stageAndDiff(dir);
  return { repo: repoKey, clean: diff.trim().length === 0, diff };
}

async function gitCommit(repoKey, draftMessage) {
  const dir = requireRepoDir(repoKey);
  const diff = await stageAndDiff(dir);
  if (!diff.trim()) {
    throw new Error(`Nothing staged to commit in "${repoKey}" — working tree is clean.`);
  }
  // stageAndDiff() above already ran `git add -A` — if the user declines
  // (or the approval step errors) below, undo that staging so a "no"
  // actually leaves the working tree as it found it, instead of silently
  // leaving everything staged despite the refusal.
  let finalMessage;
  try {
    finalMessage = await confirmCommitMessage("git_commit", repoKey, diff, draftMessage);
  } catch (err) {
    try {
      await execFileP("git", ["-C", dir, "reset"], { timeout: 10_000 });
    } catch {
      // best-effort unstage; surface the original decline/error either way
    }
    throw err;
  }
  await execFileP("git", ["-C", dir, "commit", "-m", finalMessage], { timeout: 30_000 });
  const { stdout: sha } = await execFileP("git", ["-C", dir, "rev-parse", "--short", "HEAD"], { timeout: 10_000 });
  return { repo: repoKey, message: finalMessage, sha: sha.trim(), committed: true };
}

// No --force, no branch deletion, no history rewriting — this only ever
// runs `git push origin <the actual current branch>`, nothing else is
// constructible through this tool's argument surface. Pushing "main" or
// "master" is refused unless the caller explicitly names that exact branch,
// proving it was an intentional, named request rather than an ambient default.
async function gitPush(repoKey, explicitBranch) {
  const dir = requireRepoDir(repoKey);
  const { stdout: branchOut } = await execFileP("git", ["-C", dir, "branch", "--show-current"], { timeout: 10_000 });
  const currentBranch = branchOut.trim();
  if (!currentBranch) {
    throw new Error(`"${repoKey}" is in a detached HEAD state — refusing to push.`);
  }
  if (PROTECTED_BRANCHES.has(currentBranch) && explicitBranch !== currentBranch) {
    throw new Error(
      `Current branch is "${currentBranch}" (protected). Refusing to push unless Daniel explicitly named it — ` +
      `pass branch: "${currentBranch}" only if he asked for exactly that in his latest message.`,
    );
  }

  let logSummary = "(no upstream to compare against — this may be the first push)";
  try {
    const { stdout } = await execFileP(
      "git", ["-C", dir, "log", `origin/${currentBranch}..${currentBranch}`, "--oneline"],
      { timeout: 15_000 },
    );
    logSummary = stdout.trim() || "(up to date with origin — nothing to push)";
  } catch {
    // no upstream ref yet — fall through with the placeholder summary above
  }

  await confirmPermission(
    "git_push",
    `Pushes branch "${currentBranch}" in ${repoKey} to origin. Commits to push:\n${logSummary}`,
  );

  await execFileP("git", ["-C", dir, "push", "origin", currentBranch], { timeout: 60_000 });
  return { repo: repoKey, branch: currentBranch, remote: "origin", pushed: true, commits: logSummary };
}

function listRecentProjectFiles(rootPath, limit) {
  const home = os.homedir();
  const resolved = path.resolve(rootPath);
  if (resolved !== home && !resolved.startsWith(home + path.sep)) {
    throw new Error(`Path must be inside ${home} (got: ${resolved}).`);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }

  const files = [];
  const MAX_DEPTH = 8;
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip, don't fail the whole listing
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          walk(full, depth + 1);
        }
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          files.push({
            path: path.relative(resolved, full),
            modified: stat.mtime.toISOString(),
            size_kb: Math.round((stat.size / 1024) * 10) / 10,
          });
        } catch {
          // file vanished mid-walk — ignore
        }
      }
    }
  };
  walk(resolved, 0);

  files.sort((x, y) => (x.modified < y.modified ? 1 : -1));
  return {
    root: resolved,
    total_files_seen: files.length,
    files: files.slice(0, limit),
  };
}

// -------------------------------------------------------------- server ----

const server = new McpServer({ name: "sychboard-mcp", version: "0.1.0" });

server.registerTool(
  "get_chuck_bird_status",
  {
    title: "Chuck Bird Bot status",
    description:
      "Check the Chuck Bird Discord bot's health on its production server: " +
      "systemd state, uptime, and loaded cog count. Read-only (SSH: systemctl + journalctl).",
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      await confirmPermission("get_chuck_bird_status", "Reads bot health over SSH.");
      return jsonResult(await getChuckBirdStatus());
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "get_system_status",
  {
    title: "Local system status",
    description:
      "CPU, RAM, and disk usage of this machine. Read-only.",
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      await confirmPermission("get_system_status", "Reads local CPU/RAM/disk usage.");
      return jsonResult(await getSystemStatus());
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "list_recent_project_files",
  {
    title: "Recently modified project files",
    description:
      "List the most recently modified files under a directory (must be inside the " +
      "user's home folder). Returns names, mtimes, and sizes — never file contents. " +
      "Skips node_modules, .git, build output, and other noise directories.",
    inputSchema: {
      path: z.string().describe("Absolute path to a project directory, e.g. C:\\Users\\danie\\Desktop\\chuck-bird-bot"),
      limit: z.number().int().min(1).max(200).optional().describe("Max files to return (default 20)"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ path: rootPath, limit }) => {
    try {
      await confirmPermission("list_recent_project_files", `Lists files under: ${rootPath}`);
      return jsonResult(listRecentProjectFiles(rootPath, limit ?? 20));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "restart_chuck_bird",
  {
    title: "Restart Chuck Bird Bot",
    description:
      `Restarts the Chuck Bird Discord bot's production service. Runs exactly ` +
      `"${CHUCKBIRD_RESTART_CMD}" over SSH on ${CHUCKBIRD_SSH_HOST} — nothing else, ` +
      `no other commands, no file access on that box beyond what systemctl needs. ` +
      `WRITE action: causes a brief live outage for connected players.`,
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  async () => {
    try {
      await confirmPermission(
        "restart_chuck_bird",
        `Runs: ${CHUCKBIRD_RESTART_CMD} (SSH, ${CHUCKBIRD_SSH_HOST}). No other commands. This will briefly interrupt the live bot.`,
      );
      return jsonResult(await restartChuckBird());
    } catch (err) {
      return errorResult(err);
    }
  },
);

const REPO_ENUM = z.enum(Object.keys(GIT_REPOS));

server.registerTool(
  "git_diff",
  {
    title: "Git diff (SychBoard / Chuck Bird only)",
    description:
      "Shows the current diff (stages all changes first, non-destructive) for one of the " +
      "two in-scope repos. Use this before git_commit to draft an accurate commit message " +
      "from the real changes — never invent a message without reading this first.",
    inputSchema: { repo: REPO_ENUM.describe("Which repo: 'sychboard' or 'chuck-bird'.") },
    annotations: { readOnlyHint: true },
  },
  async ({ repo }) => {
    try {
      await confirmPermission("git_diff", `Reads and stages the current diff in ${repo}.`);
      return jsonResult(await gitDiff(repo));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "git_commit",
  {
    title: "Git commit (SychBoard / Chuck Bird only)",
    description:
      "Commits all current changes in one of the two in-scope repos. Call git_diff first, " +
      "draft `message` from the ACTUAL diff it returns — never a generic or invented message. " +
      "Daniel will see the real diff and your draft message side by side and can edit the " +
      "message before approving; the version he approves is what gets committed, not " +
      "necessarily your exact draft. Never runs --amend, never rewrites history.",
    inputSchema: {
      repo: REPO_ENUM.describe("Which repo: 'sychboard' or 'chuck-bird'."),
      message: z.string().min(1).describe("Proposed commit message, drafted from the real diff (see git_diff)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ repo, message }) => {
    try {
      return jsonResult(await gitCommit(repo, message));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  "git_push",
  {
    title: "Git push (SychBoard / Chuck Bird only)",
    description:
      "Pushes the current branch of one of the two in-scope repos to origin. " +
      "IMPORTANT — call this ONLY if Daniel's latest message explicitly asked for a push, " +
      "right now, in this request. Never call it automatically after git_commit, never offer " +
      "it as a suggested next step, never treat an earlier push approval as standing " +
      "permission for later commits. Never uses --force/--force-with-lease, never deletes a " +
      "branch, never rewrites history. Pushing 'main' or 'master' requires the `branch` " +
      "argument to exactly name it, proving Daniel explicitly asked for that branch.",
    inputSchema: {
      repo: REPO_ENUM.describe("Which repo: 'sychboard' or 'chuck-bird'."),
      branch: z.string().optional().describe(
        "Only set this if pushing 'main'/'master' AND Daniel's message explicitly named that branch. " +
        "Must exactly equal the branch currently checked out. Omit for any non-protected branch.",
      ),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  async ({ repo, branch }) => {
    try {
      return jsonResult(await gitPush(repo, branch));
    } catch (err) {
      return errorResult(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[sychboard-mcp] ready (stdio) — 7 tools registered (4 read-only, 3 write/confirm-only)");
