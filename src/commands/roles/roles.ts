import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PermissionBit, permissionBitsToList } from "#src/commands/shared/roles.js";
import { getConfig } from "#src/config.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("roles")
        .setDescription("View your roles"),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const config = getConfig();
        const id = interaction.user.id;
        const permissionsBits = config.userPermissions[id] ?? 0;

        await interaction.reply({
            content: permissionBitsToList(permissionsBits).join(", "),
            flags: MessageFlags.Ephemeral,
        });
    },
};
