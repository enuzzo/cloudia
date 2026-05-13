import type { CloudiaPreset } from "./types";

const SUPPORTED_SCHEMA_VERSION = 1;

export function exportPresetJson(preset: CloudiaPreset): string {
  return `${JSON.stringify(preset, null, 2)}\n`;
}

export function importPresetJson(json: string): CloudiaPreset {
  const parsed = JSON.parse(json) as Partial<CloudiaPreset>;
  if (parsed.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`Unsupported Cloudia preset schema: ${String(parsed.schemaVersion)}`);
  }
  return parsed as CloudiaPreset;
}

export async function copyPresetJson(preset: CloudiaPreset): Promise<string> {
  const json = exportPresetJson(preset);
  await navigator.clipboard.writeText(json);
  return json;
}
