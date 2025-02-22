const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { makeRequest } = require("../utils.js");
const config = require("../config.json");

module.exports = {
    modOnly: true,

    data: new SlashCommandBuilder()
        .setName("motd")
        .setDescription("Get or set the current message of the day.")
        .addStringOption(option =>
            option.setName("message")
                .setDescription("message of the day to set"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction) {
        var motd = interaction.options.getString("message");

        if (motd) {
            motd = motd.replace(/\\n/g, "\n");
            const [success, res] = await makeRequest("/api/motd", "POST", { secret: config["wfc-secret"], motd: motd });

            if (success)
                interaction.reply({ content: `Set message of the day to: "${motd}"` });
            else
                interaction.reply({ content: `Failed to set message of the day, error: ${res.Error ?? "no error message provided"}` });
        }
        else {
            const [success, res] = await makeRequest("/api/motd", "GET");

            if (success)
                interaction.reply({ content: `Current message of the day is:\n${res.Motd}` });
            else
                interaction.reply({ content: `Failed to fetch current message of the day, error: ${res.Error ?? "no error message provided"}` });
        }
    }
};
