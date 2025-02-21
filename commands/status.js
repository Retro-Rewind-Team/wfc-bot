const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getStats } = require("../index.js");
const { getColor } = require("../utils.js");

module.exports = {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Display status information for the Retro Rewind servers."),

    exec: async function(interaction) {
        const stats = getStats();

        if (!stats) {
            interaction.reply("Room data is not populated yet! Please wait a moment. If this keeps happening contact the bot owner.");
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle("Retro Rewind Status")
            .setDescription("See https://ppeb.me/RetroRewind/ for more information!")
            .addFields(
                {
                    name: "Players Online",
                    value: stats.global.online.toString()
                },
                {
                    name: "Players Active",
                    value: stats.global.active.toString()
                },
                {
                    name: "Rooms Open",
                    value: stats.global.groups.toString()
                }
            );

        interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
