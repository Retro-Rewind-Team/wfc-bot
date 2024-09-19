const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { makeRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateId } = require("../utils.js");
const config = require("../config.json");

module.exports = {
    modOnly: true,

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

    exec: async function(interaction) {
        var id = interaction.options.getString("id", true);
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
        const [success, res] = await makeRequest("/api/kick", "POST", { secret: config["wfc-secret"], pid: pid, reason: reason });
        if (success) {
            sendEmbedLog(interaction, "kick", fc, res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hide, hidePublic);
        }
        else
            interaction.reply({ content: `Failed to kick friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
