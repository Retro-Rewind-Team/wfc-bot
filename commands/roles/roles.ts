import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PermissionBit, permissionBitsToList } from "../shared/roles.js";
import { getConfig } from "../../config.js";

export default {
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
            flags: MessageFlags.Ephemeral
        });
    }
};
