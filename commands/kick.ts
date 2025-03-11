import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { makeRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateId } from "../utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user")
        .addStringOption(option =>
            option.setName("id")
                .setDescription("friend code or pid to kick")
                .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("kick reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("kick reason only visible to moderators"))
        .addBooleanOption(option =>
            option.setName("hide-name")
                .setDescription("hide mii name in logs"))
        .addBooleanOption(option =>
            option.setName("hide-public")
                .setDescription("hide public log message"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error kicking friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        const hide = interaction.options.getBoolean("hide-name") ?? false;
        const hidePublic = interaction.options.getBoolean("hide-public") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/kick", "POST", { secret: config.wfcSecret, pid: pid, reason: reason });
        if (success) {
            await sendEmbedLog(interaction, "kick", fc, res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hide, hidePublic);
        }
        else
            await interaction.reply({ content: `Failed to kick friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
