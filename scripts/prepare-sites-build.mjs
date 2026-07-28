import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const serverEntry = resolve(projectRoot, "dist/server/index.js");
const sourceMetadata = resolve(projectRoot, ".openai/hosting.json");
const targetMetadataDir = resolve(projectRoot, "dist/.openai");
const targetMetadata = resolve(targetMetadataDir, "hosting.json");

if (!existsSync(serverEntry)) {
  throw new Error("vinext build did not produce dist/server/index.js");
}

if (existsSync(sourceMetadata)) {
  mkdirSync(targetMetadataDir, { recursive: true });
  copyFileSync(sourceMetadata, targetMetadata);
}
