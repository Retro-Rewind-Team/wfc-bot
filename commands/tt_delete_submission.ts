import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { resolveModRestrictPermission } from "../utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_delete_submission")
        .setDescription("Delete a Time Trial ghost submission")
        .addIntegerOption(option => option
            .setName("submission_id")
            .setDescription("The submission ID to delete")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const submissionId = interaction.options.getInteger("submission_id", true);

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/submission/${submissionId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${config.wfcSecret}` }
            });

            if (response.ok) {
                const result = await response.json();

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("🗑️ Ghost Submission Deleted")
                    .setDescription(result.message)
                    .addFields(
                        { name: "Submission ID", value: submissionId.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const errorData = await response.json();
                await interaction.editReply({
                    content: `Failed to delete submission: ${errorData.message || response.statusText}`
                });
            }
        } catch (error) {
            console.error("Error deleting submission:", error);
            await interaction.editReply({
                content: "Network error while deleting submission"
            });
        }
    }
};