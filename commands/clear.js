const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { makeRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateId } = require("../utils.js");
const config = require("../config.json");

module.exports = {
    modOnly: true,

    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear a user from the database")
        .addStringOption(option =>
            option.setName("id")
                .setDescription("friend code or pid to clear")
                .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("clear reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("clear reason only visible to moderators"))
        .addBooleanOption(option =>
            option.setName("hide-name")
                .setDescription("hide mii name in logs"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction) {
        var id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error clearing friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        const hide = interaction.options.getBoolean("hide-name") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/clear", "POST", { secret: config["wfc-secret"], pid: pid });
        if (success) {
            sendEmbedLog(interaction, "clear", fc, res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hide);
        }
        else
            interaction.reply({ content: `Failed to clear friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
