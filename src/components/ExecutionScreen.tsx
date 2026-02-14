import { useEffect, useMemo, useState } from "react";
import { TabType } from "../models";
import type { Exercise, WorkoutDayEntry } from "../models";
import { useStoreSubscription } from "../viewmodels/useStore";
import type { SessionEngine } from "../engine/sessionEngine";
import { SessionState } from "../engine/sessionEngine";

import { useEngine } from "../engine/useEngine";
import {
    buildWorkoutStepsForExercise,
    validateWorkoutExercise,
    type WorkoutSetStyle,
} from "../engine/workoutSteps";
import type { WorkoutStore } from "../viewmodels/workoutStore";

type ExecutionType = "individual" | "plan";

/* ---------------- Entry ---------------- */

export function ExecutionScreen(props: {
    tab: TabType;
    store: WorkoutStore;
    engine: SessionEngine;
}) {
    return <ExerciseExecution {...props} />;
}

/* ---------------- Execution ---------------- */

function ExerciseExecution(props: {
    tab: TabType;
    store: WorkoutStore;
    engine: SessionEngine;
}) {
    const { tab, store, engine } = props;

    useStoreSubscription(store.subscribe.bind(store));
    const snap = useEngine(engine);

    const plansEnabled = tab === TabType.Workout;
    const setStyle: WorkoutSetStyle = tab === TabType.Workout ? "workout" : "mobility";

    const typeKey = `executionType.${tab}`;
    const workoutKey = `selectedWorkoutId.${tab}`;
    const exerciseKey = `selectedExerciseId.${tab}`;
    const dayKey = `selectedPlanDay.${tab}`;

    const [executionType, setExecutionType] = useState<ExecutionType>(() => {
        const stored = localStorage.getItem(typeKey);
        if (stored === "plan" && plansEnabled) return "plan";
        return "individual";
    });
    const [workoutId, setWorkoutId] = useState(
        () => localStorage.getItem(workoutKey) ?? ""
    );
    const [exerciseId, setExerciseId] = useState(
        () => localStorage.getItem(exerciseKey) ?? ""
    );
    const [selectedDay, setSelectedDay] = useState(
        () => localStorage.getItem(dayKey) ?? "1"
    );

    useEffect(() => {
        const storedType = localStorage.getItem(typeKey);
        const nextType: ExecutionType =
            storedType === "plan" && plansEnabled ? "plan" : "individual";
        setExecutionType(nextType);
        if (!plansEnabled) localStorage.setItem(typeKey, "individual");

        setWorkoutId(localStorage.getItem(workoutKey) ?? "");
        setExerciseId(localStorage.getItem(exerciseKey) ?? "");
        setSelectedDay(localStorage.getItem(dayKey) ?? "1");
    }, [tab, typeKey, workoutKey, exerciseKey, dayKey, plansEnabled]);

    useEffect(() => {
        const onVis = () =>
            document.visibilityState === "visible"
                ? engine.appBecameActive()
                : engine.appWillResignActive();
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [engine]);

    const workouts = executionType === "plan" ? store.listPlans(tab) : store.listIndividuals(tab);
    const workout = workoutId ? store.getById(workoutId) : undefined;
    const exercises = workout?.exercises ?? [];
    const exercise = exerciseId
        ? exercises.find((e) => e.id === exerciseId)
        : undefined;

    const dayNumber = clampDay(selectedDay, workout?.repeatCount ?? 1);
    const dayPlan = workout?.dayPlans.find((p) => p.day === dayNumber);

    const effectiveExercise = useMemo(
        () => buildEffectiveExercise(executionType, exercise, dayPlan?.entries),
        [executionType, exercise, dayPlan?.entries]
    );

    const isIdle = snap.state === SessionState.Idle;
    const isCompleted = snap.state === SessionState.Completed;
    const isSetStep = snap.currentStep?.kind === "awaitUserDone";

    const error = effectiveExercise ? validateWorkoutExercise(effectiveExercise, setStyle) : null;
    const canStart = !!effectiveExercise && !error && isIdle;

    const confirmFullReset = () => window.confirm("Full reset the session?");

    const nextExercise = (() => {
        if (!exercise) return undefined;
        const idx = exercises.findIndex((e) => e.id === exercise.id);
        if (idx < 0) return undefined;
        return exercises[idx + 1];
    })();
    const nextEffectiveExercise = buildEffectiveExercise(executionType, nextExercise, dayPlan?.entries);
    const upNextSetCount = nextEffectiveExercise
        ? Math.max(1, nextEffectiveExercise.warmupSets + nextEffectiveExercise.workingSets)
        : 0;
    const upNextSummary = nextEffectiveExercise
        ? `Up next: ${nextEffectiveExercise.name} ${nextEffectiveExercise.weight || "-"}Kg Sets: ${upNextSetCount} Reps: ${nextEffectiveExercise.reps}`
        : null;
    const previousExercise = (() => {
        if (!exercise) return undefined;
        const idx = exercises.findIndex((e) => e.id === exercise.id);
        if (idx <= 0) return undefined;
        return exercises[idx - 1];
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

        const previousEffective = buildEffectiveExercise(executionType, previousExercise, dayPlan?.entries);
        if (!previousEffective) return;

        const prevSteps = buildWorkoutStepsForExercise(previousEffective, setStyle);
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

            {plansEnabled && (
                <label>
                    Type{" "}
                    <select
                        value={executionType}
                        onChange={(e) => {
                            const nextType = e.target.value as ExecutionType;
                            setExecutionType(nextType);
                            localStorage.setItem(typeKey, nextType);
                            setWorkoutId("");
                            setExerciseId("");
                            localStorage.removeItem(workoutKey);
                            localStorage.removeItem(exerciseKey);
                            if (nextType === "individual") {
                                setSelectedDay("1");
                                localStorage.setItem(dayKey, "1");
                            }
                            engine.fullReset();
                        }}
                    >
                        <option value="individual">Individual</option>
                        <option value="plan">Plan</option>
                    </select>
                </label>
            )}

            <label>
                Preset{" "}
                <select
                    value={workoutId}
                    onChange={(e) => {
                        const v = e.target.value;
                        setWorkoutId(v);
                        v
                            ? localStorage.setItem(workoutKey, v)
                            : localStorage.removeItem(workoutKey);
                        const selectedWorkout = v ? store.getById(v) : undefined;
                        const firstExerciseId = selectedWorkout?.exercises[0]?.id ?? "";
                        setExerciseId(firstExerciseId);
                        firstExerciseId
                            ? localStorage.setItem(exerciseKey, firstExerciseId)
                            : localStorage.removeItem(exerciseKey);
                        if (executionType === "plan") {
                            const firstDay = clampDay(localStorage.getItem(dayKey) ?? "1", selectedWorkout?.repeatCount ?? 1);
                            setSelectedDay(String(firstDay));
                            localStorage.setItem(dayKey, String(firstDay));
                        }
                        engine.fullReset();
                    }}
                >
                    <option value="">None</option>
                    {workouts.map((w) => (
                        <option key={w.id} value={w.id}>
                            {w.name}
                        </option>
                    ))}
                </select>
            </label>

            {executionType === "plan" && (
                <label>
                    Day{" "}
                    <select
                        value={String(dayNumber)}
                        onChange={(e) => {
                            const v = clampDay(e.target.value, workout?.repeatCount ?? 1);
                            setSelectedDay(String(v));
                            localStorage.setItem(dayKey, String(v));
                            const firstExerciseId = workout?.exercises[0]?.id ?? "";
                            setExerciseId(firstExerciseId);
                            firstExerciseId
                                ? localStorage.setItem(exerciseKey, firstExerciseId)
                                : localStorage.removeItem(exerciseKey);
                            engine.fullReset();
                        }}
                    >
                        {Array.from({ length: Math.max(1, workout?.repeatCount ?? 1) }, (_, i) => i + 1).map((day) => (
                            <option key={day} value={day}>
                                Day {day}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            <label>
                Exercise{" "}
                <select
                    value={exerciseId}
                    disabled={!workout}
                    onChange={(e) => {
                        const v = e.target.value;
                        setExerciseId(v);
                        v
                            ? localStorage.setItem(exerciseKey, v)
                            : localStorage.removeItem(exerciseKey);
                        const selectedExercise = v
                            ? exercises.find((exerciseItem) => exerciseItem.id === v)
                            : undefined;
                        const selectedEffective = buildEffectiveExercise(executionType, selectedExercise, dayPlan?.entries);
                        if (!isIdle && selectedEffective && !validateWorkoutExercise(selectedEffective, setStyle)) {
                            engine.startSession(buildWorkoutStepsForExercise(selectedEffective, setStyle), {
                                preserveTotalElapsed: true,
                            });
                            return;
                        }
                        engine.fullReset({ preserveTotalElapsed: true });
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
                title={snap.currentStep?.exerciseName || effectiveExercise?.name}
                label={
                    (isCompleted && upNextSummary
                        ? `Completed\n${upNextSummary}`
                        : snap.currentStep?.label)
                    || (isIdle && effectiveExercise
                        ? `Today's working set: ${effectiveExercise.weight || "-"} • Sets: ${effectiveExercise.workingSets} • Reps: ${effectiveExercise.reps}`
                        : undefined)
                }
            >
                {isIdle && (
                    <button
                        style={{ flex: 1 }}
                        disabled={!canStart}
                        onClick={() =>
                            effectiveExercise && engine.startSession(buildWorkoutStepsForExercise(effectiveExercise, setStyle))
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
                                    onClick={() => {
                                        setExerciseId(nextExercise.id);
                                        localStorage.setItem(exerciseKey, nextExercise.id);

                                        const nextEffective = buildEffectiveExercise(executionType, nextExercise, dayPlan?.entries);
                                        if (!nextEffective) return;

                                        engine.startSession(buildWorkoutStepsForExercise(nextEffective, setStyle), {
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

function buildEffectiveExercise(
    executionType: ExecutionType,
    baseExercise: Exercise | undefined,
    dayEntries: WorkoutDayEntry[] | undefined
): Exercise | undefined {
    if (!baseExercise) return undefined;
    if (executionType !== "plan") return baseExercise;

    const entry = dayEntries?.find((e) => e.exerciseId === baseExercise.id);
    if (!entry) return baseExercise;

    return {
        ...baseExercise,
        name: entry.exerciseName || baseExercise.name,
        warmupSets: entry.warmupSets,
        workingSets: entry.sets,
        sets: Math.max(1, entry.warmupSets + entry.sets),
        reps: entry.reps,
        intensity: entry.intensity,
        weight: entry.weight,
        tempo: entry.tempo,
        restSecondsBetweenSets: entry.warmupRestSeconds,
        restSecondsBetweenSides: entry.workingRestSeconds,
    };
}

function clampDay(v: string | number, repeatCount: number): number {
    const maxDays = Math.max(1, Math.floor(Number(repeatCount)) || 1);
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(maxDays, n));
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
            <div style={{ textAlign: "center", marginBottom: 12, whiteSpace: "pre-line" }}>{label ?? "-"}</div>

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
