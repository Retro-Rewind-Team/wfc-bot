import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { handleProfileAutocomplete } from "./tt_utils.js";

const config = getConfig();

interface DeleteProfileResponse {
    message: string;
}

export default {
    bktOnly: true,
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_profile_delete")
        .setDescription("Delete a Time Trial profile (must have no submissions)")
        .addStringOption(option => option
            .setName("profile")
            .setDescription("Profile to delete")
            .setRequired(true)
            .setAutocomplete(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "profile")
            await handleProfileAutocomplete(interaction);

    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const profileId = interaction.options.getString("profile", true);

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/profile/${profileId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (response.ok) {
            const result = await response.json() as DeleteProfileResponse;

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("🗑️ TT Profile Deleted")
                .setDescription(result.message)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
        else {
            const errorData = await response.json() as DeleteProfileResponse;
            await interaction.editReply({
                content: `Failed to delete profile: ${errorData.message || response.statusText}`
            });
        }
    }
};
