type Listener = () => void;

type Snap = {
    isRunning: boolean;
    elapsedSeconds: number;
};

export class GlobalTimer {
    private listeners = new Set<Listener>();

    private isRunning = false;

    private startedAtMs?: number;
    private elapsedBeforeMs = 0;

    private tickHandle: number | null = null;

    private readonly storageKey: string;

    constructor(storageKey = "globalTimer.v1") {
        this.storageKey = storageKey;
        this.restore();
        this.startTicking();
    }

    subscribe(fn: Listener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private emit() {
        for (const fn of this.listeners) fn();
    }

    getSnapshot(): Snap {
        const now = Date.now();
        const elapsedMs =
            this.elapsedBeforeMs +
            (this.isRunning && this.startedAtMs ? now - this.startedAtMs : 0);

        return {
            isRunning: this.isRunning,
            elapsedSeconds: Math.floor(elapsedMs / 1000),
        };
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startedAtMs = Date.now();
        this.persist();
        this.emit();
    }

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.startedAtMs) {
            this.elapsedBeforeMs += Date.now() - this.startedAtMs;
        }
        this.startedAtMs = undefined;
        this.persist();
        this.emit();
    }

    reset() {
        this.isRunning = false;
        this.startedAtMs = undefined;
        this.elapsedBeforeMs = 0;
        try {
            localStorage.removeItem(this.storageKey);
        } catch {}
        this.emit();
    }

    private startTicking() {
        if (this.tickHandle != null) return;
        this.tickHandle = window.setInterval(() => {
            if (this.isRunning) this.emit();
        }, 250);
    }

    private persist() {
        try {
            localStorage.setItem(
                this.storageKey,
                JSON.stringify({
                    isRunning: this.isRunning,
                    elapsedBeforeMs: this.elapsedBeforeMs,
                    startedAtMs: this.startedAtMs ?? null,
                })
            );
        } catch {}
    }

    private restore() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const s = JSON.parse(raw);
            this.isRunning = Boolean(s?.isRunning);
            this.elapsedBeforeMs = Number.isFinite(s?.elapsedBeforeMs) ? s.elapsedBeforeMs : 0;

            // If it was running, resume from now (wall-clock correctness for elapsed isn’t critical)
            this.startedAtMs = this.isRunning ? Date.now() : undefined;
        } catch {}
    }
}
