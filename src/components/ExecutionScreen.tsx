import { useEffect, useState } from "react";
import { TabType } from "../models";
import { PresetStore } from "../viewmodels/presetStore";
import { useStoreSubscription } from "../viewmodels/useStore";
import type { SessionEngine } from "../engine/sessionEngine";
import { SessionState } from "../engine/sessionEngine";
import { useEngine } from "../engine/useEngine";
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
    return <ExerciseExecution {...props} />;
}

/* ---------------- Execution ---------------- */

function ExerciseExecution(props: {
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

    useEffect(() => {
        const onVis = () =>
            document.visibilityState === "visible"
                ? engine.appBecameActive()
                : engine.appWillResignActive();
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [engine]);

    const presets = store.list(tab);
    const preset = presetId ? store.getById(presetId) : undefined;
    const exercises = preset?.exercises ?? [];
    const exercise = exerciseId
        ? exercises.find((e) => e.id === exerciseId)
        : undefined;

    const isIdle = snap.state === SessionState.Idle;
    const isCompleted = snap.state === SessionState.Completed;
    const isSetStep = snap.currentStep?.kind === "awaitUserDone";
    const isRestStep = snap.currentStep?.kind === "restTimer";

    const error = exercise ? validateWorkoutExercise(exercise) : null;
    const canStart = !!exercise && !error && isIdle;

    const confirmFullReset = () => window.confirm("Full reset the session?");

    const nextExercise = (() => {
        if (!exercise) return undefined;
        const idx = exercises.findIndex((e) => e.id === exercise.id);
        if (idx < 0) return undefined;
        return exercises[idx + 1];
    })();
    const previousExercise = (() => {
        if (!exercise) return undefined;
        const idx = exercises.findIndex((e) => e.id === exercise.id);
        if (idx <= 0) return undefined;
        return exercises[idx - 1];
    })();

    const upNextExerciseName = (() => {
        if (!isRestStep) return undefined;

        const nextStepName = snap.nextStep?.exerciseName?.trim();
        if (nextStepName) return nextStepName;

        const nextSelectedName = nextExercise?.name?.trim();
        if (nextSelectedName) return nextSelectedName;

        const currentName = exercise?.name?.trim();
        return currentName || undefined;
    })();

    const canGoBackWithinExercise = !isIdle && (isCompleted || snap.stepIndex > 0);
    const canGoBackToPreviousExercise =
        !isIdle && !isCompleted && snap.stepIndex === 0 && !!previousExercise;
    const canGoBack = canGoBackWithinExercise || canGoBackToPreviousExercise;

    const goBack = () => {
        if (canGoBackWithinExercise) {
            engine.back();
            return;
        }

        if (!canGoBackToPreviousExercise || !previousExercise) return;

        const prevSteps = buildWorkoutStepsForExercise(previousExercise);
        let targetIndex = prevSteps.length - 1;
        for (let i = prevSteps.length - 1; i >= 0; i--) {
            if (prevSteps[i]?.kind === "awaitUserDone") {
                targetIndex = i;
                break;
            }
        }

        setExerciseId(previousExercise.id);
        localStorage.setItem(exerciseKey, previousExercise.id);
        engine.startSession(prevSteps, { preserveTotalElapsed: true, startIndex: targetIndex });
    };

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
                        const nextPreset = v ? store.getById(v) : undefined;
                        const firstExerciseId = nextPreset?.exercises[0]?.id ?? "";
                        setExerciseId(firstExerciseId);
                        firstExerciseId
                            ? localStorage.setItem(exerciseKey, firstExerciseId)
                            : localStorage.removeItem(exerciseKey);
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
                upNextExerciseName={upNextExerciseName}
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
                                disabled={!canGoBack}
                                onClick={goBack}
                            >
                                Back
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
                            type="button"
                            style={{ flex: 1 }}
                            onClick={() => confirmFullReset() && engine.fullReset()}
                        >
                            Full reset
                        </button>
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
                                disabled={!canGoBack}
                                onClick={goBack}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                onClick={() => engine.skip()}
                            >
                                Next
                            </button>
                        </Row>
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

                {isCompleted && (
                    <>
                        {nextExercise && (
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    disabled={!canGoBack}
                                    onClick={goBack}
                                >
                                    Back
                                </button>
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
                        {!nextExercise && (
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    style={{ flex: 1 }}
                                    disabled={!canGoBack}
                                    onClick={goBack}
                                >
                                    Back
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
    upNextExerciseName?: string;
    children: React.ReactNode;
}) {
    const { snap, title, label, upNextExerciseName, children } = props;

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
            {upNextExerciseName && (
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                    Up next: <strong>{upNextExerciseName}</strong>
                </div>
            )}

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
