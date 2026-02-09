import { useEffect, useState } from "react";
import type { SessionEngine } from "./sessionEngine";

export function useEngine(engine: SessionEngine) {
    const [, setTick] = useState(0);

    useEffect(() => {
        return engine.subscribe(() => setTick((x) => x + 1));
    }, [engine]);

    return engine.getSnapshot();
}
