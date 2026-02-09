import { TabType } from "../models";

export function TabBar(props: { tab: TabType; onChange: (t: TabType) => void }) {
    const { tab, onChange } = props;

    return (
        <div
            style={{
                borderTop: "1px solid currentColor",
                display: "flex",
                padding: 8,
                gap: 8,
            }}
        >
            <TabButton
                label="Pre"
                active={tab === TabType.PreMobility}
                onClick={() => onChange(TabType.PreMobility)}
            />

            <TabButton
                label="Workout"
                active={tab === TabType.Workout}
                onClick={() => onChange(TabType.Workout)}
            />

            <TabButton
                label="Post"
                active={tab === TabType.PostMobility}
                onClick={() => onChange(TabType.PostMobility)}
            />
        </div>
    );
}

function TabButton(props: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    const { label, active, onClick } = props;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={active}
            style={{
                flex: 1,
                minWidth: 0,
                padding: "8px 0",
                fontSize: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </button>
    );
}
