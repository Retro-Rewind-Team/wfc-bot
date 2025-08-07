import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getStats } from "../services/stats.js";
import { getColor } from "../utils.js";

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Display status information for the Retro Rewind servers."),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const stats = getStats();

        if (!stats) {
            await interaction.reply({
                content: "Room data is not populated yet! Please wait a moment. If this keeps happening contact the bot owner."
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle("Retro Rewind Status")
            .setDescription("See https://status.rwfc.net/ or https://ppeb.me/RetroRewind/ for more information!")
            .addFields(
                { name: "Players Online", value: stats.global.online.toString() },
                { name: "Players Active", value: stats.global.active.toString() },
                { name: "Rooms Open", value: stats.global.groups.toString() }
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
