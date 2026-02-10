import type { TabType } from "../models";

export const SessionState = {
    Idle: "idle",
    Setup: "setup",
    ActiveSet: "activeSet",
    Resting: "resting",
    Transition: "transition",
    Completed: "completed",
} as const;

export type SessionState = typeof SessionState[keyof typeof SessionState];

export const StepKind = {
    SetupTimer: "setupTimer",
    TimedActive: "timedActive",
    AwaitUserDone: "awaitUserDone",
    RestTimer: "restTimer",
    Completed: "completed",
} as const;

export type StepKind = typeof StepKind[keyof typeof StepKind];

export type SessionStep = {
    id: string;
    kind: StepKind;

    exerciseId?: string;
    exerciseName: string;

    label: string;

    // for display only
    setIndex?: number;
    setCount?: number;
    side?: "left" | "right";

    durationSeconds?: number; // timed steps only
};

type EngineSnapshot = {
    state: SessionState;
    steps: SessionStep[];
    index: number;

    isPaused: boolean;

    // For timed steps: we store a target wall-clock timestamp (ms)
    targetTimeMs?: number;
    remainingSecondsWhenPaused?: number;

    // Total elapsed session time
    startedAtMs?: number;
    elapsedBeforePauseMs: number;

    stepStartedAtMs?: number;
    stepElapsedBeforePauseMs: number;

    // Per-exercise elapsed time (resets when starting a new exercise)
    exerciseStartedAtMs?: number;
    exerciseElapsedBeforePauseMs: number;
};

type Listener = () => void;

export class SessionEngine {
    private listeners = new Set<Listener>();

    private state: SessionState = SessionState.Idle;
    private steps: SessionStep[] = [];
    private index = 0;

    private isPaused = false;

    private targetTimeMs?: number;
    private remainingSecondsWhenPaused?: number;

    private startedAtMs?: number;
    private elapsedBeforePauseMs = 0;

    private tickHandle: number | null = null;
    private stepStartedAtMs?: number;
    private stepElapsedBeforePauseMs = 0;

    private readonly storageKey: string;

    private exerciseStartedAtMs?: number;
    private exerciseElapsedBeforePauseMs = 0;

    constructor(tab: TabType) {
        this.storageKey = `engine.snapshot.${tab}.v1`;
        this.restoreIfPossible();
        this.startTicking();
    }

    // ---- subscription ----
    subscribe(fn: Listener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private emit() {
        for (const fn of this.listeners) fn();
    }

    // ---- read-only view of engine state (UI consumes this) ----
    getSnapshot() {
        const step = this.steps[this.index];
        const nextStep = this.steps[this.index + 1];
        const now = Date.now();

        const elapsedMs =
            this.elapsedBeforePauseMs +
            (this.startedAtMs && !this.isPaused ? now - this.startedAtMs : 0);

        const stepElapsedMs =
            this.stepElapsedBeforePauseMs +
            (this.stepStartedAtMs && !this.isPaused ? now - this.stepStartedAtMs : 0);

        const exerciseElapsedMs =
            this.exerciseElapsedBeforePauseMs +
            (this.exerciseStartedAtMs && !this.isPaused ? now - this.exerciseStartedAtMs : 0);

        let timeRemainingSeconds: number | null = null;
        if (this.isPaused && this.remainingSecondsWhenPaused != null) {
            timeRemainingSeconds = this.remainingSecondsWhenPaused;
        } else if (this.targetTimeMs != null) {
            timeRemainingSeconds = Math.max(0, Math.floor((this.targetTimeMs - now) / 1000));
        }

        return {
            state: this.state,
            isPaused: this.isPaused,
            currentStep: step ?? null,
            nextStep: nextStep ?? null,
            stepIndex: this.index,
            stepCount: this.steps.length,
            timeRemainingSeconds,
            totalElapsedSeconds: Math.floor(elapsedMs / 1000),
            stepElapsedSeconds: Math.floor(stepElapsedMs / 1000),
            exerciseElapsedSeconds: Math.floor(exerciseElapsedMs / 1000),
        };
    }

    // ---- mobility/workout: start a session with prebuilt steps ----
    startSession(steps: SessionStep[], opts?: { preserveTotalElapsed?: boolean; startIndex?: number }) {
        this.steps = steps;
        const requestedStart = Number.isFinite(opts?.startIndex)
            ? Math.floor(opts?.startIndex ?? 0)
            : 0;
        this.index = Math.max(0, Math.min(requestedStart, Math.max(0, steps.length - 1)));

        this.state = SessionState.Transition;
        this.isPaused = false;

        this.targetTimeMs = undefined;
        this.remainingSecondsWhenPaused = undefined;

        const preserveTotal = opts?.preserveTotalElapsed === true;

        // Exercise timer always resets on new exercise.
        this.exerciseElapsedBeforePauseMs = 0;
        this.exerciseStartedAtMs = Date.now();

        // Total timer resets only if we are not preserving it.
        if (!preserveTotal) {
            this.elapsedBeforePauseMs = 0;
            this.startedAtMs = Date.now();
        } else {
            // Preserve elapsedBeforePauseMs; ensure we start accumulating again if needed.
            if (!this.startedAtMs) this.startedAtMs = Date.now();
        }

        this.enterCurrentStep();
        this.persist();
        this.emit();
    }

    // Start button behavior:
    // - if idle: no-op (caller should create session first)
    // - if paused: resume
    // - otherwise: if current step is timed, (re)start it
    pause() {
        if (this.isPaused) return;
        if (this.state === SessionState.Idle || this.state === SessionState.Completed) return;

        this.isPaused = true;

        // Freeze timer
        if (this.targetTimeMs != null) {
            const rem = Math.max(0, Math.floor((this.targetTimeMs - Date.now()) / 1000));
            this.remainingSecondsWhenPaused = rem;
            this.targetTimeMs = undefined;
        }

        // Freeze elapsed
        if (this.startedAtMs != null) {
            this.elapsedBeforePauseMs += Date.now() - this.startedAtMs;
            this.startedAtMs = undefined;
        }

        if (this.stepStartedAtMs != null) {
            this.stepElapsedBeforePauseMs += Date.now() - this.stepStartedAtMs;
            this.stepStartedAtMs = undefined;
        }

        if (this.exerciseStartedAtMs != null) {
            this.exerciseElapsedBeforePauseMs += Date.now() - this.exerciseStartedAtMs;
            this.exerciseStartedAtMs = undefined;
        }

        this.persist();
        this.emit();
    }

    resume() {
        if (!this.isPaused) return;
        if (this.state === SessionState.Idle || this.state === SessionState.Completed) return;

        this.isPaused = false;

        // Resume elapsed
        this.startedAtMs = Date.now();
        this.stepStartedAtMs = Date.now();
        this.exerciseStartedAtMs = Date.now();

        // Resume timer
        if (this.remainingSecondsWhenPaused != null) {
            this.targetTimeMs = Date.now() + this.remainingSecondsWhenPaused * 1000;
            this.remainingSecondsWhenPaused = undefined;
        }

        this.persist();
        this.emit();
    }

    // Reset affects ONLY current step (restart its timer)
    resetCurrentStep() {
        if (this.state === SessionState.Idle || this.state === SessionState.Completed) return;

        const step = this.steps[this.index];
        if (!step) return;

        // Reset “elapsed in current step” for BOTH timed and reps steps
        this.stepElapsedBeforePauseMs = 0;
        this.stepStartedAtMs = this.isPaused ? undefined : Date.now();

        if (step.durationSeconds != null) {
            // Restart timer from full duration
            this.targetTimeMs = Date.now() + step.durationSeconds * 1000;
            this.remainingSecondsWhenPaused = this.isPaused ? step.durationSeconds : undefined;
        }

        this.persist();
        this.emit();
    }

    fullReset() {
        this.state = SessionState.Idle;
        this.steps = [];
        this.index = 0;

        this.isPaused = false;

        this.targetTimeMs = undefined;
        this.remainingSecondsWhenPaused = undefined;

        this.startedAtMs = undefined;
        this.elapsedBeforePauseMs = 0;

        this.stepStartedAtMs = undefined;
        this.stepElapsedBeforePauseMs = 0;

        this.exerciseStartedAtMs = undefined;
        this.exerciseElapsedBeforePauseMs = 0;

        try {
            localStorage.removeItem(this.storageKey);
        } catch {}

        this.emit();
    }

    // Called by UI on page background/foreground events
    appBecameActive() {
        this.reconcileAfterBackground();
        this.persist();
        this.emit();
    }

    appWillResignActive() {
        this.persist();
    }

    // ---- internals ----

    private enterCurrentStep() {
        const step = this.steps[this.index];

        if (!step) {
            this.finish();
            return;
        }

        if (step.kind === StepKind.Completed) {
            this.finish();
            return;
        }

        this.stepElapsedBeforePauseMs = 0;
        this.stepStartedAtMs = this.isPaused ? undefined : Date.now();

        switch (step.kind) {
            case StepKind.SetupTimer:
                this.state = SessionState.Setup;
                break;
            case StepKind.TimedActive:
                this.state = SessionState.ActiveSet;
                break;
            case StepKind.AwaitUserDone:
                this.state = SessionState.ActiveSet;
                break;
            case StepKind.RestTimer:
                this.state = SessionState.Resting;
                break;
            default:
                this.state = SessionState.Transition;
                break;
        }

        this.beginTimerForCurrentStepIfNeeded();
    }

    private beginTimerForCurrentStepIfNeeded() {
        const step = this.steps[this.index];
        if (!step) return;

        // If paused, do not start timers.
        if (this.isPaused) return;

        if (step.durationSeconds != null) {
            this.targetTimeMs = Date.now() + step.durationSeconds * 1000;
            this.remainingSecondsWhenPaused = undefined;
        } else {
            this.targetTimeMs = undefined;
            this.remainingSecondsWhenPaused = undefined;
        }
    }

    private advance() {
        this.index += 1;
        this.targetTimeMs = undefined;
        this.remainingSecondsWhenPaused = undefined;

        if (this.index >= this.steps.length) {
            this.finish();
            return;
        }

        this.enterCurrentStep();
        this.persist();
        this.emit();
    }

    private finish() {
        this.state = SessionState.Completed;
        this.targetTimeMs = undefined;
        this.remainingSecondsWhenPaused = undefined;

        // stop elapsed accumulation
        if (this.startedAtMs != null) {
            this.elapsedBeforePauseMs += Date.now() - this.startedAtMs;
            this.startedAtMs = undefined;
        }

        if (this.exerciseStartedAtMs != null) {
            this.exerciseElapsedBeforePauseMs += Date.now() - this.exerciseStartedAtMs;
            this.exerciseStartedAtMs = undefined;
        }

        this.persist();
        this.emit();
    }

    private startTicking() {
        if (this.tickHandle != null) return;

        this.tickHandle = window.setInterval(() => this.tick(), 250);
    }

    private tick() {
        if (this.state === SessionState.Idle || this.state === SessionState.Completed) return;
        if (this.isPaused) return;

        // Auto-advance when timer hits 0
        if (this.targetTimeMs != null) {
            const remMs = this.targetTimeMs - Date.now();
            if (remMs <= 0) {
                this.targetTimeMs = undefined;
                this.advance();
                return;
            }
        }

        // keep UI live (elapsed countdown)
        this.emit();
    }

    private reconcileAfterBackground() {
        if (this.isPaused) return;

        // If the timed step expired while backgrounded, advance until we land on an unexpired timed step or completion.
        while (true) {
            const step = this.steps[this.index];
            if (!step) {
                this.finish();
                return;
            }
            if (step.kind === StepKind.Completed) {
                this.finish();
                return;
            }

            if (step.durationSeconds == null) {
                // Mobility should not have untimed steps; but keep safe.
                this.enterCurrentStep();
                return;
            }

            if (this.targetTimeMs == null) {
                // ensure timer exists
                this.beginTimerForCurrentStepIfNeeded();
                return;
            }

            if (this.targetTimeMs <= Date.now()) {
                this.advance();
                continue;
            }

            return;
        }
    }

    // For reps-based mobility: user indicates they finished current step.
    markDone() {
        const step = this.steps[this.index];
        if (!step) return;
        if (step.kind !== StepKind.AwaitUserDone) return;
        if (this.state === SessionState.Completed || this.state === SessionState.Idle) return;

        this.advance();
    }

    // Fast-forward: skip the current step (timer or reps), go next.
    skip() {
        if (this.state === SessionState.Completed || this.state === SessionState.Idle) return;
        this.advance();
    }

    // Go back one step when possible.
    back() {
        if (this.state === SessionState.Idle) return;
        if (this.steps.length === 0) return;

        let target = this.index;

        if (this.state === SessionState.Completed) {
            if (target >= this.steps.length) target = this.steps.length - 1;
            if (target > 0 && this.steps[target]?.kind === StepKind.Completed) target -= 1;
        } else {
            target -= 1;
        }

        if (target < 0) return;

        this.index = target;
        this.state = SessionState.Transition;
        this.isPaused = false;
        this.targetTimeMs = undefined;
        this.remainingSecondsWhenPaused = undefined;
        this.enterCurrentStep();
        this.persist();
        this.emit();
    }

    // ---- persistence ----
    private persist() {
        const snap: EngineSnapshot = {
            state: this.state,
            steps: this.steps,
            index: this.index,
            isPaused: this.isPaused,
            targetTimeMs: this.targetTimeMs,
            remainingSecondsWhenPaused: this.remainingSecondsWhenPaused,
            startedAtMs: this.startedAtMs,
            elapsedBeforePauseMs: this.elapsedBeforePauseMs,
            stepStartedAtMs: this.stepStartedAtMs,
            stepElapsedBeforePauseMs: this.stepElapsedBeforePauseMs,
            exerciseStartedAtMs: this.exerciseStartedAtMs,
            exerciseElapsedBeforePauseMs: this.exerciseElapsedBeforePauseMs,
        };

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(snap));
        } catch {
            // ignore
        }
    }

    private restoreIfPossible() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const snap = JSON.parse(raw) as EngineSnapshot;

            this.state = snap.state ?? SessionState.Idle;
            this.steps = Array.isArray(snap.steps) ? snap.steps : [];
            this.index = Number.isFinite(snap.index) ? snap.index : 0;
            this.isPaused = Boolean(snap.isPaused);

            this.targetTimeMs = typeof snap.targetTimeMs === "number" ? snap.targetTimeMs : undefined;
            this.remainingSecondsWhenPaused =
                typeof snap.remainingSecondsWhenPaused === "number" ? snap.remainingSecondsWhenPaused : undefined;

            this.elapsedBeforePauseMs = typeof snap.elapsedBeforePauseMs === "number" ? snap.elapsedBeforePauseMs : 0;

            this.stepElapsedBeforePauseMs =
                typeof snap.stepElapsedBeforePauseMs === "number" ? snap.stepElapsedBeforePauseMs : 0;

            this.exerciseElapsedBeforePauseMs =
                typeof snap.exerciseElapsedBeforePauseMs === "number" ? snap.exerciseElapsedBeforePauseMs : 0;

            const midSession = this.state !== SessionState.Idle && this.state !== SessionState.Completed;

            this.startedAtMs = (!this.isPaused && midSession) ? Date.now() : undefined;
            this.stepStartedAtMs = (!this.isPaused && midSession) ? Date.now() : undefined;
            this.exerciseStartedAtMs = (!this.isPaused && midSession) ? Date.now() : undefined;

            if (midSession) {
                this.reconcileAfterBackground();
            }
        } catch {
            // ignore
        }
    }
}
