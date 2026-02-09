import { useEffect, useState } from "react";
import { TabType } from "../models";
import { PresetStore } from "../viewmodels/presetStore";
import { useStoreSubscription } from "../viewmodels/useStore";

export function ExecutionScreen(props: { tab: TabType; store: PresetStore }) {
    const { tab, store } = props;

    useStoreSubscription(store.subscribe.bind(store));

    const storageKey = `selectedPresetId.${tab}`;
    const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
        return localStorage.getItem(storageKey) ?? "";
    });

    // When tab changes, load the stored selection for that tab.
    useEffect(() => {
        const key = `selectedPresetId.${tab}`;
        setSelectedPresetId(localStorage.getItem(key) ?? "");
    }, [tab]);

    const presets = store.list(tab);
    const selected = selectedPresetId ? store.getById(selectedPresetId) : undefined;

    // If the selected preset no longer exists (deleted), clear it + storage.
    useEffect(() => {
        if (selectedPresetId && !selected) {
            localStorage.removeItem(storageKey);
            setSelectedPresetId("");
        }
    }, [selectedPresetId, selected, storageKey]);

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

            <div style={{ marginTop: 12, border: "1px solid currentColor", padding: 12 }}>
                <div>Selected: {selected ? selected.name : "-"}</div>
                <div>State: idle</div>
                <div>Elapsed: 00:00</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" disabled>
                        Start
                    </button>
                    <button type="button" disabled>
                        Pause
                    </button>
                    <button type="button" disabled>
                        Reset
                    </button>
                    {tab === TabType.Workout ? (
                        <button type="button" disabled>
                            Set Done
                        </button>
                    ) : null}
                </div>

                <div style={{ marginTop: 8, fontSize: 12 }}>
                    Real SessionEngine + timers arrive in Step 3.
                </div>
            </div>
        </div>
    );
}
