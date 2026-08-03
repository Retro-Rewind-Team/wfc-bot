import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder } from "discord.js";
import { FeatureFlag } from "../../feature_flags.js";

export interface Command {
    featureFlags?: FeatureFlag[]
    permissions: number,
    data: SlashCommandOptionsOnlyBuilder,
    init?: () => Promise<void>,
    autocomplete?: (_: AutocompleteInteraction<CacheType>) => Promise<void>,
    exec: (_: ChatInputCommandInteraction<CacheType>) => Promise<void>,
}
