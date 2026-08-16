import { chmod, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const source = join(root, ".githooks", "pre-push");
if (!existsSync(source)) process.exit(0);

await mkdir(join(root, ".githooks"), { recursive: true });
await chmod(source, 0o755);
try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
  console.log("[Git] Hook pre-push configurado em .githooks.");
} catch {
  console.warn("[Git] Não foi possível configurar o hook pre-push automaticamente.");
}
