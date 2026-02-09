import { useEffect, useRef, useState } from "react";
import { PresetStore } from "../viewmodels/presetStore";
import { TabType } from "../models";
import { useStoreSubscription } from "../viewmodels/useStore";
import { PresetEditor } from "./PresetEditor";
import { exportPresetsAsJson, importPresetsFromJsonFile } from "../io/presetIO";

export function PresetList(props: { tab: TabType; store: PresetStore }) {
    const { tab, store } = props;

    useStoreSubscription(store.subscribe.bind(store));

    const fileInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        setEditingPresetId(null);
    }, [tab]);

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

    const onExport = () => {
        exportPresetsAsJson(store.exportAllByTab());
    };

    const onImport = () => {
        fileInputRef.current?.click();
    };

    const onImportPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        const byTab = await importPresetsFromJsonFile(file);
        await store.importAllByTab(byTab);

        alert("Imported presets.");
    };

    return (
        <div>
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

                <button type="button" onClick={onExport}>Export (JSON)</button>
                <button type="button" onClick={onImport}>Import (JSON)</button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: "none" }}
                    onChange={onImportPicked}
                />
            </div>

            {/* Keep the rest of your list UI exactly as before */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                {store.list(tab).length === 0 ? (
                    <div>No presets yet.</div>
                ) : (
                    store.list(tab).map((p) => (
                        <div key={p.id} style={{ border: "1px solid currentColor", padding: 12 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <strong>{p.name}</strong>
                                <button type="button" onClick={() => setEditingPresetId(p.id)}>
                                    Edit
                                </button>
                                <button type="button" onClick={() => store.remove(p.id)}>
                                    Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const newId = await store.duplicatePreset(p.id);
                                        if (newId) setEditingPresetId(newId);
                                    }}
                                >
                                    Duplicate
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
