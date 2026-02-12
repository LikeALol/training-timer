import { useMemo, useState } from "react";
import { TabBar } from "./components/TabBar";
import { ExecutionScreen } from "./components/ExecutionScreen";
import { WorkoutList } from "./components/WorkoutList";
import { TabType } from "./models";
import { WorkoutStore } from "./viewmodels/workoutStore";
import { SessionEngine } from "./engine/sessionEngine";
import { GlobalTimer } from "./engine/globalTimer";
import { useGlobalTimer } from "./engine/useGlobalTimer";

export default function App() {
    const store = useMemo(() => new WorkoutStore(), []);

    const preEngine = useMemo(() => new SessionEngine(TabType.PreMobility), []);
    const workoutEngine = useMemo(() => new SessionEngine(TabType.Workout), []);
    const postEngine = useMemo(() => new SessionEngine(TabType.PostMobility), []);

    const globalTimer = useMemo(() => new GlobalTimer("globalTimer.v1"), []);
    const globalSnap = useGlobalTimer(globalTimer);

    const [tab, setTab] = useState<TabType>(TabType.PreMobility);

    const engine =
        tab === TabType.PreMobility ? preEngine : tab === TabType.Workout ? workoutEngine : postEngine;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            <div style={{ flex: 1, overflow: "auto" }}>
                <div style={{ padding: 12, maxWidth: 520, margin: "0 auto" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 20 }}>
                            {tabTitle(tab)}:{" "}
                            <span
                                style={{
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    fontSize: "0.75em",
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                }}
                            >
                {formatHms(globalSnap.elapsedSeconds)}
              </span>
                        </h1>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <button
                            style={{ flex: 1 }}
                            type="button"
                            onClick={() => globalTimer.start()}
                            disabled={globalSnap.isRunning}
                        >
                            Start
                        </button>
                        <button
                            style={{ flex: 1 }}
                            type="button"
                            onClick={() => globalTimer.pause()}
                            disabled={!globalSnap.isRunning}
                        >
                            Pause
                        </button>
                        <button style={{ flex: 1 }} type="button" onClick={() => globalTimer.reset()}>
                            Reset
                        </button>
                    </div>

                    <details style={{ marginBottom: 12 }}>
                        <summary style={{ cursor: "pointer" }}>Workouts</summary>
                        <div style={{ marginTop: 10 }}>
                            <WorkoutList tab={tab} store={store} />
                        </div>
                    </details>

                    <hr />

                    <details style={{ marginTop: 12 }} open>
                        <summary style={{ cursor: "pointer" }}>Execution</summary>
                        <div style={{ marginTop: 10 }}>
                            <ExecutionScreen tab={tab} store={store} engine={engine} />
                        </div>
                    </details>
                </div>
            </div>

            <TabBar tab={tab} onChange={setTab} />
        </div>
    );
}

function tabTitle(tab: TabType): string {
    switch (tab) {
        case TabType.PreMobility:
            return "Pre-Mobility";
        case TabType.Workout:
            return "Workout";
        case TabType.PostMobility:
            return "Post-Mobility";
    }
}

function formatHms(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
