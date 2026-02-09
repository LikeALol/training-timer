// src/io/presetIO.ts
import type { Preset } from "../models";
import { TabType } from "../models";

export type PresetsExportV1 = {
    version: 1;
    exportedAt: string;
    byTab: Record<string, Preset[]>;
};

function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function exportPresetsAsJson(byTab: Record<string, Preset[]>) {
    const payload: PresetsExportV1 = {
        version: 1,
        exportedAt: new Date().toISOString(),
        byTab,
    };

    const json = JSON.stringify(payload, null, 2);
    downloadBlob("presets.json", new Blob([json], { type: "application/json" }));
}

export async function importPresetsFromJsonFile(file: File): Promise<Record<string, Preset[]>> {
    const text = await file.text();

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("Invalid JSON file.");
    }

    if (parsed && typeof parsed === "object") {
        const obj = parsed as any;

        if (obj.version === 1 && obj.byTab && typeof obj.byTab === "object") {
            const out: Record<string, Preset[]> = {};
            for (const key of [TabType.PreMobility, TabType.Workout, TabType.PostMobility]) {
                const v = obj.byTab[key];
                out[key] = Array.isArray(v) ? (v as Preset[]) : [];
            }
            return out;
        }

        // legacy: { version:1, presets:[...] } -> put into workout by default
        if (obj.version === 1 && Array.isArray(obj.presets)) {
            return { [TabType.Workout]: obj.presets as Preset[] };
        }
    }

    // legacy: [...] -> put into workout by default
    if (Array.isArray(parsed)) {
        return { [TabType.Workout]: parsed as Preset[] };
    }

    throw new Error("JSON format not recognized.");
}
