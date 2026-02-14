import { useEffect, useState } from "react";
import { TabType } from "../models";
import type { Exercise, WorkoutDayPlan, WorkoutDayEntry } from "../models";
import { WorkoutStore } from "../viewmodels/workoutStore";
import { useStoreSubscription } from "../viewmodels/useStore";
import { ExerciseEditor } from "./ExerciseEditor";

export function WorkoutEditor(props: {
    workoutId: string;
    tab: TabType;
    store: WorkoutStore;
    view?: "individual" | "plans";
    startInExerciseAdd?: boolean;
    onBack: () => void;
}) {
    const { workoutId, tab, store, view = "individual", startInExerciseAdd = false, onBack } = props;

    useStoreSubscription(store.subscribe.bind(store));

    const workout = store.getById(workoutId);
    const [name, setName] = useState(workout?.name ?? "");
    const [restBetween, setRestBetween] = useState(String(workout?.restBetweenExercisesSeconds ?? 25));
    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState("");
    const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
    const [repeatCountInput, setRepeatCountInput] = useState("1");
    const [dayPlansDraft, setDayPlansDraft] = useState<WorkoutDayPlan[]>([]);

    useEffect(() => {
        if (!workout) return;
        setName(workout.name);
        setRestBetween(String(workout.restBetweenExercisesSeconds));
        const repeatCount = clampRepeatCount(workout.repeatCount);
        setRepeatCountInput(String(repeatCount));
        setDayPlansDraft(buildDayPlansFromWorkout(workout.exercises, repeatCount, workout.dayPlans));
    }, [workout]);

    useEffect(() => {
        if (view !== "individual") return;
        if (!startInExerciseAdd) return;
        setIsCreatingExercise(true);
    }, [startInExerciseAdd, view]);

    if (!workout) {
        return (
            <div>
                <button type="button" onClick={onBack}>Back</button>
                <div style={{ marginTop: 12 }}>Workout not found.</div>
            </div>
        );
    }

    if (view === "individual" && editingExerciseId) {
        const ex = workout.exercises.find((e) => e.id === editingExerciseId);
        return (
            <ExerciseEditor
                tab={tab}
                exercise={ex ?? null}
                onBack={() => setEditingExerciseId(null)}
                onSave={async (updated) => {
                    await store.updateExercise(workout.id, updated);
                    setEditingExerciseId(null);
                }}
            />
        );
    }

    const updateDayEntry = (day: number, exerciseId: string, patch: Partial<WorkoutDayEntry>) => {
        setDayPlansDraft((current) =>
            current.map((plan) =>
                plan.day === day
                    ? {
                        day: plan.day,
                        entries: plan.entries.map((entry) =>
                            entry.exerciseId === exerciseId ? { ...entry, ...patch } : entry
                        ),
                    }
                    : plan
            )
        );
    };

    const buildTable = () => {
        const repeatCount = clampRepeatCount(repeatCountInput);
        setRepeatCountInput(String(repeatCount));
        setDayPlansDraft(buildDayPlansFromWorkout(workout.exercises, repeatCount, dayPlansDraft));
    };

    const saveTable = async () => {
        const repeatCount = clampRepeatCount(repeatCountInput);
        const normalized = buildDayPlansFromWorkout(workout.exercises, repeatCount, dayPlansDraft);
        setRepeatCountInput(String(repeatCount));
        setDayPlansDraft(normalized);
        await store.updateWorkoutProgramming(workout.id, repeatCount, normalized);
    };

    return (
        <div>
            <button type="button" onClick={onBack}>Back</button>

            <h2 style={{ marginTop: 12 }}>
                {view === "plans" ? "Workout Plans" : "Edit Workout"}
            </h2>

            {view === "individual" && (
                <>
                    <div style={{ border: "1px solid currentColor", padding: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <label>
                                Name{" "}
                                <input value={name} onChange={(e) => setName(e.target.value)} />
                            </label>
                            <button type="button" onClick={() => store.rename(workout.id, name)}>
                                Save
                            </button>
                        </div>

                        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <label>
                                Rest between exercises{" "}
                                <input value={restBetween} inputMode="numeric" onChange={(e) => setRestBetween(e.target.value)} />
                            </label>
                            <button
                                type="button"
                                onClick={() => store.setRestBetweenExercises(workout.id, Number(restBetween))}
                            >
                                Save
                            </button>
                            <div style={{ fontSize: 12 }}>
                                Hint: set to 0 to disable auto-next exercise.
                            </div>
                        </div>
                    </div>

                    <h3>Exercises (ordered)</h3>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {!isCreatingExercise ? (
                            <button type="button" onClick={() => setIsCreatingExercise(true)}>
                                Add
                            </button>
                        ) : (
                            <>
                                <input
                                    value={newExerciseName}
                                    onChange={(e) => setNewExerciseName(e.target.value)}
                                    placeholder="New exercise name"
                                />
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const createdExerciseId = await store.addExercise(workout.id, newExerciseName);
                                        if (!createdExerciseId) return;
                                        setNewExerciseName("");
                                        setIsCreatingExercise(false);
                                        setEditingExerciseId(createdExerciseId);
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewExerciseName("");
                                        setIsCreatingExercise(false);
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>

                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        {workout.exercises.length === 0 ? (
                            <div>No exercises yet.</div>
                        ) : (
                            workout.exercises.map((ex, idx) => (
                                <ExerciseRow
                                    key={ex.id}
                                    ex={ex}
                                    idx={idx}
                                    count={workout.exercises.length}
                                    onEdit={() => setEditingExerciseId(ex.id)}
                                    onDelete={() => store.removeExercise(workout.id, ex.id)}
                                    onDuplicate={() => store.duplicateExercise(workout.id, ex.id)}
                                    onMoveUp={() => store.moveExercise(workout.id, ex.id, -1)}
                                    onMoveDown={() => store.moveExercise(workout.id, ex.id, 1)}
                                />
                            ))
                        )}
                    </div>
                </>
            )}

            {view === "plans" && (
                <>
                    <div style={{ border: "1px solid currentColor", padding: 12, marginTop: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <label>
                                Plan name{" "}
                                <input value={name} onChange={(e) => setName(e.target.value)} />
                            </label>
                            <button type="button" onClick={() => store.rename(workout.id, name)}>
                                Save
                            </button>
                        </div>
                    </div>

                    <details style={{ marginTop: 12 }} open>
                        <summary>Workout days</summary>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <label>
                            Repeat days (max 4){" "}
                            <input
                                inputMode="numeric"
                                value={repeatCountInput}
                                onChange={(e) => setRepeatCountInput(e.target.value)}
                            />
                        </label>
                        <button type="button" onClick={buildTable}>Build table</button>
                        <button type="button" onClick={saveTable}>Save days</button>
                    </div>

                    {dayPlansDraft.length === 0 ? (
                        <div style={{ marginTop: 8 }}>Build a table to plan each workout day.</div>
                    ) : (
                        dayPlansDraft.map((plan) => (
                            <details key={plan.day} style={{ marginTop: 8 }}>
                                <summary>Workout day {plan.day}</summary>
                                <div style={{ marginTop: 8, overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: "left", padding: 4 }}>Exercise name</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Warm-up sets</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Working sets</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Reps</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Intensity</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Weight</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Tempo</th>
                                                <th style={{ textAlign: "left", padding: 4 }}>Rest</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {workout.exercises.map((exercise) => {
                                                const entry =
                                                    plan.entries.find((e) => e.exerciseId === exercise.id)
                                                    ?? createDefaultDayEntry(exercise);
                                                return (
                                                    <tr key={`${plan.day}-${exercise.id}`}>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                value={entry.exerciseName}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        exerciseName: e.target.value,
                                                                    })
                                                                }
                                                                style={{ width: 180 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                inputMode="numeric"
                                                                value={String(entry.warmupSets)}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        warmupSets: clampInt(e.target.value, 0, 20),
                                                                    })
                                                                }
                                                                style={{ width: 70 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                inputMode="numeric"
                                                                value={String(entry.sets)}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        sets: clampInt(e.target.value, 1, 70),
                                                                    })
                                                                }
                                                                style={{ width: 60 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                inputMode="numeric"
                                                                value={String(entry.reps)}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        reps: clampInt(e.target.value, 1, 500),
                                                                    })
                                                                }
                                                                style={{ width: 60 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                value={entry.intensity}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        intensity: e.target.value,
                                                                    })
                                                                }
                                                                style={{ width: 100 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                value={entry.weight}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        weight: e.target.value,
                                                                    })
                                                                }
                                                                style={{ width: 100 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                value={entry.tempo}
                                                                onChange={(e) =>
                                                                    updateDayEntry(plan.day, exercise.id, {
                                                                        tempo: e.target.value,
                                                                    })
                                                                }
                                                                placeholder="x or 3.1.1"
                                                                style={{ width: 90 }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: 4 }}>
                                                            <input
                                                                inputMode="numeric"
                                                                value={String(entry.restSeconds)}
                                                                onChange={(e) =>
                                                                updateDayEntry(plan.day, exercise.id, {
                                                                        workingRestSeconds: clampInt(e.target.value, 0, 3600),
                                                                        restSeconds: clampInt(e.target.value, 0, 3600),
                                                                    })
                                                                }
                                                                style={{ width: 70 }}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ))
                    )}
                    </details>
                </>
            )}
        </div>
    );
}

function clampRepeatCount(v: unknown): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(4, n));
}

function clampInt(v: unknown, min: number, max: number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function normalizeTempo(v: string): string {
    const t = String(v ?? "").trim().toLowerCase();
    if (t === "x") return "x";
    if (/^\d+\.\d+\.\d+$/.test(t)) return t;
    return "x";
}

function createDefaultDayEntry(exercise: Exercise): WorkoutDayEntry {
    const sets = Math.max(1, exercise.workingSets || exercise.sets);
    return {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        warmupSets: Math.max(0, exercise.warmupSets),
        sets,
        reps: Math.max(1, exercise.reps),
        intensity: exercise.intensity ?? "",
        weight: exercise.weight ?? "",
        tempo: normalizeTempo(exercise.tempo),
        warmupRestSeconds: Math.max(0, exercise.restSecondsBetweenSets),
        workingRestSeconds: Math.max(0, exercise.restSecondsBetweenSides),
        restSeconds: Math.max(0, exercise.restSecondsBetweenSides),
    };
}

function buildDayPlansFromWorkout(
    exercises: Exercise[],
    repeatCount: number,
    sourcePlans: WorkoutDayPlan[]
): WorkoutDayPlan[] {
    const byDay = new Map(sourcePlans.map((plan) => [plan.day, plan] as const));
    const out: WorkoutDayPlan[] = [];

    for (let day = 1; day <= repeatCount; day++) {
        const sourcePlan = byDay.get(day);
        const sourceEntries = new Map(
            (sourcePlan?.entries ?? []).map((entry) => [entry.exerciseId, entry] as const)
        );
        const entries = exercises.map((exercise) => {
            const sourceEntry = sourceEntries.get(exercise.id);
            if (!sourceEntry) return createDefaultDayEntry(exercise);
            return {
                ...sourceEntry,
                exerciseName: String(sourceEntry.exerciseName ?? exercise.name ?? "").trim() || "Exercise",
                warmupSets: clampInt(sourceEntry.warmupSets, 0, 20),
                sets: clampInt(sourceEntry.sets, 1, 70),
                reps: clampInt(sourceEntry.reps, 1, 500),
                intensity: String(sourceEntry.intensity ?? "").trim(),
                weight: String(sourceEntry.weight ?? "").trim(),
                tempo: normalizeTempo(sourceEntry.tempo),
                warmupRestSeconds: clampInt(sourceEntry.warmupRestSeconds, 0, 3600),
                workingRestSeconds: clampInt(sourceEntry.workingRestSeconds, 0, 3600),
                restSeconds: clampInt(sourceEntry.restSeconds, 0, 3600),
            };
        });
        out.push({ day, entries });
    }

    return out;
}

function ExerciseRow(props: {
    ex: Exercise;
    idx: number;
    count: number;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const { ex, idx, count, onEdit, onDelete, onDuplicate, onMoveUp, onMoveDown } = props;

    return (
        <div style={{ border: "1px solid currentColor", padding: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{idx + 1}. {ex.name}</strong>
                <button type="button" onClick={onEdit}>Edit</button>
                <button type="button" onClick={onDuplicate}>Duplicate</button>
                <button type="button" onClick={onDelete}>Delete</button>
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={onMoveUp} disabled={idx === 0}>Up</button>
                <button type="button" onClick={onMoveDown} disabled={idx === count - 1}>Down</button>
            </div>
        </div>
    );
}
