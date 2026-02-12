export const TabType = {
    PreMobility: "preMobility",
    Workout: "workout",
    PostMobility: "postMobility",
} as const;

export type TabType = typeof TabType[keyof typeof TabType];

export const ExerciseMode = {
    Time: "time",
    Reps: "reps",
} as const;

export type ExerciseMode = typeof ExerciseMode[keyof typeof ExerciseMode];
export type WorkoutKind = "individual" | "plan";

export type Exercise = {
    id: string;
    name: string;

    mode: ExerciseMode;
    durationSeconds: number; // if time
    reps: number;            // if reps

    sets: number;
    perSide: boolean;

    setupSeconds?: number; // optional

    restSecondsBetweenSets: number;
    restSecondsBetweenSides: number;

    warmupSets: number;   // workout only (0 otherwise)
    workingSets: number;  // workout only (0 otherwise)

    intensity: string; // e.g. "RPE 8" or "75%"
    weight: string;    // e.g. "100kg", "225 lb"
    tempo: string;     // "n.n.n" or "x"
};

export type WorkoutDayEntry = {
    exerciseId: string;
    warmupSets: number;
    sets: number;
    reps: number;
    intensity: string;
    weight: string;
    tempo: string;
    warmupRestSeconds: number;
    workingRestSeconds: number;
    restSeconds: number;
};

export type WorkoutDayPlan = {
    day: number;
    entries: WorkoutDayEntry[];
};

export type Workout = {
    id: string;
    name: string;
    tabType: TabType;
    kind: WorkoutKind;

    restBetweenExercisesSeconds: number; // mobility only

    exercises: Exercise[]; // ORDERED
    repeatCount: number;   // 1..4
    dayPlans: WorkoutDayPlan[];
};
