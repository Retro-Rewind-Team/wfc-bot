import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolvePidFromString, validateID } from "#src/utils.js";
import { Command } from "#src/commands/shared/command.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { fetchStatsEmbed } from "#src/commands/shared/stats_embed.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show detailed statistics for a player")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to check")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error checking friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        await interaction.deferReply();

        const [embed, statsErr] = await fetchStatsEmbed(pid);

        if (embed)
            await interaction.editReply({ embeds: [embed] });
        else {
            await interaction.editReply({
                content: `Failed to retrieve stats for friend code "${fc}": ${statsErr}`,
            });
        }
    },
};
