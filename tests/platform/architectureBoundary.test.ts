import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "lib");
const domainRoots = ["gen", "sim"];
const forbidden = /(?:from\s+|import\s*\(\s*)["'](?:react|react-dom|next(?:\/[^"']*)?|@\/components(?:\/[^"']*)?)["']|\b(?:window|document|navigator|localStorage|sessionStorage|HTMLCanvasElement|CanvasRenderingContext2D|AudioContext|ImageData)\b/;

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

describe("domain architecture boundary", () => {
  it("keeps generation and simulation independent from browser and UI modules", () => {
    const violations = domainRoots.flatMap((domainRoot) => sourceFiles(join(root, domainRoot))
      .filter((path) => forbidden.test(readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")))
      .map((path) => relative(process.cwd(), path)));

    expect(violations).toEqual([]);
  });
});
