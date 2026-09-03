#!/usr/bin/env bun
/**
 * Skills registry CLI — add remote skills from GitHub, sync them, register local ones.
 *
 * Usage:
 *   bun run skills add <github-url> [--name <name>]
 *   bun run skills sync [name...]
 *   bun run skills list
 *   bun run skills local <name> [--objective <text>]
 *   bun run skills readme
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const REGISTRY_PATH = join(ROOT, "skills.json");
const README_PATH = join(ROOT, "README.md");

type SkillEntry = {
  name: string;
  /** Canonical GitHub tree/blob URL; null for locally maintained skills */
  source: string | null;
  objective: string;
  /** true = owned locally, never overwritten by sync */
  local: boolean;
};

type Registry = {
  skillsDir: string;
  skills: SkillEntry[];
};

type ParsedGithubUrl = {
  owner: string;
  repo: string;
  ref: string;
  /** Directory path in the repo (skill folder). No trailing slash. */
  dirPath: string;
  htmlTreeUrl: string;
};

function loadRegistry(): Registry {
  if (!existsSync(REGISTRY_PATH)) {
    return { skillsDir: ".agents/skills", skills: [] };
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as Registry;
}

function saveRegistry(registry: Registry): void {
  registry.skills.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
}

function skillsRoot(registry: Registry): string {
  return join(ROOT, registry.skillsDir);
}

/**
 * Accepts:
 *   https://github.com/owner/repo/tree/ref/path/to/skill
 *   https://github.com/owner/repo/blob/ref/path/to/skill/SKILL.md
 *   https://github.com/owner/repo/blob/ref/path/to/skill/other.md
 */
function parseGithubUrl(url: string): ParsedGithubUrl {
  const trimmed = url.trim().replace(/\/+$/, "");
  const treeMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/,
  );
  if (treeMatch) {
    const [, owner, repo, ref, path] = treeMatch;
    return {
      owner,
      repo,
      ref,
      dirPath: path.replace(/\/+$/, ""),
      htmlTreeUrl: `https://github.com/${owner}/${repo}/tree/${ref}/${path.replace(/\/+$/, "")}`,
    };
  }

  const blobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
  );
  if (blobMatch) {
    const [, owner, repo, ref, filePath] = blobMatch;
    const parts = filePath.split("/");
    // If pointing at a file inside a skill dir, use the parent directory
    const dirPath =
      parts.length > 1 && parts[parts.length - 1].includes(".")
        ? parts.slice(0, -1).join("/")
        : filePath;
    return {
      owner,
      repo,
      ref,
      dirPath,
      htmlTreeUrl: `https://github.com/${owner}/${repo}/tree/${ref}/${dirPath}`,
    };
  }

  throw new Error(
    `Unrecognized GitHub URL.\nExpected tree or blob URL, e.g.\n` +
      `  https://github.com/owner/repo/tree/main/skills/my-skill\n` +
      `  https://github.com/owner/repo/blob/main/skills/my-skill/SKILL.md`,
  );
}

type GhContent =
  | {
      type: "file";
      name: string;
      path: string;
      download_url: string | null;
      content?: string;
      encoding?: string;
    }
  | {
      type: "dir";
      name: string;
      path: string;
      url: string;
    };

async function githubGet(apiUrl: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skills-registry-cli",
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} for ${apiUrl}\n${body}`);
  }
  return res;
}

async function listDirContents(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<GhContent[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const res = await githubGet(apiUrl);
  const data = (await res.json()) as GhContent | GhContent[];
  if (!Array.isArray(data)) {
    throw new Error(`Expected a directory at ${path}, got a file`);
  }
  return data;
}

async function downloadFile(downloadUrl: string): Promise<Uint8Array> {
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": "skills-registry-cli" },
  });
  if (!res.ok) throw new Error(`Failed to download ${downloadUrl}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function downloadTree(
  parsed: ParsedGithubUrl,
  destDir: string,
): Promise<string[]> {
  const written: string[] = [];

  async function walk(relPath: string): Promise<void> {
    const entries = await listDirContents(
      parsed.owner,
      parsed.repo,
      relPath,
      parsed.ref,
    );
    for (const entry of entries) {
      const localRel = relative(parsed.dirPath, entry.path);
      const dest = join(destDir, localRel);
      if (entry.type === "dir") {
        mkdirSync(dest, { recursive: true });
        await walk(entry.path);
      } else if (entry.type === "file") {
        mkdirSync(dirname(dest), { recursive: true });
        if (!entry.download_url) {
          throw new Error(`No download_url for ${entry.path}`);
        }
        const bytes = await downloadFile(entry.download_url);
        writeFileSync(dest, bytes);
        written.push(localRel);
      }
    }
  }

  mkdirSync(destDir, { recursive: true });
  await walk(parsed.dirPath);
  return written;
}

function extractObjective(skillMdPath: string): string {
  if (!existsSync(skillMdPath)) return "";
  const text = readFileSync(skillMdPath, "utf8");
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return "";
  const descMatch = fm[1].match(/^description:\s*(.+)$/m);
  if (!descMatch) return "";
  let desc = descMatch[1].trim();
  // Folded YAML: description: >\n  line1\n  line2
  if (desc === ">" || desc === "|" || desc === ">-" || desc === "|-") {
    const block = fm[1].match(
      /^description:\s*[>|]-?\r?\n((?:[ \t]+.+\r?\n?)*)/m,
    );
    if (block) {
      desc = block[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[ \t]+/, ""))
        .join(" ")
        .trim();
    }
  }
  // Strip wrapping quotes
  if (
    (desc.startsWith('"') && desc.endsWith('"')) ||
    (desc.startsWith("'") && desc.endsWith("'"))
  ) {
    desc = desc.slice(1, -1);
  }
  return desc;
}

function inferName(dirPath: string, override?: string): string {
  if (override) return override;
  const base = dirPath.split("/").filter(Boolean).pop();
  if (!base) throw new Error("Could not infer skill name from URL path");
  return base;
}

function writeReadme(registry: Registry): void {
  const remote = registry.skills.filter((s) => !s.local && s.source);
  const local = registry.skills.filter((s) => s.local || !s.source);

  const rows = (entries: SkillEntry[]) =>
    entries
      .map((s) => {
        const source = s.source
          ? `[${s.source}](${s.source})`
          : "_local (no remote)_";
        const objective = s.objective.replace(/\|/g, "\\|") || "—";
        return `| \`${s.name}\` | ${source} | ${objective} |`;
      })
      .join("\n");

  let body = `# Skills

Registry of agent skills under \`${registry.skillsDir}/\`.

Remote skills are downloaded and refreshed from their source repos. Local skills are maintained in this repo and are never overwritten by sync.

## Commands

\`\`\`bash
# Add a skill from a GitHub tree or blob URL
bun run skills add https://github.com/owner/repo/tree/main/path/to/skill

# Sync all remote skills (or pass names to sync a subset)
bun run skills sync
bun run skills sync frontend-design

# Register a skill you maintain yourself (no remote URL)
bun run skills local my-skill --objective "What this skill does"

# List registry entries / regenerate this README
bun run skills list
bun run skills readme
\`\`\`

Optional: set \`GITHUB_TOKEN\` or \`GH_TOKEN\` if you hit GitHub API rate limits.
`;

  if (remote.length > 0) {
    body += `
## Remote skills

| Skill | Source | Objective |
| --- | --- | --- |
${rows(remote)}
`;
  }

  if (local.length > 0) {
    body += `
## Local skills

| Skill | Source | Objective |
| --- | --- | --- |
${rows(local)}
`;
  }

  if (remote.length === 0 && local.length === 0) {
    body += `
_No skills registered yet. Add one with \`bun run skills add <url>\`._
`;
  }

  writeFileSync(README_PATH, `${body.trim()}\n`);
}

async function cmdAdd(args: string[]): Promise<void> {
  let url: string | undefined;
  let nameOverride: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      nameOverride = args[++i];
    } else if (!url) {
      url = args[i];
    }
  }
  if (!url) {
    console.error("Usage: bun run skills add <github-url> [--name <name>]");
    process.exit(1);
  }

  const parsed = parseGithubUrl(url);
  const name = inferName(parsed.dirPath, nameOverride);
  const registry = loadRegistry();
  const dest = join(skillsRoot(registry), name);

  const existing = registry.skills.find((s) => s.name === name);
  if (existing?.local) {
    console.error(
      `Skill "${name}" is marked local and will not be overwritten by add.`,
    );
    process.exit(1);
  }

  // Fresh download into a temp sibling, then swap — keeps partial failures clean
  const tmp = `${dest}.__download`;
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

  console.log(`Downloading ${parsed.htmlTreeUrl} → ${registry.skillsDir}/${name}`);
  const files = await downloadTree(parsed, tmp);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  renameSync(tmp, dest);

  const objective = extractObjective(join(dest, "SKILL.md"));
  const entry: SkillEntry = {
    name,
    source: parsed.htmlTreeUrl,
    objective,
    local: false,
  };

  if (existing) {
    Object.assign(existing, entry);
  } else {
    registry.skills.push(entry);
  }
  saveRegistry(registry);
  writeReadme(registry);

  console.log(`Added ${name} (${files.length} files)`);
  if (objective) console.log(`Objective: ${objective}`);
}

async function syncOne(registry: Registry, entry: SkillEntry): Promise<void> {
  if (entry.local || !entry.source) {
    console.log(`skip ${entry.name} (local)`);
    return;
  }
  const parsed = parseGithubUrl(entry.source);
  const dest = join(skillsRoot(registry), entry.name);
  const tmp = `${dest}.__download`;
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

  console.log(`sync ${entry.name} ← ${entry.source}`);
  const files = await downloadTree(parsed, tmp);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  renameSync(tmp, dest);

  const objective = extractObjective(join(dest, "SKILL.md"));
  if (objective) entry.objective = objective;
  // Normalize source to canonical tree URL
  entry.source = parsed.htmlTreeUrl;
  console.log(`  ${files.length} files`);
}

async function cmdSync(args: string[]): Promise<void> {
  const registry = loadRegistry();
  const names = args.filter((a) => !a.startsWith("-"));
  const targets =
    names.length === 0
      ? registry.skills
      : registry.skills.filter((s) => names.includes(s.name));

  if (names.length > 0) {
    const missing = names.filter((n) => !registry.skills.some((s) => s.name === n));
    if (missing.length) {
      console.error(`Not in registry: ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  if (targets.length === 0) {
    console.log("No skills to sync.");
    return;
  }

  for (const entry of targets) {
    await syncOne(registry, entry);
  }
  saveRegistry(registry);
  writeReadme(registry);
  console.log("Done.");
}

function cmdLocal(args: string[]): void {
  let name: string | undefined;
  let objective = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--objective" && args[i + 1]) {
      objective = args[++i];
    } else if (!name) {
      name = args[i];
    }
  }
  if (!name) {
    console.error(
      'Usage: bun run skills local <name> [--objective "description"]',
    );
    process.exit(1);
  }

  const registry = loadRegistry();
  const dir = join(skillsRoot(registry), name);
  if (!existsSync(join(dir, "SKILL.md"))) {
    console.error(`Expected ${registry.skillsDir}/${name}/SKILL.md to exist first.`);
    process.exit(1);
  }

  if (!objective) objective = extractObjective(join(dir, "SKILL.md"));

  const existing = registry.skills.find((s) => s.name === name);
  if (existing) {
    existing.local = true;
    existing.source = null;
    existing.objective = objective || existing.objective;
  } else {
    registry.skills.push({
      name,
      source: null,
      objective,
      local: true,
    });
  }
  saveRegistry(registry);
  writeReadme(registry);
  console.log(`Registered local skill: ${name}`);
}

function cmdList(): void {
  const registry = loadRegistry();
  if (registry.skills.length === 0) {
    console.log("(empty registry)");
    return;
  }
  for (const s of registry.skills) {
    const kind = s.local || !s.source ? "local" : "remote";
    console.log(`${s.name}\t[${kind}]\t${s.source ?? "—"}\t${s.objective}`);
  }
}

function cmdReadme(): void {
  const registry = loadRegistry();
  writeReadme(registry);
  console.log(`Wrote ${relative(ROOT, README_PATH)}`);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "add":
      await cmdAdd(args);
      break;
    case "sync":
      await cmdSync(args);
      break;
    case "local":
      cmdLocal(args);
      break;
    case "list":
      cmdList();
      break;
    case "readme":
      cmdReadme();
      break;
    default:
      console.log(`Skills registry CLI

Commands:
  add <github-url> [--name <name>]   Download skill + register remote source
  sync [name...]                     Re-download remote skills from source
  local <name> [--objective "..."]   Register a self-maintained skill (no URL)
  list                               Show registry
  readme                             Regenerate README.md from skills.json
`);
      process.exit(cmd ? 1 : 0);
  }
}

await main();
