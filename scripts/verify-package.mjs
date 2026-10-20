#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const binTarget = packageJson.bin?.blobbudget;

if (binTarget !== "dist/src/cli.js") {
  console.error("Expected package bin blobbudget -> dist/src/cli.js");
  process.exit(1);
}

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
});

const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
const requiredFiles = [
  "dist/src/cli.js",
  "dist/src/index.js",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md"
];

const missing = requiredFiles.filter((file) => !files.has(file));
const unexpectedDocs = [...files].filter((file) => file === "docs" || file.startsWith("docs/"));

if (missing.length > 0) {
  console.error("Package dry run is missing required release file(s):");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

if (unexpectedDocs.length > 0) {
  console.error("Package dry run must not include repository documentation:");
  for (const file of unexpectedDocs) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`verified blobbudget package surface (${pack.files.length} files; repository docs excluded)`);
