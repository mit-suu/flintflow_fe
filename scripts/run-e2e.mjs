/**
 * run-e2e.mjs
 * Khởi động MongoMemoryReplSet (1 node), seed dữ liệu E2E cho workspace + billing,
 * bật BE (5000) + FE (3000), chạy Playwright thật và dọn toàn bộ tiến trình khi xong.
 *
 * Quan trọng: luôn chạy seed bằng `spawn` bất đồng bộ (KHÔNG `spawnSync`) để event loop của
 * tiến trình cha tiếp tục xả pipe stdout/stderr của `mongod`, tránh deadlock.
 */
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const feDir = path.resolve(__dirname, "..");
const beDir = path.resolve(feDir, "../flintflow_be");

const require = createRequire(import.meta.url);
const { MongoMemoryReplSet } = require(path.join(beDir, "node_modules/mongodb-memory-server/index.js"));

const tsxCli = path.join(beDir, "node_modules/tsx/dist/cli.mjs");
const nextCli = path.join(feDir, "node_modules/next/dist/bin/next");
const playwrightCli = path.join(feDir, "node_modules/@playwright/test/cli.js");

const checkPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });

const withDbName = (uri, dbName) => {
  const url = new URL(uri);
  url.pathname = `/${dbName}`;
  return url.toString();
};

const killTree = (child) => {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      // Đã thoát
    }
  }
};

const waitExit = (child, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          killTree(child);
          reject(new Error(`Tiến trình pid=${child.pid} vượt quá thời gian chờ ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    child.once("error", (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(code ?? 1);
    });
  });

const runNodeAsync = async (args, cwd, env, timeoutMs = 60_000) => {
  const child = spawn(process.execPath, args, { cwd, env, stdio: "inherit" });
  const code = await waitExit(child, timeoutMs);
  if (code !== 0) {
    throw new Error(`Lệnh ${args.join(" ")} thất bại (exit ${code})`);
  }
};

const waitHttpReady = async (url, timeoutMs, proc, name) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`${name} thoát sớm với mã ${proc.exitCode}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Đợi server mở cổng
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Hết thời gian chờ ${name} tại ${url}`);
};

const main = async () => {
  const [free3000, free5000] = await Promise.all([checkPortFree(3000), checkPortFree(5000)]);
  if (!free3000 || !free5000) {
    throw new Error(`Cổng phải trống trước khi chạy E2E (3000 free=${free3000}, 5000 free=${free5000}).`);
  }

  let replSet = null;
  let beProc = null;
  let feProc = null;
  let pwProc = null;
  let exitCode = 1;

  try {
    console.log("[e2e] Starting MongoMemoryReplSet...");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const mongoUri = withDbName(replSet.getUri(), "flintflow_e2e");

    const beEnv = {
      ...process.env,
      NODE_ENV: "test",
      PORT: "5000",
      MONGO_URI: mongoUri,
      CLIENT_URL: "http://localhost:3000",
      APP_URL: "http://localhost:3000",
      APP_PUBLIC_URL: "http://localhost:5000",
      JWT_ACCESS_SECRET: "e2e-jwt-access-secret-at-least-32-chars-long",
      JWT_REFRESH_SECRET: "e2e-jwt-refresh-secret-at-least-32-chars-long",
      AI_PROVIDER_OVERRIDE: "mock",
      EMBEDDING_PROVIDER: "off",
      KNOWLEDGE_ENABLED: "false",
      JOB_DRIVER: "inline",
      WORKERS_IN_PROCESS: "false",
      REDIS_URL: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      PAYMENT_SERVICE_URL: "",
      PAYMENT_CLIENT_ID: "flintflow-e2e-client",
      PAYMENT_API_KEY: "",
      PLANTUML_BASE_URL: "http://127.0.0.1:9",
      PLANTUML_TIMEOUT_MS: "1000",
      PLANTUML_RETRY_DELAYS_MS: "",
      GOTENBERG_URL: "http://127.0.0.1:9",
      GOTENBERG_TIMEOUT_MS: "1000",
    };

    console.log("[e2e] Seeding workspace user & billing accounts...");
    await runNodeAsync([tsxCli, "src/scripts/seed-e2e-user.ts"], beDir, beEnv, 60_000);
    await runNodeAsync([tsxCli, "src/scripts/seed-e2e-billing.ts"], beDir, beEnv, 60_000);

    console.log("[e2e] Starting BE on :5000...");
    beProc = spawn(process.execPath, [tsxCli, "src/server.ts"], { cwd: beDir, env: beEnv, stdio: "inherit" });
    await waitHttpReady("http://localhost:5000/health", 45_000, beProc, "BE");

    console.log("[e2e] Starting FE on :3000...");
    const feEnv = {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_API_URL: "http://localhost:5000/api/v1",
    };
    feProc = spawn(process.execPath, [nextCli, "dev", "--port", "3000"], { cwd: feDir, env: feEnv, stdio: "inherit" });
    await waitHttpReady("http://localhost:3000/login", 90_000, feProc, "FE");

    console.log("[e2e] Running Playwright tests...");
    const pwArgs = [playwrightCli, "test", ...process.argv.slice(2)];
    pwProc = spawn(process.execPath, pwArgs, {
      cwd: feDir,
      env: {
        ...process.env,
        E2E_BASE_URL: "http://localhost:3000",
        E2E_API_URL: "http://localhost:5000/api/v1",
      },
      stdio: "inherit",
    });
    exitCode = await waitExit(pwProc, 180_000);
  } finally {
    console.log("[e2e] Cleaning up FE, BE, and MongoMemoryReplSet...");
    killTree(pwProc);
    killTree(feProc);
    killTree(beProc);
    if (replSet) {
      await replSet.stop().catch(() => undefined);
    }
  }

  process.exit(exitCode);
};

main().catch((err) => {
  console.error("[e2e] Fatal error:", err);
  process.exit(1);
});
