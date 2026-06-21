import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { build } from "esbuild";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const seaDir = resolve(rootDir, "build", "sea-win");
const releaseDir = resolve(rootDir, "release", "ark-asa-mcp-win-x64");
const bundledEntry = resolve(seaDir, "main.cjs");
const seaConfigPath = resolve(seaDir, "sea-config.json");
const executablePath = resolve(releaseDir, "ark-asa-mcp.exe");

rmSync(seaDir, { recursive: true, force: true });
rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(seaDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

await build({
  entryPoints: [resolve(rootDir, "src", "index.ts")],
  outfile: bundledEntry,
  bundle: true,
  platform: "node",
  target: "node26",
  format: "cjs",
});

writeFileSync(
  seaConfigPath,
  `${JSON.stringify(
    {
      main: bundledEntry,
      mainFormat: "commonjs",
      output: executablePath,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

try {
  execFileSync(process.execPath, ["--build-sea", seaConfigPath], {
    cwd: rootDir,
    stdio: "inherit",
  });
} catch (error) {
  throw new Error(
    "Failed to build the Windows executable. Use Node.js 26 or newer for npm run package:win.",
    { cause: error },
  );
}

copyFileSync(resolve(rootDir, "config.example.json"), resolve(releaseDir, "config.example.json"));
copyFileSync(resolve(rootDir, "docs", "README-USER.md"), resolve(releaseDir, "README-USER.md"));
copyFileSync(resolve(rootDir, "LICENSE"), resolve(releaseDir, "LICENSE"));

console.log(`Packaged Windows release folder: ${releaseDir}`);
