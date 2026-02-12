import { useEffect, useRef, useState } from "react";
import { WorkoutStore } from "../viewmodels/workoutStore";
import { TabType } from "../models";
import { useStoreSubscription } from "../viewmodels/useStore";
import { WorkoutEditor } from "./WorkoutEditor";
import { exportWorkoutsAsJson, importWorkoutsFromJsonFile } from "../io/workoutIO";

type WorkoutsView = "individual" | "plans";

export function WorkoutList(props: { tab: TabType; store: WorkoutStore }) {
    const { tab, store } = props;
    const plansEnabled = tab === TabType.Workout;

    useStoreSubscription(store.subscribe.bind(store));

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [isCreatingWorkout, setIsCreatingWorkout] = useState(false);
    const [newName, setNewName] = useState("");
    const [newRestBetween, setNewRestBetween] = useState("25");
    const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
    const [startAddExerciseWorkoutId, setStartAddExerciseWorkoutId] = useState<string | null>(null);
    const [workoutsView, setWorkoutsView] = useState<WorkoutsView>("individual");
    const [editorView, setEditorView] = useState<WorkoutsView | null>(null);

    useEffect(() => {
        let alive = true;
        store.ensureLoaded().then(() => {
            if (alive) setLoading(false);
        });
        return () => {
            alive = false;
        };
    }, [store]);

    useEffect(() => {
        setEditingWorkoutId(null);
        setStartAddExerciseWorkoutId(null);
        setWorkoutsView("individual");
        setEditorView(null);
        setIsCreatingWorkout(false);
        setNewName("");
        setNewRestBetween("25");
    }, [tab]);

    useEffect(() => {
        if (!plansEnabled && workoutsView !== "individual") {
            setWorkoutsView("individual");
        }
    }, [plansEnabled, workoutsView]);

    if (loading) return <div>Loading…</div>;

    if (editingWorkoutId) {
        return (
            <WorkoutEditor
                workoutId={editingWorkoutId}
                tab={tab}
                store={store}
                view={editorView ?? workoutsView}
                startInExerciseAdd={
                    (editorView ?? workoutsView) === "individual" && startAddExerciseWorkoutId === editingWorkoutId
                }
                onBack={() => {
                    setEditingWorkoutId(null);
                    setStartAddExerciseWorkoutId(null);
                    setEditorView(null);
                }}
            />
        );
    }

    const onExport = () => {
        exportWorkoutsAsJson(store.exportAllByTab());
    };

    const onImport = () => {
        fileInputRef.current?.click();
    };

    const onImportPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        const byTab = await importWorkoutsFromJsonFile(file);
        await store.importAllByTab(byTab);

        alert("Imported workouts.");
    };

    return (
        <div>
            {plansEnabled && (
                <div style={{ border: "1px solid currentColor", padding: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            style={{ flex: 1 }}
                            disabled={workoutsView === "individual"}
                            onClick={() => setWorkoutsView("individual")}
                        >
                            Individual workouts
                        </button>
                        <button
                            type="button"
                            style={{ flex: 1 }}
                            disabled={workoutsView === "plans"}
                            onClick={() => setWorkoutsView("plans")}
                        >
                            Workout plans
                        </button>
                    </div>
                </div>
            )}

            {workoutsView === "individual" && (
                !isCreatingWorkout ? (
                    <div style={{ border: "1px solid currentColor", padding: 12, marginTop: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <button type="button" style={{ flex: 1 }} onClick={() => setIsCreatingWorkout(true)}>
                                Add
                            </button>
                            <button type="button" style={{ flex: 1 }} onClick={onExport}>Export</button>
                            <button type="button" style={{ flex: 1 }} onClick={onImport}>Import</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ border: "1px solid currentColor", padding: 12, marginTop: 12 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <label style={{ display: "grid", gridTemplateColumns: "200px 1fr", alignItems: "center", gap: 8 }}>
                                <span>Name</span>
                                <input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </label>
                            <label style={{ display: "grid", gridTemplateColumns: "200px 1fr", alignItems: "center", gap: 8 }}>
                                <span>Rest between exercises</span>
                                <input
                                    value={newRestBetween}
                                    inputMode="numeric"
                                    onChange={(e) => setNewRestBetween(e.target.value)}
                                />
                            </label>
                            <div style={{ fontSize: 12 }}>
                                Hint: set to 0 to disable auto-next exercise.
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const createdId = await store.create(tab, newName);
                                        if (!createdId) return;
                                        await store.setRestBetweenExercises(createdId, Number(newRestBetween));
                                        setNewName("");
                                        setNewRestBetween("25");
                                        setIsCreatingWorkout(false);
                                        setEditingWorkoutId(createdId);
                                        setStartAddExerciseWorkoutId(createdId);
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreatingWorkout(false);
                                        setNewName("");
                                        setNewRestBetween("25");
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={onImportPicked}
            />

            {/* Keep the rest of your list UI exactly as before */}
            <details style={{ marginTop: 12 }} open>
                <summary>{workoutsView === "individual" ? "Saved-Workouts" : "Saved-Workout-Plans"}</summary>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    {(workoutsView === "individual" ? store.listIndividuals(tab) : store.listPlans(tab)).length === 0 ? (
                        <div>
                            {workoutsView === "individual" ? "No workouts yet." : "No workout plans yet."}
                        </div>
                    ) : (
                        (workoutsView === "individual" ? store.listIndividuals(tab) : store.listPlans(tab)).map((p) => (
                            <div key={p.id} style={{ border: "1px solid currentColor", padding: 12 }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <strong>{p.name}</strong>
                                    {workoutsView === "individual" ? (
                                        <>
                                            <button
                                                type="button"
                                        onClick={() => {
                                            setEditingWorkoutId(p.id);
                                            setStartAddExerciseWorkoutId(null);
                                            setEditorView("individual");
                                        }}
                                    >
                                        Edit
                                    </button>
                                            <button type="button" onClick={() => store.remove(p.id)}>
                                                Delete
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const newId = await store.duplicateWorkout(p.id);
                                                    if (newId) {
                                                        setEditingWorkoutId(newId);
                                                        setStartAddExerciseWorkoutId(null);
                                                        setEditorView("individual");
                                                    }
                                                }}
                                            >
                                                Duplicate
                                            </button>
                                            {plansEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const planId = await store.createPlanFromWorkout(p.id);
                                                        if (planId) {
                                                            setWorkoutsView("plans");
                                                            setEditingWorkoutId(planId);
                                                            setStartAddExerciseWorkoutId(null);
                                                            setEditorView("plans");
                                                        }
                                                    }}
                                                >
                                                    Create plan from workout
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingWorkoutId(p.id);
                                                    setStartAddExerciseWorkoutId(null);
                                                    setEditorView("plans");
                                                }}
                                            >
                                                Open plan
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingWorkoutId(p.id);
                                                    setStartAddExerciseWorkoutId(null);
                                                    setEditorView("individual");
                                                }}
                                            >
                                                Edit exercises
                                            </button>
                                            <button type="button" onClick={() => store.remove(p.id)}>
                                                Delete
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const newId = await store.duplicateWorkout(p.id);
                                                    if (newId) {
                                                        setEditingWorkoutId(newId);
                                                        setStartAddExerciseWorkoutId(null);
                                                        setEditorView("plans");
                                                    }
                                                }}
                                            >
                                                Duplicate
                                            </button>
                                        </>
                                    )}
                                </div>

                                {tab !== TabType.Workout && (
                                    <div style={{ marginTop: 8, fontSize: 12 }}>
                                        Rest between exercises: {p.restBetweenExercisesSeconds}s
                                    </div>
                                )}

                                <div style={{ marginTop: 8, fontSize: 12 }}>
                                    Exercises: {p.exercises.length}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </details>
        </div>
    );
}
