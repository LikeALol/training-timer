import { useEffect, useState } from "react";
import { TabType } from "../models";
import { PresetStore } from "../viewmodels/presetStore";
import { useStoreSubscription } from "../viewmodels/useStore";
import type { SessionEngine } from "../engine/sessionEngine";
import { SessionState } from "../engine/sessionEngine";
import { useEngine } from "../engine/useEngine";
import { buildMobilitySteps } from "../engine/mobilitySteps";
import {
    buildWorkoutStepsForExercise,
    validateWorkoutExercise,
} from "../engine/workoutSteps";

/* ---------------- Entry ---------------- */

export function ExecutionScreen(props: {
    tab: TabType;
    store: PresetStore;
    engine: SessionEngine;
}) {
    if (props.tab === TabType.Workout) return <WorkoutExecution {...props} />;
    return <MobilityExecution {...props} />;
}

/* ---------------- Mobility ---------------- */

function MobilityExecution(props: {
    tab: TabType;
    store: PresetStore;
    engine: SessionEngine;
}) {
    const { tab, store, engine } = props;

    useStoreSubscription(store.subscribe.bind(store));
    const snap = useEngine(engine);

    const storageKey = `selectedPresetId.${tab}`;
    const [selectedPresetId, setSelectedPresetId] = useState(
        () => localStorage.getItem(storageKey) ?? ""
    );

    useEffect(() => {
        setSelectedPresetId(localStorage.getItem(storageKey) ?? "");
    }, [tab, storageKey]);

    const presets = store.list(tab);
    const selected = selectedPresetId
        ? store.getById(selectedPresetId)
        : undefined;

    useEffect(() => {
        if (selectedPresetId && !selected) {
            localStorage.removeItem(storageKey);
            setSelectedPresetId("");
        }
    }, [selectedPresetId, selected, storageKey]);

    useEffect(() => {
        const onVis = () =>
            document.visibilityState === "visible"
                ? engine.appBecameActive()
                : engine.appWillResignActive();
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [engine]);

    const mobilityCountOk =
        !!selected &&
        selected.exercises.length >= 3 &&
        selected.exercises.length <= 10;

    const isIdle = snap.state === SessionState.Idle;
    const isCompleted = snap.state === SessionState.Completed;
    const canInteract = !isIdle && !isCompleted;
    const isRepsStep = snap.currentStep?.kind === "awaitUserDone";

    const confirmFullReset = () => window.confirm("Full reset the session?");

    return (
        <div>
            <h2>Execution</h2>

            <label>
                Preset{" "}
                <select
                    value={selectedPresetId}
                    onChange={(e) => {
                        const v = e.target.value;
                        setSelectedPresetId(v);
                        v
                            ? localStorage.setItem(storageKey, v)
                            : localStorage.removeItem(storageKey);
                        engine.fullReset();
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

            {!mobilityCountOk && selected && (
                <div style={{ marginTop: 8 }}>
                    Mobility preset must have 3–10 exercises.
                </div>
            )}

            <ExecutionBox
                snap={snap}
                title={snap.currentStep?.exerciseName || selected?.name}
                label={snap.currentStep?.label}
            >
                {isIdle && (
                    <button
                        style={{ flex: 1 }}
                        disabled={!selected || !mobilityCountOk}
                        onClick={() =>
                            selected &&
                            mobilityCountOk &&
                            engine.startSession(buildMobilitySteps(selected))
                        }
                    >
                        Start
                    </button>
                )}

                {canInteract && isRepsStep && (
                    <>
                        <button style={{ flex: 1 }} onClick={() => engine.markDone()}>
                            Done
                        </button>
                        <Row>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.resetCurrentStep()}
                            >
                                Reset step
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => confirmFullReset() && engine.fullReset()}
                            >
                                Full reset
                            </button>
                        </Row>
                    </>
                )}

                {canInteract && !isRepsStep && (
                    <>
                        <button
                            style={{ flex: 1 }}
                            onClick={() => (snap.isPaused ? engine.resume() : engine.pause())}
                        >
                            {snap.isPaused ? "Resume" : "Pause"}
                        </button>
                        <Row>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.skip()}
                            >
                                Next
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.resetCurrentStep()}
                            >
                                Reset step
                            </button>
                        </Row>
                        <button
                            style={{ flex: 1 }}
                            onClick={() => confirmFullReset() && engine.fullReset()}
                        >
                            Full reset
                        </button>
                    </>
                )}

                {isCompleted && (
                    <button
                        style={{ flex: 1 }}
                        onClick={() => confirmFullReset() && engine.fullReset()}
                    >
                        Full reset
                    </button>
                )}
            </ExecutionBox>
        </div>
    );
}

/* ---------------- Workout ---------------- */

function WorkoutExecution(props: {
    tab: TabType;
    store: PresetStore;
    engine: SessionEngine;
}) {
    const { tab, store, engine } = props;

    useStoreSubscription(store.subscribe.bind(store));
    const snap = useEngine(engine);

    const presetKey = `selectedPresetId.${tab}`;
    const exerciseKey = `selectedExerciseId.${tab}`;

    const [presetId, setPresetId] = useState(
        () => localStorage.getItem(presetKey) ?? ""
    );
    const [exerciseId, setExerciseId] = useState(
        () => localStorage.getItem(exerciseKey) ?? ""
    );

    useEffect(() => {
        setPresetId(localStorage.getItem(presetKey) ?? "");
        setExerciseId(localStorage.getItem(exerciseKey) ?? "");
    }, [tab, presetKey, exerciseKey]);

    const presets = store.list(tab);
    const preset = presetId ? store.getById(presetId) : undefined;
    const exercises = preset?.exercises ?? [];
    const exercise = exerciseId
        ? exercises.find((e) => e.id === exerciseId)
        : undefined;

    const isIdle = snap.state === SessionState.Idle;
    const isCompleted = snap.state === SessionState.Completed;
    const isSetStep = snap.currentStep?.kind === "awaitUserDone";

    const error = exercise ? validateWorkoutExercise(exercise) : null;
    const canStart = !!exercise && !error && isIdle;

    const confirmFullReset = () => window.confirm("Full reset the session?");

    const nextExercise = (() => {
        if (!exercise) return undefined;
        const idx = exercises.findIndex((e) => e.id === exercise.id);
        if (idx < 0) return undefined;
        return exercises[idx + 1];
    })();

    return (
        <div>
            <h2>Execution</h2>

            <label>
                Preset{" "}
                <select
                    value={presetId}
                    onChange={(e) => {
                        const v = e.target.value;
                        setPresetId(v);
                        v
                            ? localStorage.setItem(presetKey, v)
                            : localStorage.removeItem(presetKey);
                        setExerciseId("");
                        localStorage.removeItem(exerciseKey);
                        engine.fullReset();
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

            <label>
                Exercise{" "}
                <select
                    value={exerciseId}
                    disabled={!preset}
                    onChange={(e) => {
                        const v = e.target.value;
                        setExerciseId(v);
                        v
                            ? localStorage.setItem(exerciseKey, v)
                            : localStorage.removeItem(exerciseKey);
                        engine.fullReset();
                    }}
                >
                    <option value="">None</option>
                    {exercises.map((e) => (
                        <option key={e.id} value={e.id}>
                            {e.name}
                        </option>
                    ))}
                </select>
            </label>

            {error && <div style={{ marginTop: 8 }}>{error}</div>}

            <ExecutionBox
                snap={snap}
                title={snap.currentStep?.exerciseName || exercise?.name}
                label={snap.currentStep?.label}
            >
                {isIdle && (
                    <button
                        style={{ flex: 1 }}
                        disabled={!canStart}
                        onClick={() =>
                            exercise && engine.startSession(buildWorkoutStepsForExercise(exercise))
                        }
                    >
                        Start
                    </button>
                )}

                {!isIdle && !isCompleted && isSetStep && (
                    <>
                        <button style={{ flex: 1 }} onClick={() => engine.markDone()}>
                            Set Done
                        </button>
                        <Row>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.resetCurrentStep()}
                            >
                                Reset step
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => confirmFullReset() && engine.fullReset()}
                            >
                                Full reset
                            </button>
                        </Row>
                    </>
                )}

                {!isIdle && !isCompleted && !isSetStep && (
                    <>
                        <button
                            style={{ flex: 1 }}
                            onClick={() => (snap.isPaused ? engine.resume() : engine.pause())}
                        >
                            {snap.isPaused ? "Resume" : "Pause"}
                        </button>
                        <Row>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.skip()}
                            >
                                Next
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.resetCurrentStep()}
                            >
                                Reset step
                            </button>
                        </Row>
                        <button
                            style={{ flex: 1 }}
                            onClick={() => confirmFullReset() && engine.fullReset()}
                        >
                            Full reset
                        </button>
                    </>
                )}

                {isCompleted && (
                    <>
                        {nextExercise && (
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        setExerciseId(nextExercise.id);
                                        localStorage.setItem(exerciseKey, nextExercise.id);

                                        // Preserve total elapsed across exercises.
                                        engine.startSession(buildWorkoutStepsForExercise(nextExercise), {
                                            preserveTotalElapsed: true,
                                        });
                                    }}
                                >
                                    Next Exercise
                                </button>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => {
                                    if (confirmFullReset()) engine.fullReset();
                                }}
                            >
                                Full reset
                            </button>
                        </div>
                    </>
                )}
            </ExecutionBox>
        </div>
    );
}

/* ---------------- UI helpers ---------------- */

function ExecutionBox(props: {
    snap: any;
    title?: string;
    label?: string;
    children: React.ReactNode;
}) {
    const { snap, title, label, children } = props;

    return (
        <div style={{ marginTop: 12, border: "1px solid currentColor", padding: 12 }}>
            <div>State: {snap.state}</div>
            {snap.state === "completed" && (
                <div style={{ textAlign: "center", fontWeight: 700, marginTop: 8 }}>
                    Session complete
                </div>
            )}

            {timeRow("Total elapsed", formatHms(snap.totalElapsedSeconds))}
            {timeRow("Exercise elapsed", formatHms(snap.exerciseElapsedSeconds ?? 0))}
            {timeRow("Step elapsed", formatHms(snap.stepElapsedSeconds ?? 0))}
            {timeRow(
                "Time remaining",
                snap.timeRemainingSeconds == null ? "-" : formatHms(snap.timeRemainingSeconds)
            )}

            <hr />

            <div style={{ textAlign: "center", fontWeight: 600 }}>{title ?? "-"}</div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>{label ?? "-"}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {children}
            </div>
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}

function timeRow(label: string, value: string) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "baseline",
                marginTop: 6,
            }}
        >
            <div style={{ fontSize: 12 }}>{label}</div>
            <div
                style={{
                    fontSize: 26,
                    fontWeight: 700,
                    textAlign: "right",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    whiteSpace: "nowrap",
                }}
            >
                {value}
            </div>
        </div>
    );
}

function formatHms(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
