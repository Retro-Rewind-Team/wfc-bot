import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";

const config = getConfig();

interface DeleteResponse {
    message: string;
}

export default {
    bktOnly: true,
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_delete_submission")
        .setDescription("Delete a Time Trial ghost submission")
        .addIntegerOption(option => option
            .setName("submission_id")
            .setDescription("The submission ID to delete")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const submissionId = interaction.options.getInteger("submission_id", true);

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/submission/${submissionId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (response.ok) {
            const result = await response.json() as DeleteResponse;

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("🗑️ Ghost Submission Deleted")
                .setDescription(result.message)
                .addFields(
                    { name: "Submission ID", value: submissionId.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
        else {
            const errorData = await response.json() as DeleteResponse;
            await interaction.editReply({
                content: `Failed to delete submission: ${errorData.message || response.statusText}`
            });
        }
    }
};
