import { ExerciseMode } from "../models";
import type { Exercise } from "../models";
import { StepKind } from "./sessionEngine";
import type { SessionStep } from "./sessionEngine";

export function validateWorkoutExercise(ex: Exercise): string | null {
    const reps = clampInt(ex.reps, 0, 500);
    const durationSeconds = clampInt(ex.durationSeconds, 0, 3600);
    const { warmups, working } = resolveWorkoutSetCounts(ex);

    if (ex.mode === ExerciseMode.Time) {
        if (durationSeconds < 1) return "Duration must be at least 1 second.";
    } else if (reps < 1) {
        return "Reps must be at least 1.";
    }
    if (warmups + working < 1) return "Warm-up sets + working sets must be at least 1.";

    return null;
}

export function buildWorkoutStepsForExercise(ex: Exercise): SessionStep[] {
    const err = validateWorkoutExercise(ex);
    if (err) {
        return [
            {
                id: crypto.randomUUID(),
                kind: StepKind.Completed,
                exerciseName: ex.name,
                label: err,
            },
        ];
    }

    const out: SessionStep[] = [];

    const setup = ex.setupSeconds ?? 0;
    if (setup > 0) {
        out.push({
            id: crypto.randomUUID(),
            kind: StepKind.SetupTimer,
            exerciseId: ex.id,
            exerciseName: ex.name,
            label: "Setup",
            durationSeconds: clampInt(setup, 1, 600),
        });
    }

    const { warmups, working } = resolveWorkoutSetCounts(ex);
    const reps = clampInt(ex.reps, 1, 500);
    const durationSeconds = clampInt(ex.durationSeconds, 1, 3600);
    const isTimeMode = ex.mode === ExerciseMode.Time;
    const intensity = ex.intensity?.trim() || "-";
    const load = ex.weight?.trim() || "-";
    const tempo = ex.tempo?.trim() || "x";

    const total = warmups + working;

    for (let i = 1; i <= total; i++) {
        const isWarmup = i <= warmups;

        const phaseIndex = isWarmup ? i : i - warmups;
        const phaseCount = isWarmup ? warmups : working;

        out.push({
            id: crypto.randomUUID(),
            kind: isTimeMode ? StepKind.TimedActive : StepKind.AwaitUserDone,
            exerciseId: ex.id,
            exerciseName: ex.name,
            label: isWarmup
                ? (isTimeMode
                    ? `Warm-up - Set ${phaseIndex}/${phaseCount} - ${durationSeconds}s`
                    : `Warm-up - Set ${phaseIndex}/${phaseCount} - ${reps} Reps`)
                : (isTimeMode
                    ? `Working - Set ${phaseIndex}/${phaseCount} - ${durationSeconds}s\nInt.: ${intensity} Load: ${load} Tempo: ${tempo}`
                    : `Working - Set ${phaseIndex}/${phaseCount} - ${reps} Reps\nInt.: ${intensity} Load: ${load} Tempo: ${tempo}`),
            durationSeconds: isTimeMode ? durationSeconds : undefined,
        });

        // No rest after last set
        if (i === total) break;

        // Convention:
        // warm-up rest = restSecondsBetweenSets
        // working rest = restSecondsBetweenSides
        const restSeconds = isTimeMode
            ? clampInt(ex.restSecondsBetweenSets, 0, 3600)
            : isWarmup
              ? clampInt(ex.restSecondsBetweenSets, 0, 3600)
              : clampInt(ex.restSecondsBetweenSides, 0, 3600);

        if (restSeconds > 0) {
            const isLastWarmupRest = warmups > 0 && working > 0 && i === warmups;
            const upNextTempo = ex.tempo?.trim() ? ex.tempo.trim() : "x";
            const upNextWeight = ex.weight?.trim() ? `${ex.weight.trim()} Kg` : "-";
            const restLabel = isLastWarmupRest
                ? `Rest (working). Up next: ${upNextWeight}, Tempo: ${upNextTempo}, Reps: ${reps}`
                : isWarmup
                  ? "Rest (warm-up)"
                  : "Rest (working)";
            out.push({
                id: crypto.randomUUID(),
                kind: StepKind.RestTimer,
                exerciseId: ex.id,
                exerciseName: ex.name,
                label: restLabel,
                durationSeconds: restSeconds,
            });
        }
    }

    out.push({
        id: crypto.randomUUID(),
        kind: StepKind.Completed,
        exerciseName: "",
        label: "Completed",
    });

    return out;
}

function clampInt(v: any, min: number, max: number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function resolveWorkoutSetCounts(ex: Exercise): {
    warmups: number;
    working: number;
} {
    const warmups = clampInt(ex.warmupSets, 0, 20);
    const working = clampInt(ex.workingSets, 0, 50);
    return { warmups, working };
}
