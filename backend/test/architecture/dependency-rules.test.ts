import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const sourceRoot = new URL("../../src/", import.meta.url);

function importsUnder(relativeDirectory: string): Array<{ file: string; specifier: string }> {
  const directory = new URL(`${relativeDirectory}/`, sourceRoot);
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) => {
      const content = readFileSync(new URL(file, directory), "utf8");
      return [...content.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => ({
        file: `${relativeDirectory}/${file}`,
        specifier: match[1]!,
      }));
    });
}

function assertNoForbiddenImports(
  relativeDirectory: string,
  forbidden: RegExp,
): void {
  const violations = importsUnder(relativeDirectory)
    .filter(({ specifier }) => forbidden.test(specifier));
  assert.deepEqual(violations, []);
}

test("domain has no outward or runtime-framework dependencies", () => {
  assertNoForbiddenImports("domain", /(?:application|infrastructure|presentation|composition-root|express|^node:)/u);
});

test("application depends only on domain and application ports", () => {
  assertNoForbiddenImports("application", /(?:infrastructure|presentation|composition-root|express|^node:)/u);
});

test("infrastructure does not depend on HTTP presentation", () => {
  assertNoForbiddenImports("infrastructure", /(?:presentation|composition-root|express)/u);
});
