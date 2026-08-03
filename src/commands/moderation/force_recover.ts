import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { executeRecover } from "../shared/recover_command.js";
import { PermissionBit } from "../shared/roles.js";

export default {
    permissions: PermissionBit.PROFILE_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("force_recover")
        .setDescription("Recover any friend code on an rksys.dat save")
        .addAttachmentOption(option => option
            .setName("file")
            .setDescription("The rksys.dat save to modify")
            .setRequired(true))
        .addIntegerOption(option => option
            .setName("license")
            .setDescription("The license to replace (1-4)")
            .setMinValue(1)
            .setMaxValue(4)
            .setRequired(true))
        .addStringOption(option => option
            .setName("id")
            .setDescription("Friend code or profile ID to recover")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        await executeRecover(interaction, false);
    },
};
