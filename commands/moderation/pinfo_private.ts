import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pinfo } from "../shared/pinfo.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { PermissionBit } from "../shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("pinfo_private")
        .setDescription("Query information for a given player id")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        await pinfo(interaction, true);
    }
};
