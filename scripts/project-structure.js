// scripts/project-structure.js
import { readdirSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const OUTPUT = "PROJECT_STRUCTURE.md";
const IGNORE = ["node_modules", ".next", ".git", "dist", "coverage"];

function walk(dir, base = "") {
  const entries = readdirSync(dir, { withFileTypes: true });

  return entries.flatMap(entry => {
    if (IGNORE.includes(entry.name)) return [];

    const fullPath = join(dir, entry.name);
    const relativePath = join(base, entry.name);

    if (entry.isDirectory()) {
      return [
        { type: "Folder", path: relativePath },
        ...walk(fullPath, relativePath)
      ];
    }

    return [{ type: "File", path: relativePath }];
  });
}

const rows = walk(ROOT);

let output = `| Type | Path |\n|------|------|\n`;
rows.forEach(r => {
  output += `| ${r.type} | ${r.path} |\n`;
});

writeFileSync(OUTPUT, output, "utf8");
console.log(`✔ Project structure written to ${OUTPUT}`);
