import { Command } from "#src/commands/shared/command.js";
import { recover } from "#src/commands/shared/recover.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { resolveModRestrictPermission } from "#src/utils.js";
import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const command: Command = {
    permissions: PermissionBit.PROFILE_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("force_recover")
        .setDescription("Recover any friend code on an rksys.dat save")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to recover")
            .setRequired(true))
        .addIntegerOption(option => option
            .setName("license")
            .setDescription("The license to replace (1-4)")
            .setMinValue(1)
            .setMaxValue(4)
            .setRequired(true))
        .addAttachmentOption(option => option
            .setName("rksys")
            .setDescription("The rksys.dat save to modify")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        await recover(interaction, false);
    },
};
