import { ExerciseMode, TabType } from "../models";
import type { Preset, Exercise } from "../models";
import { StepKind } from "./sessionEngine";
import type { SessionStep } from "./sessionEngine";

export function buildMobilitySteps(preset: Preset): SessionStep[] {
    // Mobility only
    if (preset.tabType === TabType.Workout) {
        return [{ id: crypto.randomUUID(), kind: StepKind.Completed, exerciseName: "", label: "Completed" }];
    }

    const betweenExercises = clampInt(preset.restBetweenExercisesSeconds, 0, 120);

    const out: SessionStep[] = [];

    for (let eIdx = 0; eIdx < preset.exercises.length; eIdx++) {
        const ex = preset.exercises[eIdx];

        const sets = clampInt(ex.sets, 1, 50);

        for (let set = 1; set <= sets; set++) {
            // optional setup before first set of this exercise
            if (set === 1 && ex.setupSeconds != null && ex.setupSeconds > 0) {
                out.push({
                    id: crypto.randomUUID(),
                    kind: StepKind.SetupTimer,
                    exerciseId: ex.id,
                    exerciseName: ex.name,
                    label: "Setup",
                    setIndex: set,
                    setCount: sets,
                    durationSeconds: clampInt(ex.setupSeconds, 1, 600),
                });
            }

            if (ex.perSide) {
                // left
                out.push(makeActive(ex, set, sets, "left"));

                const betweenSides = clampInt(ex.restSecondsBetweenSides, 0, 60);
                if (betweenSides > 0) {
                    out.push({
                        id: crypto.randomUUID(),
                        kind: StepKind.RestTimer,
                        exerciseId: ex.id,
                        exerciseName: ex.name,
                        label: "Rest (between sides)",
                        setIndex: set,
                        setCount: sets,
                        durationSeconds: betweenSides,
                    });
                }

                // right
                out.push(makeActive(ex, set, sets, "right"));
            } else {
                out.push(makeActive(ex, set, sets, undefined));
            }

            // rest between sets (within same exercise)
            if (set < sets) {
                const betweenSets = clampInt(ex.restSecondsBetweenSets, 0, 600);
                if (betweenSets > 0) {
                    out.push({
                        id: crypto.randomUUID(),
                        kind: StepKind.RestTimer,
                        exerciseId: ex.id,
                        exerciseName: ex.name,
                        label: "Rest (between sets)",
                        setIndex: set,
                        setCount: sets,
                        durationSeconds: betweenSets,
                    });
                }
            }
        }

        // rest between exercises
        if (eIdx < preset.exercises.length - 1 && betweenExercises > 0) {
            out.push({
                id: crypto.randomUUID(),
                kind: StepKind.RestTimer,
                exerciseName: "",
                label: "Rest (between exercises)",
                durationSeconds: betweenExercises,
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

function makeActive(ex: Exercise, setIndex: number, setCount: number, side?: "left" | "right"): SessionStep {
    const isTime = ex.mode === ExerciseMode.Time;

    return {
        id: crypto.randomUUID(),
        kind: isTime ? StepKind.TimedActive : StepKind.AwaitUserDone,
        exerciseId: ex.id,
        exerciseName: ex.name,
        label: mobilityActiveLabel(ex, setIndex, setCount, side),
        setIndex,
        setCount,
        side,
        durationSeconds: isTime ? clampInt(ex.durationSeconds, 1, 3600) : undefined,
    };
}

function mobilityActiveLabel(ex: Exercise, set: number, setCount: number, side?: "left" | "right") {
    const setPart = `Set ${set} of ${setCount}`;
    const sidePart = side ? ` (${side})` : "";
    if (ex.mode === ExerciseMode.Time) return `${setPart}${sidePart} — ${clampInt(ex.durationSeconds, 1, 3600)}s`;
    return `${setPart}${sidePart} — ${clampInt(ex.reps, 1, 500)} reps`;
}

function clampInt(v: any, min: number, max: number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}
