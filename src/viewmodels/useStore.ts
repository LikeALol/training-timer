import { useEffect, useState } from "react";

export function useStoreSubscription(subscribe: (fn: () => void) => () => void) {
    const [, setTick] = useState(0);

    useEffect(() => {
        return subscribe(() => setTick((x) => x + 1));
    }, [subscribe]);
}
