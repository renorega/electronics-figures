import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "kit");
const strip = (file) => readFileSync(join(KIT, file), "utf8").replace(/^export /gm, "");

// The kit's MIT license must travel with every copy, including the copy inlined into each page.
const NOTICE = `/*\nIsometric drawing kit from Anatomy by Ryan (wheresryan): https://skills.wheresryan.sh/anatomy\n\n${readFileSync(join(KIT, "LICENSE"), "utf8").trim()}\n*/\n`;

export function kitScript() {
  return NOTICE + strip("iso-kit.mjs");
}

export function glScript() {
  return strip("gl.mjs");
}

export function turnScript() {
  return strip("turn.mjs");
}

export function fixedScript() {
  return strip("turn-fixed.mjs") + "\n" + strip("canvas-painter.mjs");
}

export function glSharedScript() {
  return strip("gl-shared.mjs");
}
