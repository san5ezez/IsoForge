const BAD_ISO = /[^A-Z0-9_]/g;

function cleanToken(s: string, max: number, fallback: string): string {
  const t = s
    .toUpperCase()
    .replace(BAD_ISO, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
  return t || fallback;
}

export function iso9660Name(
  original: string,
  isDir: boolean,
  used: Set<string>,
): { stored: string; mangled: boolean } {
  const base = original.normalize("NFKC");
  let stem = base;
  let ext = "";
  if (!isDir) {
    const dot = base.lastIndexOf(".");
    if (dot > 0 && dot < base.length - 1) {
      stem = base.slice(0, dot);
      ext = base.slice(dot + 1);
    }
  }
  let stemC = cleanToken(stem, 8, isDir ? "DIR" : "FILE");
  const extC = isDir ? "" : ext ? cleanToken(ext, 3, "TXT") : "";
  let body = extC ? `${stemC}.${extC}` : stemC;
  let n = 1;
  const keyOf = (b: string) => (isDir ? b : `${b};1`);
  while (used.has(keyOf(body))) {
    const suffix = String(n++);
    stemC = cleanToken(stem, Math.max(1, 8 - suffix.length), "F").slice(0, 8 - suffix.length) + suffix;
    body = extC ? `${stemC}.${extC}` : stemC;
  }
  used.add(keyOf(body));
  const stored = isDir ? body : `${body};1`;
  const shown = isDir ? body : body;
  const mangled = shown !== base.toUpperCase();
  return { stored, mangled };
}

const BAD_JOLIET = /[\\/:*?";\u0000-\u001f]/g;

export function longName(
  original: string,
  max: number,
  used: Set<string>,
): { stored: string; mangled: boolean } {
  const base = original.normalize("NFC");
  let name = base.replace(BAD_JOLIET, "_").slice(0, max);
  if (!name) name = "file";
  let mangled = name !== base;
  let n = 1;
  while (used.has(name.toLocaleUpperCase("ru"))) {
    const suffix = `~${n++}`;
    const head = (base.replace(BAD_JOLIET, "_").slice(0, Math.max(1, max - suffix.length)) || "f");
    name = head + suffix;
    mangled = true;
  }
  used.add(name.toLocaleUpperCase("ru"));
  return { stored: name, mangled };
}
