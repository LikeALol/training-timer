import { useEffect, useState } from "react";
import { ExerciseMode, TabType } from "../models";
import type { Exercise } from "../models";

export function ExerciseEditor(props: {
    tab: TabType;
    exercise: Exercise | null;
    onBack: () => void;
    onSave: (e: Exercise) => void;
}) {
    const { tab, exercise, onBack, onSave } = props;

    const [draft, setDraft] = useState<Exercise | null>(exercise);

    useEffect(() => {
        setDraft(exercise);
    }, [exercise?.id]);

    if (!draft) {
        return (
            <div>
                <button type="button" onClick={onBack}>Back</button>
                <div style={{ marginTop: 12 }}>Exercise not found.</div>
            </div>
        );
    }

    const isWorkout = tab === TabType.Workout;

    return (
        <div>
            <button type="button" onClick={onBack}>Back</button>
            <h2 style={{ marginTop: 12 }}>Edit Exercise</h2>

            <div style={{ border: "1px solid currentColor", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <label>
                    Name{" "}
                    <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                </label>

                <label>
                    Mode{" "}
                    <select
                        value={draft.mode}
                        onChange={(e) => setDraft({ ...draft, mode: e.target.value as any })}
                    >
                        <option value={ExerciseMode.Time}>time</option>
                        <option value={ExerciseMode.Reps}>reps</option>
                    </select>
                </label>

                {draft.mode === ExerciseMode.Time ? (
                    <label>
                        Duration (s){" "}
                        <input
                            inputMode="numeric"
                            value={String(draft.durationSeconds)}
                            onChange={(e) => setDraft({ ...draft, durationSeconds: toInt(e.target.value, 1) })}
                        />
                    </label>
                ) : (
                    <label>
                        Reps{" "}
                        <input
                            inputMode="numeric"
                            value={String(draft.reps)}
                            onChange={(e) => setDraft({ ...draft, reps: toInt(e.target.value, 1) })}
                        />
                    </label>
                )}

                <label>
                    Sets{" "}
                    <input
                        inputMode="numeric"
                        value={String(draft.sets)}
                        onChange={(e) => setDraft({ ...draft, sets: toInt(e.target.value, 1) })}
                    />
                </label>

                <label>
                    <input
                        type="checkbox"
                        checked={draft.perSide}
                        onChange={(e) => setDraft({ ...draft, perSide: e.target.checked })}
                    />{" "}
                    Per side
                </label>

                <label>
                    Setup seconds (optional){" "}
                    <input
                        inputMode="numeric"
                        value={draft.setupSeconds == null ? "" : String(draft.setupSeconds)}
                        placeholder="(empty = none)"
                        onChange={(e) => {
                            const v = e.target.value.trim();
                            setDraft({ ...draft, setupSeconds: v === "" ? undefined : toInt(v, 1) });
                        }}
                    />
                </label>

                <label>
                    {isWorkout ? "Warm-up rest (s)" : "Rest between sets (s)"}{" "}
                    <input
                        inputMode="numeric"
                        value={String(draft.restSecondsBetweenSets)}
                        onChange={(e) => setDraft({ ...draft, restSecondsBetweenSets: toInt(e.target.value, 0) })}
                    />
                </label>

                {(isWorkout || draft.perSide) && (
                    <label>
                        {isWorkout ? "Working rest (s)" : "Rest between sides (s)"}{" "}
                        <input
                            inputMode="numeric"
                            value={String(draft.restSecondsBetweenSides)}
                            onChange={(e) => setDraft({ ...draft, restSecondsBetweenSides: toInt(e.target.value, 0) })}
                        />
                    </label>
                )}

                {isWorkout && (
                    <>
                        <label>
                            Warm-up sets{" "}
                            <input
                                inputMode="numeric"
                                value={String(draft.warmupSets)}
                                onChange={(e) => setDraft({ ...draft, warmupSets: toInt(e.target.value, 0) })}
                            />
                        </label>

                        <label>
                            Working sets{" "}
                            <input
                                inputMode="numeric"
                                value={String(draft.workingSets)}
                                onChange={(e) => setDraft({ ...draft, workingSets: toInt(e.target.value, 0) })}
                            />
                        </label>
                    </>
                )}

                <button type="button" onClick={() => onSave(sanitize(draft, isWorkout))}>
                    Save
                </button>
            </div>
        </div>
    );
}

function toInt(v: string, min: number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, n);
}

function sanitize(e: Exercise, isWorkout: boolean): Exercise {
    return {
        ...e,
        name: e.name.trim() || "Exercise",
        durationSeconds: Math.max(1, Math.floor(e.durationSeconds)),
        reps: Math.max(1, Math.floor(e.reps)),
        sets: Math.max(1, Math.floor(e.sets)),
        restSecondsBetweenSets: Math.max(0, Math.floor(e.restSecondsBetweenSets)),
        restSecondsBetweenSides: Math.max(0, Math.floor(e.restSecondsBetweenSides)),
        warmupSets: isWorkout ? Math.max(0, Math.floor(e.warmupSets)) : 0,
        workingSets: isWorkout ? Math.max(0, Math.floor(e.workingSets)) : 0,
        setupSeconds: e.setupSeconds == null ? undefined : Math.max(1, Math.floor(e.setupSeconds)),
    };
}
