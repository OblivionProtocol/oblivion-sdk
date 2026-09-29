import fs from "node:fs";
import path from "node:path";
const skip = new Set(["node_modules", ".git"]);
let checked = 0;
const patterns = [
  /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:DEPLOYER_EXECUTOR|PRIVATE_KEY|ACCESS_TOKEN)\s*[:=]\s*['"]?[A-Za-z0-9_+\/-]{24,}/,
];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.name.endsWith(".tgz")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    if (entry.name.startsWith(".env") || /\.(?:pem|key|sol)$/.test(entry.name))
      throw new Error("Forbidden distribution file: " + p);
    if (p.endsWith("check-public.mjs")) continue;
    const text = fs.readFileSync(p, "utf8");
    if (patterns.some((r) => r.test(text)))
      throw new Error("Sensitive-content pattern found in: " + p);
    checked++;
  }
}
walk(".");
console.log(
  `Public-source scan passed (${checked} files). Exact production-secret comparison is a separate release check.`,
);
