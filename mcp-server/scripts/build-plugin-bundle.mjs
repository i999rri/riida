#!/usr/bin/env node
// Assembles a self-contained plugin bundle under plugin-bundle/: the
// agent-plugins.org (https://agent-plugins.org/) manifest (plugin.json,
// mcp.json), the Claude Code native manifest (.claude-plugin/plugin.json,
// .mcp.json), a built dist/, and production-only node_modules — so either
// kind of plugin client can run it without a separate build or npm install.
// Run `npm run build` first (or via `npm run package:plugin`, which chains it).

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(packageRoot);
const bundleDir = path.join(packageRoot, "plugin-bundle");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(path.join(packageRoot, "dist", "index.js"))) {
  console.error("dist/index.js not found — run `npm run build` first.");
  process.exit(1);
}

fs.rmSync(bundleDir, { recursive: true, force: true });
fs.mkdirSync(bundleDir, { recursive: true });

copyFile(path.join(packageRoot, "plugin.json"), path.join(bundleDir, "plugin.json"));
copyFile(path.join(packageRoot, "mcp.json"), path.join(bundleDir, "mcp.json"));
copyFile(
  path.join(packageRoot, ".claude-plugin", "plugin.json"),
  path.join(bundleDir, ".claude-plugin", "plugin.json"),
);
copyFile(path.join(packageRoot, ".mcp.json"), path.join(bundleDir, ".mcp.json"));
copyFile(path.join(packageRoot, "README.md"), path.join(bundleDir, "README.md"));
copyFile(path.join(repoRoot, "LICENSE"), path.join(bundleDir, "LICENSE"));
copyFile(path.join(packageRoot, "package.json"), path.join(bundleDir, "package.json"));
copyFile(
  path.join(packageRoot, "package-lock.json"),
  path.join(bundleDir, "package-lock.json"),
);
fs.cpSync(path.join(packageRoot, "dist"), path.join(bundleDir, "dist"), { recursive: true });

console.log("Installing production-only dependencies into plugin-bundle/ ...");
execFileSync("npm", ["ci", "--omit=dev"], { cwd: bundleDir, stdio: "inherit" });

console.log(`Plugin bundle ready: ${bundleDir}`);
