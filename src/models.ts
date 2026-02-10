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
};

export type Workout = {
    id: string;
    name: string;
    tabType: TabType;

    restBetweenExercisesSeconds: number; // mobility only

    exercises: Exercise[]; // ORDERED
};
