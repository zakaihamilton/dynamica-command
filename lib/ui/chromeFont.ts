const FALLBACK_MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function readCssVar(name: string): string {
  if (typeof document === "undefined") return "";
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

function resolveFontToken(name: string, depth = 0): string {
  if (depth > 5) return "";
  const raw = readCssVar(name);
  if (!raw) return "";
  return raw.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]+|\([^()]*\))*))?\)/g,
    (_match, inner: string, fallback?: string) => {
      return resolveFontToken(inner, depth + 1) || fallback?.trim() || "";
    },
  );
}

export function chromeMonoFamily(): string {
  return resolveFontToken("--font-mono") || FALLBACK_MONO;
}

export function chromeMonoFont(sizePx: number, weight = 400): string {
  return `${weight} ${sizePx}px ${chromeMonoFamily()}`;
}
