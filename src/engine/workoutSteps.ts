import type { Exercise } from "../models";
import { StepKind } from "./sessionEngine";
import type { SessionStep } from "./sessionEngine";

export function validateWorkoutExercise(ex: Exercise): string | null {
    const reps = clampInt(ex.reps, 0, 500);
    const warmups = clampInt(ex.warmupSets, 0, 20);
    const working = clampInt(ex.workingSets, 0, 50);

    if (reps < 1) return "Reps must be at least 1.";
    if (warmups + working < 1) return "Warm-up sets + working sets must be at least 1.";
    if (working < 1) return "Working sets must be at least 1.";

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

    const warmups = clampInt(ex.warmupSets, 0, 20);
    const working = clampInt(ex.workingSets, 0, 50);
    const reps = clampInt(ex.reps, 1, 500);

    const total = warmups + working;

    for (let i = 1; i <= total; i++) {
        const isWarmup = i <= warmups;

        const phase = isWarmup ? "Warm-up" : "Working";
        const phaseIndex = isWarmup ? i : i - warmups;
        const phaseCount = isWarmup ? warmups : working;

        out.push({
            id: crypto.randomUUID(),
            kind: StepKind.AwaitUserDone,
            exerciseId: ex.id,
            exerciseName: ex.name,
            label: `${phase} • Set ${phaseIndex}/${phaseCount} • ${reps} reps`,
        });

        // No rest after last set
        if (i === total) break;

        // Convention:
        // warm-up rest = restSecondsBetweenSets
        // working rest = restSecondsBetweenSides
        const restSeconds = isWarmup
            ? clampInt(ex.restSecondsBetweenSets, 0, 3600)
            : clampInt(ex.restSecondsBetweenSides, 0, 3600);

        if (restSeconds > 0) {
            out.push({
                id: crypto.randomUUID(),
                kind: StepKind.RestTimer,
                exerciseId: ex.id,
                exerciseName: ex.name,
                label: isWarmup ? "Rest (warm-up)" : "Rest (working)",
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
