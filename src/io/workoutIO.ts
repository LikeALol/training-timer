// src/io/workoutIO.ts
import type { Workout } from "../models";
import { TabType } from "../models";

export type WorkoutsExportV1 = {
    version: 1;
    exportedAt: string;
    byTab: Record<string, Workout[]>;
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

export function exportWorkoutsAsJson(byTab: Record<string, Workout[]>) {
    const payload: WorkoutsExportV1 = {
        version: 1,
        exportedAt: new Date().toISOString(),
        byTab,
    };

    const json = JSON.stringify(payload, null, 2);
    downloadBlob("workouts.json", new Blob([json], { type: "application/json" }));
}

export async function importWorkoutsFromJsonFile(file: File): Promise<Record<string, Workout[]>> {
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
            const out: Record<string, Workout[]> = {};
            for (const key of [TabType.PreMobility, TabType.Workout, TabType.PostMobility]) {
                const v = obj.byTab[key];
                out[key] = Array.isArray(v) ? (v as Workout[]) : [];
            }
            return out;
        }

        // legacy: { version:1, presets:[...] } -> put into workout by default
        if (obj.version === 1 && Array.isArray(obj.presets)) {
            return { [TabType.Workout]: obj.presets as Workout[] };
        }
    }

    // legacy: [...] -> put into workout by default
    if (Array.isArray(parsed)) {
        return { [TabType.Workout]: parsed as Workout[] };
    }

    throw new Error("JSON format not recognized.");
}
