import { Config } from "./config.js";

export const DefaultFeatureFlags = {
    selfCommand: false,
    serverSideVR: false,
};

export type FeatureFlag = keyof typeof DefaultFeatureFlags

export function migrateConfigFeatureFlags(config: Config): boolean {
    if (!config.featureFlags) {
        config.featureFlags = DefaultFeatureFlags;
        return true;
    }

    let ret = false;

    for (const key of Object.keys(DefaultFeatureFlags) as FeatureFlag[]) {
        if (typeof config.featureFlags[key] == "undefined") {
            config.featureFlags[key] = false;
            ret = true;
        }
    }

    return ret;
}

export function shouldEnable(
    required: FeatureFlag[] | null,
    set: Record<FeatureFlag, boolean>
): [boolean, FeatureFlag[]] {
    if (!required || required.length == 0)
        return [true, []];

    let success = true;
    const missing: FeatureFlag[] = [];

    const requiredFlags = Object.values(required);
    for (const flag of requiredFlags) {
        if (!set[flag]) {
            success = false;
            missing.push(flag);
        }
    }

    return [success, missing];
}
