import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "../../utils.js";
import { getConfig } from "../../config.js";
import { PermissionBit } from "../shared/roles.js";

const config = getConfig();

export default {
    permissions: PermissionBit.PROFILE_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear a user from the database")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to clear")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("clear reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("clear reason only visible to moderators"))
        .addBooleanOption(option => option.setName("hide-mii")
            .setDescription("hide mii and mii name in logs"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error clearing friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        const hideMii = interaction.options.getBoolean("hide-mii") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/clear", "POST", { secret: config.wfcSecret, pid: pid });
        if (success) {
            await sendEmbedLog(interaction, "clear", res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hideMii, true);
        }
        else
            await interaction.reply({ content: `Failed to clear friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
