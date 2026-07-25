#!/usr/bin/env node
/**
 * sychboard-mcp — Phase 1 of turning SychBoard into a personal AI OS.
 *
 * Minimal local MCP server (stdio transport), read-only tools only.
 * Every tool is gated by permissions.json: no entry or an unrecognized
 * mode means the call is refused server-side. The "confirm" vs "auto"
 * distinction is enforced by the calling client — Claude Code prompts
 * before "confirm"-tier tools by default, and SychBoard's in-app AI
 * Assistant will read the same file when it becomes an MCP client.
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

const permissions = JSON.parse(
  fs.readFileSync(path.join(__dirname, "permissions.json"), "utf8"),
);

const CHUCKBIRD_SSH_HOST = process.env.CHUCKBIRD_SSH_HOST || "opc@152.67.159.196";
const CHUCKBIRD_SERVICE = "chuckbird.service";

// Directories that are never interesting as "recent project files".
const IGNORED_DIRS = new Set([
  "node_modules", ".git", "__pycache__", ".venv", "venv",
  "dist", "build", "out", "release", ".next", "coverage",
]);

function requirePermission(toolName) {
  const entry = permissions.tools?.[toolName];
  if (!entry) {
    throw new Error(
      `Tool "${toolName}" has no entry in permissions.json — refusing to run.`,
    );
  }
  if (entry.mode !== "auto" && entry.mode !== "confirm") {
    throw new Error(
      `Tool "${toolName}" is set to mode "${entry.mode}" in permissions.json — refusing to run.`,
    );
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
      requirePermission("get_chuck_bird_status");
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
      requirePermission("get_system_status");
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
      requirePermission("list_recent_project_files");
      return jsonResult(listRecentProjectFiles(rootPath, limit ?? 20));
    } catch (err) {
      return errorResult(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[sychboard-mcp] ready (stdio) — 3 read-only tools registered");
