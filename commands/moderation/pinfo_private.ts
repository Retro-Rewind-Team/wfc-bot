import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pinfo } from "../shared/pinfo.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { PermissionBit } from "../shared/roles.js";

export default {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("pinfo_private")
        .setDescription("Query information for a given player id")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        await pinfo(interaction, true);
    }
};
