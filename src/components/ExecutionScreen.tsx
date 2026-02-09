import { useEffect, useState } from "react";
import { TabType } from "../models";
import type { Preset, Exercise } from "../models";
import { PresetStore } from "../viewmodels/presetStore";
import { useStoreSubscription } from "../viewmodels/useStore";
import type { SessionEngine } from "../engine/sessionEngine";
import { SessionState } from "../engine/sessionEngine";
import { useEngine } from "../engine/useEngine";
import { buildMobilitySteps } from "../engine/mobilitySteps";
import {buildWorkoutStepsForExercise, validateWorkoutExercise } from "../engine/workoutSteps.ts";

export function ExecutionScreen(props: { tab: TabType; store: PresetStore; engine: SessionEngine }) {
    const { tab } = props;
    if (tab === TabType.Workout) return <WorkoutExecution {...props} />;
    return <MobilityExecution {...props} />;
}

/* ---------------- Mobility ---------------- */

function MobilityExecution(props: { tab: TabType; store: PresetStore; engine: SessionEngine }) {
    const { tab, store, engine } = props;

    useStoreSubscription(store.subscribe.bind(store));
    const snap = useEngine(engine);

    const storageKey = `selectedPresetId.${tab}`;
    const [selectedPresetId, setSelectedPresetId] = useState<string>(() => localStorage.getItem(storageKey) ?? "");

    useEffect(() => {
        const key = `selectedPresetId.${tab}`;
        setSelectedPresetId(localStorage.getItem(key) ?? "");
    }, [tab]);

    const presets = store.list(tab);
    const selected: Preset | undefined = selectedPresetId ? store.getById(selectedPresetId) : undefined;

    useEffect(() => {
        if (selectedPresetId && !selected) {
            localStorage.removeItem(storageKey);
            setSelectedPresetId("");
        }
    }, [selectedPresetId, selected, storageKey]);

    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === "visible") engine.appBecameActive();
            else engine.appWillResignActive();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [engine]);

    const mobilityCountOk = !!selected && selected.exercises.length >= 3 && selected.exercises.length <= 10;
    const canStart = mobilityCountOk;
    const running = snap.state !== SessionState.Idle && snap.state !== SessionState.Completed;

    return (
        <div>
            <h2>Execution</h2>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label>
                    Preset{" "}
                    <select
                        value={selectedPresetId}
                        onChange={(e) => {
                            const v = e.target.value;
                            setSelectedPresetId(v);
                            if (v) localStorage.setItem(storageKey, v);
                            else localStorage.removeItem(storageKey);
                        }}
                    >
                        <option value="">None</option>
                        {presets.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {selected && !mobilityCountOk && (
                <div style={{ marginTop: 8 }}>Mobility presets must have 3–10 exercises.</div>
            )}

            <div style={{ marginTop: 12, border: "1px solid currentColor", padding: 12 }}>
                <div>Selected: {selected ? selected.name : "-"}</div>
                <div>State: {snap.state}{snap.isPaused ? " (paused)" : ""}</div>

                {snap.state === "completed" && (
                    <div style={{ textAlign: "center", fontWeight: 700, marginTop: 8 }}>
                        Session complete
                    </div>
                )}

                {timeRow("Total elapsed", formatHms(snap.totalElapsedSeconds))}
                {timeRow("Step elapsed", formatHms(snap.stepElapsedSeconds))}
                {timeRow("Time remaining", snap.timeRemainingSeconds == null ? "-" : formatHms(snap.timeRemainingSeconds))}

                <hr />

                <div style={{ textAlign: "center", fontWeight: 600, marginTop: 6 }}>
                    {snap.currentStep?.exerciseName || "-"}
                </div>
                <div style={{ textAlign: "center", marginTop: 6 }}>{snap.currentStep?.label || "-"}</div>

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Start (full width) */}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            style={{ flex: 1 }}
                            onClick={() => {
                                if (!selected) return;
                                if (!canStart) return;
                                engine.startSession(buildMobilitySteps(selected));
                            }}
                            disabled={!canStart}
                        >
                            Start
                        </button>
                    </div>

                    {/* Pause / Reset */}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            style={{ flex: 1 }}
                            onClick={() => (snap.isPaused ? engine.resume() : engine.pause())}
                            disabled={!running}
                        >
                            {snap.isPaused ? "Resume" : "Pause"}
                        </button>

                        <button type="button" style={{ flex: 1 }} onClick={() => engine.resetCurrentStep()} disabled={!running}>
                            Reset
                        </button>
                    </div>

                    {/* Finished/Next OR Full Reset */}
                    {snap.state === "completed" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" style={{ flex: 1 }} onClick={() => engine.fullReset()}>
                                Full Reset
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.markDone()}
                                disabled={!running || snap.currentStep?.kind !== "awaitUserDone"}
                            >
                                Finished
                            </button>

                            <button type="button" style={{ flex: 1 }} onClick={() => engine.skip()} disabled={!running}>
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---------------- Workout ---------------- */

function WorkoutExecution(props: { tab: TabType; store: PresetStore; engine: SessionEngine }) {
    const { tab, store, engine } = props;


    useStoreSubscription(store.subscribe.bind(store));
    const snap = useEngine(engine);

    const storageKey = `selectedPresetId.${tab}`;
    const [selectedPresetId, setSelectedPresetId] = useState<string>(() => localStorage.getItem(storageKey) ?? "");
    const [selectedExerciseId, setSelectedExerciseId] = useState<string>(() => localStorage.getItem(`selectedExerciseId.${tab}`) ?? "");

    useEffect(() => {
        setSelectedPresetId(localStorage.getItem(storageKey) ?? "");
        setSelectedExerciseId(localStorage.getItem(`selectedExerciseId.${tab}`) ?? "");
    }, [tab]);

    const presets = store.list(tab);
    const selectedPreset: Preset | undefined = selectedPresetId ? store.getById(selectedPresetId) : undefined;

    const exercises = selectedPreset?.exercises ?? [];
    const selectedExercise: Exercise | undefined = selectedExerciseId
        ? exercises.find((e) => e.id === selectedExerciseId)
        : undefined;

    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === "visible") engine.appBecameActive();
            else engine.appWillResignActive();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [engine]);

    const running = snap.state !== SessionState.Idle && snap.state !== SessionState.Completed;
    const exerciseError = selectedExercise ? validateWorkoutExercise(selectedExercise) : null;
    const canStartExercise = !!selectedExercise && !exerciseError && !running && snap.state !== "completed";
    const selectedIndex = selectedExercise ? exercises.findIndex((e) => e.id === selectedExercise.id) : -1;
    const nextExercise = selectedIndex >= 0 ? exercises[selectedIndex + 1] : undefined;


    return  (
        <div>
            <h2>Execution</h2>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label>
                    Preset{" "}
                    <select
                        value={selectedPresetId}
                        onChange={(e) => {
                            const v = e.target.value;
                            setSelectedPresetId(v);
                            if (v) localStorage.setItem(storageKey, v);
                            else localStorage.removeItem(storageKey);

                            setSelectedExerciseId("");
                            localStorage.removeItem(`selectedExerciseId.${tab}`);
                        }}
                    >
                        <option value="">None</option>
                        {presets.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label>
                    Exercise{" "}
                    <select
                        value={selectedExerciseId}
                        onChange={(e) => {
                            const v = e.target.value;
                            setSelectedExerciseId(v);
                            if (v) localStorage.setItem(`selectedExerciseId.${tab}`, v);
                            else localStorage.removeItem(`selectedExerciseId.${tab}`);
                        }}
                        disabled={!selectedPreset}
                    >
                        <option value="">None</option>
                        {exercises.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                                {ex.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {exerciseError && <div style={{ marginTop: 8 }}>{exerciseError}</div>}

            <div style={{ marginTop: 12, border: "1px solid currentColor", padding: 12 }}>
                <div>Selected: {selectedPreset ? selectedPreset.name : "-"}</div>
                <div>
                    State: {snap.state}
                    {snap.isPaused ? " (paused)" : ""}
                </div>

                {snap.state === "completed" && (
                    <div style={{ textAlign: "center", fontWeight: 700, marginTop: 8 }}>Session complete</div>
                )}

                {timeRow("Total elapsed", formatHms(snap.totalElapsedSeconds))}
                {timeRow("Time remaining", snap.timeRemainingSeconds == null ? "-" : formatHms(snap.timeRemainingSeconds))}

                <hr />

                <div style={{ textAlign: "center", fontWeight: 600, marginTop: 6 }}>
                    {snap.currentStep?.exerciseName || selectedExercise?.name || "-"}
                </div>
                <div style={{ textAlign: "center", marginTop: 6 }}>{snap.currentStep?.label || "-"}</div>

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Start Exercise (HIDDEN while running or completed) */}
                    {!running && snap.state !== "completed" && (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => {
                                    if (!selectedExercise) return;
                                    engine.startSession(buildWorkoutStepsForExercise(selectedExercise));
                                }}
                                disabled={!canStartExercise}
                            >
                                Start Exercise
                            </button>
                        </div>
                    )}

                    {/* Completed: Next Exercise (preferred) or Full Reset */}
                    {snap.state === "completed" ? (
                        nextExercise ? (
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        setSelectedExerciseId(nextExercise.id);
                                        localStorage.setItem(`selectedExerciseId.${tab}`, nextExercise.id);
                                        engine.startSession(buildWorkoutStepsForExercise(nextExercise));
                                    }}
                                >
                                    Next Exercise
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" style={{ flex: 1 }} onClick={() => engine.fullReset()}>
                                    Full Reset
                                </button>
                            </div>
                        )
                    ) : (
                        <>
                            {/* Pause / Reset (only while not completed) */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    onClick={() => (snap.isPaused ? engine.resume() : engine.pause())}
                                    disabled={!running}
                                >
                                    {snap.isPaused ? "Resume" : "Pause"}
                                </button>

                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    onClick={() => engine.resetCurrentStep()}
                                    disabled={!running}
                                >
                                    Reset
                                </button>
                            </div>

                            {/* Set Done / Next (only while not completed) */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    onClick={() => engine.markDone()}
                                    disabled={!running || snap.currentStep?.kind !== "awaitUserDone"}
                                >
                                    Set Done
                                </button>

                                <button type="button" style={{ flex: 1 }} onClick={() => engine.skip()} disabled={!running}>
                                    Next
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---------------- shared helpers ---------------- */

function timeRow(label: string, value: string) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                marginTop: 6,
            }}
        >
            <div style={{ fontSize: 12 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, textAlign: "center", minWidth: 110 }}>
                {value}
            </div>
            <div />
        </div>
    );
}

function formatHms(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
