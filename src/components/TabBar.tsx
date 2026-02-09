import { TabType } from "../models";

export function TabBar(props: { tab: TabType; onChange: (t: TabType) => void }) {
    const { tab, onChange } = props;

    return (
        <div
            style={{
                borderTop: "1px solid currentColor",
                display: "flex",
                gap: 8,
                padding: 12,
                justifyContent: "space-between",
            }}
        >
            <button type="button" onClick={() => onChange(TabType.PreMobility)} disabled={tab === TabType.PreMobility}>
                Pre-Mobility
            </button>
            <button type="button" onClick={() => onChange(TabType.Workout)} disabled={tab === TabType.Workout}>
                Workout
            </button>
            <button type="button" onClick={() => onChange(TabType.PostMobility)} disabled={tab === TabType.PostMobility}>
                Post-Mobility
            </button>
        </div>
    );
}
