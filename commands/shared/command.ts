import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder } from "discord.js";

export interface Command {
    permissions: number,
    data: SlashCommandOptionsOnlyBuilder,
    init?: () => Promise<void>,
    autocomplete?: (_: AutocompleteInteraction<CacheType>) => Promise<void>,
    exec: (_: ChatInputCommandInteraction<CacheType>) => Promise<void>,
}
