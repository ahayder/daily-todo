import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const packageJsonPath = path.join(projectRoot, "package.json");
const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(projectRoot, "src-tauri", "Cargo.toml");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const version = packageJson.version;

if (typeof version !== "string" || version.length === 0) {
  throw new Error("package.json must define a version before syncing desktop metadata.");
}

const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
tauriConfig.version = version;
await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoToml = await readFile(cargoTomlPath, "utf8");
const packageBlockPattern = /(\[package\][\s\S]*?\nversion = ")([^"]+)(")/;
const syncedCargoToml = cargoToml.replace(
  packageBlockPattern,
  `$1${version}$3`,
);

if (!packageBlockPattern.test(cargoToml)) {
  throw new Error("Could not find the package version field in src-tauri/Cargo.toml.");
}

await writeFile(cargoTomlPath, syncedCargoToml);
process.stdout.write(`Synchronized desktop version to ${version}.\n`);
