import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { makeRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateId } from "../utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to unban")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("unban reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("unban reason only visible to moderators"))
        .addBooleanOption(option => option.setName("hide-name")
            .setDescription("hide mii name in logs"))
        .addBooleanOption(option => option.setName("hide-public")
            .setDescription("hide public log message"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error unbanning friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        const hide = interaction.options.getBoolean("hide-name") ?? false;
        const hidePublic = interaction.options.getBoolean("hide-public") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/unban", "POST", { secret: config.wfcSecret, pid: pid });
        if (success) {
            await sendEmbedLog(interaction, "unban", fc, res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hide, hidePublic);
        }
        else
            await interaction.reply({ content: `Failed to unban friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
