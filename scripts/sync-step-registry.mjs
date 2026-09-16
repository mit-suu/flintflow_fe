// Copy step registry từ BE (nguồn sự thật, T12) sang FE.
// Dùng: npm run sync:registry  (mặc định đọc ../flintflow_be; đổi bằng STEP_REGISTRY_SOURCE=<đường dẫn json>)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.STEP_REGISTRY_SOURCE
  ? path.resolve(process.env.STEP_REGISTRY_SOURCE)
  : path.resolve(root, "..", "flintflow_be", "assets", "step-registry.json");
const target = path.join(root, "lib", "constants", "step-registry.json");

if (!fs.existsSync(source)) {
  console.error(`[sync:registry] Không thấy ${source}`);
  process.exit(1);
}

const steps = JSON.parse(fs.readFileSync(source, "utf8"));
if (!Array.isArray(steps) || steps.length === 0) {
  console.error("[sync:registry] step-registry.json phải là mảng khác rỗng");
  process.exit(1);
}

fs.writeFileSync(target, `${JSON.stringify(steps, null, 2)}\n`);
console.log(`[sync:registry] ${steps.length} step → ${path.relative(root, target)}`);
