import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { makeRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

export default {
    modOnly: false,
    adminOnly: true,

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
        .addBooleanOption(option => option.setName("hide-name")
            .setDescription("hide mii name in logs"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
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
        const hide = interaction.options.getBoolean("hide-name") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/clear", "POST", { secret: config.wfcSecret, pid: pid });
        if (success) {
            await sendEmbedLog(interaction, "clear", fc, res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hide, true);
        }
        else
            await interaction.reply({ content: `Failed to clear friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
