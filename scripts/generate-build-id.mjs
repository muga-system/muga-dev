import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const buildId = new Date().toISOString().replace(/[-:.TZ]/g, "");
const buildIdFilePath = resolve(process.cwd(), "public", "build-id.txt");

mkdirSync(dirname(buildIdFilePath), { recursive: true });
writeFileSync(buildIdFilePath, `${buildId}\n`, "utf8");

console.log(`Build ID generated: ${buildId}`);
