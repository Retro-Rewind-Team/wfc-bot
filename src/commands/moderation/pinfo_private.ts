import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { resolveModRestrictPermission } from "#src/utils.js";
import { Command } from "#src/commands/shared/command.js";
import { pinfo } from "#src/commands/shared/pinfo.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("pinfo_private")
        .setDescription("Query information for a given player id")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve")
            .setRequired(true))
        .addBooleanOption(option => option.setName("verbose")
            .setDescription("display verbose fields"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        await pinfo(interaction, true);
    },
};
