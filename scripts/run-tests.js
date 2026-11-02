const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { spawnSync } = require("child_process");

const libDir = path.join(__dirname, "../src/lib");
const outDir = path.join(__dirname, "../.tests_dist");

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Recursively find all .ts files under src/lib
function findTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findTsFiles(fullPath));
    } else if (file.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findTsFiles(libDir);

console.log("Transpiling test files with TypeScript...");
for (const filePath of files) {
  const code = fs.readFileSync(filePath, "utf-8");
  const result = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });

  const relPath = path.relative(libDir, filePath);
  const outPath = path.join(outDir, relPath.replace(/\.ts$/, ".js"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, result.outputText);
}

// Find all transpiled test files recursively
function findTestFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findTestFiles(fullPath));
    } else if (file.endsWith(".test.js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const testFiles = findTestFiles(outDir);

const liveDbFile = path.join(__dirname, "../.data/aqarpulse_db.json");
const testDbFile = path.join(outDir, "test_aqarpulse_db.json");
if (fs.existsSync(liveDbFile)) {
  fs.copyFileSync(liveDbFile, testDbFile);
}
const testEnv = {
  ...process.env,
  AQARPULSE_DB_FILE: testDbFile,
};

console.log(`Running ${testFiles.length} test suites with Node.js test runner...`);
const res = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  env: testEnv,
});

if (res.status === 0) {
  console.log("\n▶ Running Additional Real Integration Test Suites in tests/ ...");
  const test1 = spawnSync(process.execPath, [path.join(__dirname, "../tests/property-lifecycle.test.mjs")], { stdio: "inherit" });
  if (test1.status !== 0) process.exit(test1.status || 1);

  const test2 = spawnSync(process.execPath, [path.join(__dirname, "../tests/property-retraction-test.mjs")], { stdio: "inherit" });
  if (test2.status !== 0) process.exit(test2.status || 1);

  const test3 = spawnSync(process.execPath, [path.join(__dirname, "../tests/phase1-user-journeys.test.mjs")], { stdio: "inherit" });
  if (test3.status !== 0) process.exit(test3.status || 1);

  const http = require("http");
  const req = http.get("http://localhost:3000/api/auth/me", () => {
    console.log("\n▶ Local server detected on http://localhost:3000. Running Real API Security Integration Suite...");
    const realApiRes = spawnSync(process.execPath, [path.join(__dirname, "test-api-security-real.js")], {
      stdio: "inherit",
      env: process.env,
    });
    process.exit(realApiRes.status || 0);
  });
  req.on("error", () => {
    console.log("\n(Notice: Dev server on localhost:3000 not active. To run live HTTP integration tests, start server and run 'npm run test:api')");
    process.exit(0);
  });
} else {
  process.exit(res.status || 1);
}
