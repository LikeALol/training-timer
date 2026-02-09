import { useEffect, useState } from "react";
import type { GlobalTimer } from "./globalTimer";

export function useGlobalTimer(timer: GlobalTimer) {
    const [, setTick] = useState(0);

    useEffect(() => timer.subscribe(() => setTick((x) => x + 1)), [timer]);

    return timer.getSnapshot();
}
