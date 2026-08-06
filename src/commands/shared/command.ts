import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, SharedSlashCommand } from "discord.js";
import { FeatureFlag } from "#src/feature_flags.js";

export interface Command {
    featureFlags?: FeatureFlag[];
    permissions: number;
    data: SharedSlashCommand;
    init?: () => Promise<void>;
    autocomplete?: (_: AutocompleteInteraction<CacheType>) => Promise<void>;
    exec: (_: ChatInputCommandInteraction<CacheType>) => Promise<void>;
}

export interface SharedInitializer {
    featureFlags?: FeatureFlag[];
    init: () => Promise<void>;
}
