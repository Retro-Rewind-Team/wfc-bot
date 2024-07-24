const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { fcToPid, makeRequest, makeUrl, sendEmbedLog, validateFc } = require("../utils.js");

module.exports = {
    modOnly: true,

    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user")
        .addStringOption(option =>
            option.setName("friend-code")
                .setDescription("friend code to kick")
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction) {
        var fc = interaction.options.getString("friend-code", true);
        fc = fc.trim();

        if (!validateFc(fc)) {
            await interaction.reply({ content: `Error banning friend code "${fc}": Friend code is not in the correct format` });
            return;
        }

        var pid = fcToPid(fc);

        var url = makeUrl("kick", `&pid=${pid}`);

        if (makeRequest(interaction, fc, url))
            sendEmbedLog(interaction, "kick", fc);
    }
};
