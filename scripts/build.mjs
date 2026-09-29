import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
fs.rmSync("dist", { recursive: true, force: true });
execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
  stdio: "inherit",
});
execFileSync(
  process.execPath,
  [
    tsc,
    "-p",
    "tsconfig.json",
    "--module",
    "CommonJS",
    "--moduleResolution",
    "Node",
    "--outDir",
    "dist/cjs",
  ],
  { stdio: "inherit" },
);
fs.writeFileSync("dist/cjs/package.json", '{"type":"commonjs"}\n');
