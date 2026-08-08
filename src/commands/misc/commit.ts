import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "#src/commands/shared/command.js";
import { commit } from "#src/commands/shared/commit.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("commit")
        .setDescription("View the currently deployed commit")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        await interaction.reply({ content: commit });
    },
};
