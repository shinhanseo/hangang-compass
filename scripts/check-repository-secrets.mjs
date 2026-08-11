import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
  .toString("utf8")
  .split("\0")
  .filter((file) => file && existsSync(file));
const forbiddenFiles = trackedFiles.filter((file) => /^\.env(?:\.|$)/u.test(file) && file !== ".env.example");
const patterns = [
  { name: "configured_api_key", expression: /^(?:SEOUL_DATA_API_KEY|KAKAO_REST_API_KEY)=\S+/gmu },
  { name: "literal_kakao_authorization", expression: /KakaoAK\s+[A-Za-z0-9_-]{16,}/gu },
  { name: "private_key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu },
];
const matches = [];

for (const file of trackedFiles) {
  const content = readFileSync(file).toString("utf8");
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) matches.push({ file, pattern: pattern.name });
    pattern.expression.lastIndex = 0;
  }
}

const ok = forbiddenFiles.length === 0 && matches.length === 0;
console.log(JSON.stringify({
  check: "repository_secret_scan",
  ok,
  trackedFileCount: trackedFiles.length,
  forbiddenFiles,
  matches,
}));
if (!ok) process.exitCode = 1;
