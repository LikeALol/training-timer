import { useEffect, useState } from "react";
import { TabType } from "../models";
import type { Exercise } from "../models";
import { WorkoutStore } from "../viewmodels/workoutStore";
import { useStoreSubscription } from "../viewmodels/useStore";
import { ExerciseEditor } from "./ExerciseEditor";

export function WorkoutEditor(props: {
    workoutId: string;
    tab: TabType;
    store: WorkoutStore;
    onBack: () => void;
}) {
    const { workoutId, tab, store, onBack } = props;

    useStoreSubscription(store.subscribe.bind(store));

    const workout = store.getById(workoutId);
    const [name, setName] = useState(workout?.name ?? "");
    const [restBetween, setRestBetween] = useState(String(workout?.restBetweenExercisesSeconds ?? 25));
    const [newExerciseName, setNewExerciseName] = useState("");
    const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

    useEffect(() => {
        if (!workout) return;
        setName(workout.name);
        setRestBetween(String(workout.restBetweenExercisesSeconds));
    }, [workout?.name, workout?.restBetweenExercisesSeconds]);

    if (!workout) {
        return (
            <div>
                <button type="button" onClick={onBack}>Back</button>
                <div style={{ marginTop: 12 }}>Workout not found.</div>
            </div>
        );
    }

    if (editingExerciseId) {
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

    const mobilityCountOk =
        tab === TabType.Workout ? true : workout.exercises.length >= 3 && workout.exercises.length <= 10;

    return (
        <div>
            <button type="button" onClick={onBack}>Back</button>

            <h2 style={{ marginTop: 12 }}>Edit Workout</h2>

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

                {tab !== TabType.Workout && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <label>
                            Rest between exercises (s){" "}
                            <input value={restBetween} inputMode="numeric" onChange={(e) => setRestBetween(e.target.value)} />
                        </label>
                        <button
                            type="button"
                            onClick={() => store.setMobilityRestBetweenExercises(workout.id, Number(restBetween))}
                        >
                            Save
                        </button>
                    </div>
                )}

                {tab !== TabType.Workout && !mobilityCountOk && (
                    <div style={{ marginTop: 8 }}>
                        Mobility workouts must have 3–10 exercises.
                    </div>
                )}
            </div>

            <h3>Exercises (ordered)</h3>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    placeholder="New exercise name"
                />
                <button
                    type="button"
                    onClick={async () => {
                        await store.addExercise(workout.id, newExerciseName);
                        setNewExerciseName("");
                    }}
                >
                    Add
                </button>
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
        </div>
    );
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