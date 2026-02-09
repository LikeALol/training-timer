import { useEffect, useState } from "react";
import { PresetStore } from "../viewmodels/presetStore";
import { TabType } from "../models";
import { useStoreSubscription } from "../viewmodels/useStore";
import { PresetEditor } from "./PresetEditor";

export function PresetList(props: { tab: TabType; store: PresetStore }) {
    const { tab, store } = props;

    useStoreSubscription(store.subscribe.bind(store));

    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        store.ensureLoaded().then(() => {
            if (alive) setLoading(false);
        });
        return () => {
            alive = false;
        };
    }, [store]);

    if (loading) return <div>Loading…</div>;

    if (editingPresetId) {
        return (
            <PresetEditor
                presetId={editingPresetId}
                tab={tab}
                store={store}
                onBack={() => setEditingPresetId(null)}
            />
        );
    }

    const presets = store.list(tab);

    return (
        <div>
            <h2>Presets</h2>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New preset name"
                />
                <button
                    type="button"
                    onClick={async () => {
                        await store.create(tab, newName);
                        setNewName("");
                    }}
                >
                    Add
                </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                {presets.length === 0 ? (
                    <div>No presets yet.</div>
                ) : (
                    presets.map((p) => (
                        <div key={p.id} style={{ border: "1px solid currentColor", padding: 12 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <strong>{p.name}</strong>
                                <button type="button" onClick={() => setEditingPresetId(p.id)}>
                                    Edit
                                </button>
                                <button type="button" onClick={() => store.remove(p.id)}>
                                    Delete
                                </button>
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
        </div>
    );
}
