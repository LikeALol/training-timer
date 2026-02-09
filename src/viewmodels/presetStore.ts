import { idbGet, idbSet } from "../persistence/idb";
import { TabType } from "../models";
import type { Preset, Exercise } from "../models";
import { ExerciseMode as ExerciseModeValue } from "../models";

type Listener = () => void;

const PRESETS_KEY = "presets.v2";

const PRESETS_BACKUP_KEY = "presets.backup.v2";

function backupWrite(presets: Preset[]) {
    try {
        localStorage.setItem(PRESETS_BACKUP_KEY, JSON.stringify(presets));
    } catch {}
}

function backupRead(): Preset[] | null {
    try {
        const raw = localStorage.getItem(PRESETS_BACKUP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizePreset) : null;
    } catch {
        return null;
    }
}

export class PresetStore {
    private presets: Preset[] = [];
    private loaded = false;
    private listeners = new Set<Listener>();

    subscribe(fn: Listener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private emit() {
        for (const fn of this.listeners) fn();
    }

    async ensureLoaded(): Promise<void> {
        if (this.loaded) return;

        let data: any = undefined;
        try {
            data = await idbGet<any>(PRESETS_KEY);
        } catch {
            data = undefined;
        }

        if (Array.isArray(data)) {
            this.presets = data.map(normalizePreset);
        } else {
            const backup = backupRead();
            if (backup) {
                this.presets = backup;
            } else {
                // attempt migration from v1 if present
                let v1: any = undefined;
                try {
                    v1 = await idbGet<any>("presets.v1");
                } catch {
                    v1 = undefined;
                }

                if (Array.isArray(v1)) {
                    this.presets = v1.map((p: any) => normalizePreset({ ...p, exercises: [] }));
                } else {
                    this.presets = [];
                }
            }

            // persist into v2 store when we had to fall back
            try {
                await idbSet(PRESETS_KEY, this.presets);
            } catch {}
            backupWrite(this.presets);
        }

        this.loaded = true;
        this.emit();
    }

    list(tab: TabType): Preset[] {
        return this.presets
            .filter((p) => p.tabType === tab)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getById(id: string): Preset | undefined {
        return this.presets.find((p) => p.id === id);
    }

    async create(tab: TabType, name: string): Promise<void> {
        const trimmed = name.trim();
        if (!trimmed) return;

        const preset: Preset = {
            id: crypto.randomUUID(),
            name: trimmed,
            tabType: tab,
            restBetweenExercisesSeconds: 25,
            exercises: [],
        };

        this.presets = [...this.presets, preset];
        await this.save();
    }

    async rename(id: string, name: string): Promise<void> {
        const trimmed = name.trim();
        if (!trimmed) return;

        this.presets = this.presets.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        await this.save();
    }

    async remove(id: string): Promise<void> {
        this.presets = this.presets.filter((p) => p.id !== id);
        await this.save();
    }

    async setMobilityRestBetweenExercises(id: string, seconds: number): Promise<void> {
        const v = clampInt(seconds, 0, 120);
        this.presets = this.presets.map((p) =>
            p.id === id ? { ...p, restBetweenExercisesSeconds: v } : p
        );
        await this.save();
    }

    // -------- Exercises (ordered) --------

    async addExercise(presetId: string, name: string): Promise<void> {
        const preset = this.getById(presetId);
        if (!preset) return;

        const trimmed = name.trim();
        if (!trimmed) return;

        const ex: Exercise = {
            id: crypto.randomUUID(),
            name: trimmed,
            mode: ExerciseModeValue.Time,
            durationSeconds: 30,
            reps: 10,
            sets: 1,
            perSide: false,
            setupSeconds: undefined,
            restSecondsBetweenSets: 20,
            restSecondsBetweenSides: 10,
            warmupSets: preset.tabType === TabType.Workout ? 2 : 0,
            workingSets: preset.tabType === TabType.Workout ? 3 : 0,
        };

        await this.updatePreset(presetId, {
            exercises: [...preset.exercises, ex],
        });
    }

    async removeExercise(presetId: string, exerciseId: string): Promise<void> {
        const preset = this.getById(presetId);
        if (!preset) return;

        await this.updatePreset(presetId, {
            exercises: preset.exercises.filter((e) => e.id !== exerciseId),
        });
    }

    async moveExercise(presetId: string, exerciseId: string, dir: -1 | 1): Promise<void> {
        const preset = this.getById(presetId);
        if (!preset) return;

        const idx = preset.exercises.findIndex((e) => e.id === exerciseId);
        if (idx < 0) return;

        const next = idx + dir;
        if (next < 0 || next >= preset.exercises.length) return;

        const copy = preset.exercises.slice();
        const [item] = copy.splice(idx, 1);
        copy.splice(next, 0, item);

        await this.updatePreset(presetId, { exercises: copy });
    }

    async updateExercise(presetId: string, exercise: Exercise): Promise<void> {
        const preset = this.getById(presetId);
        if (!preset) return;

        const copy = preset.exercises.map((e) => (e.id === exercise.id ? normalizeExercise(exercise) : e));
        await this.updatePreset(presetId, { exercises: copy });
    }

    // -------- internal helpers --------

    private async updatePreset(id: string, patch: Partial<Preset>): Promise<void> {
        this.presets = this.presets.map((p) => (p.id === id ? normalizePreset({ ...p, ...patch }) : p));
        await this.save();
    }

    private async save(): Promise<void> {
        try {
            await idbSet(PRESETS_KEY, this.presets);
        } catch {
            // IndexedDB may be blocked; still keep localStorage backup
        }
        backupWrite(this.presets);
        this.emit();
    }

}

function normalizePreset(p: any): Preset {
    return {
        id: String(p.id ?? crypto.randomUUID()),
        name: String(p.name ?? "Untitled"),
        tabType: (p.tabType === TabType.Workout || p.tabType === TabType.PostMobility) ? p.tabType : TabType.PreMobility,
        restBetweenExercisesSeconds: clampInt(p.restBetweenExercisesSeconds ?? 25, 0, 120),
        exercises: Array.isArray(p.exercises) ? p.exercises.map(normalizeExercise) : [],
    };
}

function normalizeExercise(e: any): Exercise {
    const mode = e?.mode === ExerciseModeValue.Reps ? ExerciseModeValue.Reps : ExerciseModeValue.Time;

    return {
        id: String(e?.id ?? crypto.randomUUID()),
        name: String(e?.name ?? "Exercise"),
        mode,
        durationSeconds: clampInt(e?.durationSeconds ?? 30, 1, 3600),
        reps: clampInt(e?.reps ?? 10, 1, 500),
        sets: clampInt(e?.sets ?? 1, 1, 50),
        perSide: Boolean(e?.perSide ?? false),
        setupSeconds: e?.setupSeconds == null ? undefined : clampInt(e.setupSeconds, 1, 600),
        restSecondsBetweenSets: clampInt(e?.restSecondsBetweenSets ?? 20, 0, 3600),
        restSecondsBetweenSides: clampInt(e?.restSecondsBetweenSides ?? 10, 0, 3600),
        warmupSets: clampInt(e?.warmupSets ?? 0, 0, 20),
        workingSets: clampInt(e?.workingSets ?? 0, 0, 50),
    };
}

function clampInt(v: any, min: number, max: number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}
