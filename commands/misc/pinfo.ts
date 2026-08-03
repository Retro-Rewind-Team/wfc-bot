import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pinfo } from "../shared/pinfo.js";
import { PermissionBit } from "../shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("pinfo")
        .setDescription("Query information for a given player id")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        await pinfo(interaction, false);
    }
};
