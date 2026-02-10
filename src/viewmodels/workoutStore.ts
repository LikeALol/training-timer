import { idbGet, idbSet } from "../persistence/idb";
import { TabType } from "../models";
import type { Workout, Exercise } from "../models";
import { ExerciseMode as ExerciseModeValue } from "../models";

type Listener = () => void;

const WORKOUTS_KEY = "presets.v2";

// Keep legacy key names for backward compatibility.

const WORKOUTS_BACKUP_KEY = "presets.backup.v2";

function backupWrite(workouts: Workout[]) {
    try {
        localStorage.setItem(WORKOUTS_BACKUP_KEY, JSON.stringify(workouts));
    } catch {}
}

function backupRead(): Workout[] | null {
    try {
        const raw = localStorage.getItem(WORKOUTS_BACKUP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeWorkout) : null;
    } catch {
        return null;
    }
}

export class WorkoutStore {
    private workouts: Workout[] = [];
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
            data = await idbGet<any>(WORKOUTS_KEY);
        } catch {
            data = undefined;
        }

        if (Array.isArray(data)) {
            this.workouts = data.map(normalizeWorkout);
        } else {
            const backup = backupRead();
            if (backup) {
                this.workouts = backup;
            } else {
                // attempt migration from v1 if present
                let v1: any = undefined;
                try {
                    v1 = await idbGet<any>("presets.v1");
                } catch {
                    v1 = undefined;
                }

                if (Array.isArray(v1)) {
                    this.workouts = v1.map((p: any) => normalizeWorkout({ ...p, exercises: [] }));
                } else {
                    this.workouts = [];
                }
            }

            // persist into v2 store when we had to fall back
            try {
                await idbSet(WORKOUTS_KEY, this.workouts);
            } catch {}
            backupWrite(this.workouts);
        }

        this.loaded = true;
        this.emit();
    }

    list(tab: TabType): Workout[] {
        return this.workouts
            .filter((p) => p.tabType === tab)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getById(id: string): Workout | undefined {
        return this.workouts.find((p) => p.id === id);
    }

    exportAllByTab(): Record<string, Workout[]> {
        return {
            [TabType.PreMobility]: this.workouts.filter((p) => p.tabType === TabType.PreMobility).map(normalizeWorkout),
            [TabType.Workout]: this.workouts.filter((p) => p.tabType === TabType.Workout).map(normalizeWorkout),
            [TabType.PostMobility]: this.workouts.filter((p) => p.tabType === TabType.PostMobility).map(normalizeWorkout),
        };
    }

    async importAllByTab(byTab: Record<string, Workout[]>): Promise<void> {
        const next: Workout[] = [];

        for (const tab of [TabType.PreMobility, TabType.Workout, TabType.PostMobility] as const) {
            const arr = byTab[tab];
            if (!Array.isArray(arr)) continue;

            for (const raw of arr) {
                next.push(normalizeWorkout({ ...raw, tabType: tab }));
            }
        }

        this.workouts = next;
        this.loaded = true;
        await this.save();
    }

    async duplicateWorkout(workoutId: string): Promise<string | null> {
        const src = this.getById(workoutId);
        if (!src) return null;

        const copyId = crypto.randomUUID();

        const copy: Workout = normalizeWorkout({
            ...src,
            id: copyId,
            name: `${src.name} (copy)`,
            exercises: src.exercises.map((ex) => ({
                ...ex,
                id: crypto.randomUUID(),
                name: ex.name,
            })),
        });

        const idx = this.workouts.findIndex((p) => p.id === workoutId);
        if (idx >= 0) {
            const next = this.workouts.slice();
            next.splice(idx + 1, 0, copy);
            this.workouts = next;
        } else {
            this.workouts = [...this.workouts, copy];
        }

        await this.save();
        return copyId;
    }

    async duplicateExercise(workoutId: string, exerciseId: string): Promise<string | null> {
        const workout = this.getById(workoutId);
        if (!workout) return null;

        const idx = workout.exercises.findIndex((e) => e.id === exerciseId);
        if (idx < 0) return null;

        const src = workout.exercises[idx];
        const copyId = crypto.randomUUID();

        const copy: Exercise = normalizeExercise({
            ...src,
            id: copyId,
            name: `${src.name} (copy)`,
        });

        const nextExercises = workout.exercises.slice();
        nextExercises.splice(idx + 1, 0, copy);

        await this.updateWorkout(workoutId, { exercises: nextExercises });
        return copyId;
    }


    async create(tab: TabType, name: string): Promise<void> {
        const trimmed = name.trim();
        if (!trimmed) return;

        const workout: Workout = {
            id: crypto.randomUUID(),
            name: trimmed,
            tabType: tab,
            restBetweenExercisesSeconds: 25,
            exercises: [],
        };

        this.workouts = [...this.workouts, workout];
        await this.save();
    }

    async rename(id: string, name: string): Promise<void> {
        const trimmed = name.trim();
        if (!trimmed) return;

        this.workouts = this.workouts.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        await this.save();
    }

    async remove(id: string): Promise<void> {
        this.workouts = this.workouts.filter((p) => p.id !== id);
        await this.save();
    }

    async setRestBetweenExercises(id: string, seconds: number): Promise<void> {
        const v = clampInt(seconds, 0, 120);
        this.workouts = this.workouts.map((p) =>
            p.id === id ? { ...p, restBetweenExercisesSeconds: v } : p
        );
        await this.save();
    }

    // Backward-compatible alias.
    async setMobilityRestBetweenExercises(id: string, seconds: number): Promise<void> {
        await this.setRestBetweenExercises(id, seconds);
    }

    // -------- Exercises (ordered) --------

    async addExercise(workoutId: string, name: string): Promise<void> {
        const workout = this.getById(workoutId);
        if (!workout) return;

        const trimmed = name.trim();
        if (!trimmed) return;

        const ex: Exercise = {
            id: crypto.randomUUID(),
            name: trimmed,
            mode: ExerciseModeValue.Reps,
            durationSeconds: 30,
            reps: 10,
            sets: 1,
            perSide: false,
            setupSeconds: undefined,
            restSecondsBetweenSets: 20,
            restSecondsBetweenSides: 10,
            warmupSets: workout.tabType === TabType.Workout ? 2 : 0,
            workingSets: workout.tabType === TabType.Workout ? 3 : 0,
        };

        await this.updateWorkout(workoutId, {
            exercises: [...workout.exercises, ex],
        });
    }

    async removeExercise(workoutId: string, exerciseId: string): Promise<void> {
        const workout = this.getById(workoutId);
        if (!workout) return;

        await this.updateWorkout(workoutId, {
            exercises: workout.exercises.filter((e) => e.id !== exerciseId),
        });
    }

    async moveExercise(workoutId: string, exerciseId: string, dir: -1 | 1): Promise<void> {
        const workout = this.getById(workoutId);
        if (!workout) return;

        const idx = workout.exercises.findIndex((e) => e.id === exerciseId);
        if (idx < 0) return;

        const next = idx + dir;
        if (next < 0 || next >= workout.exercises.length) return;

        const copy = workout.exercises.slice();
        const [item] = copy.splice(idx, 1);
        copy.splice(next, 0, item);

        await this.updateWorkout(workoutId, { exercises: copy });
    }

    async updateExercise(workoutId: string, exercise: Exercise): Promise<void> {
        const workout = this.getById(workoutId);
        if (!workout) return;

        const copy = workout.exercises.map((e) => (e.id === exercise.id ? normalizeExercise(exercise) : e));
        await this.updateWorkout(workoutId, { exercises: copy });
    }

    // -------- internal helpers --------

    private async updateWorkout(id: string, patch: Partial<Workout>): Promise<void> {
        this.workouts = this.workouts.map((p) => (p.id === id ? normalizeWorkout({ ...p, ...patch }) : p));
        await this.save();
    }

    private async save(): Promise<void> {
        try {
            await idbSet(WORKOUTS_KEY, this.workouts);
        } catch {
            // IndexedDB may be blocked; still keep localStorage backup
        }
        backupWrite(this.workouts);
        this.emit();
    }

}

function normalizeWorkout(p: any): Workout {
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
