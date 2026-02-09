import { useMemo, useState } from "react";
import { TabBar } from "./components/TabBar";
import { ExecutionScreen } from "./components/ExecutionScreen";
import { PresetList } from "./components/PresetList";
import { TabType } from "./models";
import { PresetStore } from "./viewmodels/presetStore";

export default function App() {
    const store = useMemo(() => new PresetStore(), []);
    const [tab, setTab] = useState<TabType>(TabType.PreMobility);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                <h1 style={{ marginTop: 0 }}>{tabTitle(tab)}</h1>

                <PresetList tab={tab} store={store} />

                <hr />

                <ExecutionScreen tab={tab} store={store} />
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
