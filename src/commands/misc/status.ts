import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getColor } from "#src/utils.js";
import { Command } from "#src/commands/shared/command.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { getStats } from "#src/services/stats.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("Display status information for the Retro Rewind servers."),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const stats = getStats();

        if (!stats) {
            await interaction.reply({
                content: "Room data is not populated yet! Please wait a moment. If this keeps happening contact the bot owner.",
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
                { name: "Rooms Open", value: stats.global.groups.toString() },
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
