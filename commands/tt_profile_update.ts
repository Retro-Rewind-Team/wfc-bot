import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { resolveModRestrictPermission } from "../utils.js";
import { handleProfileAutocomplete, handleCountryAutocomplete } from "../tt-utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_profile_update")
        .setDescription("Update a Time Trial profile")
        .addStringOption(option => option
            .setName("profile")
            .setDescription("Profile to update")
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option => option
            .setName("display_name")
            .setDescription("New display name (optional)")
            .setRequired(false))
        .addStringOption(option => option
            .setName("country")
            .setDescription("New country (optional)")
            .setRequired(false)
            .setAutocomplete(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === "profile") {
            await handleProfileAutocomplete(interaction);
        } else if (focusedOption.name === "country") {
            await handleCountryAutocomplete(interaction);
        }
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const profileId = interaction.options.getString("profile", true);
        const displayName = interaction.options.getString("display_name");
        const countryCode = interaction.options.getString("country");

        if (!displayName && !countryCode) {
            await interaction.reply({
                content: "You must provide at least one field to update (display_name or country)",
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const body: any = {};
            if (displayName) body.displayName = displayName.trim();
            if (countryCode) body.countryCode = parseInt(countryCode);

            const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/profile/${profileId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.wfcSecret}`
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                const profile = result.profile;

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle("✅ TT Profile Updated")
                    .setDescription(`Profile **${profile.displayName}** has been updated successfully!`)
                    .addFields(
                        { name: "Profile ID", value: profile.id.toString(), inline: true },
                        { name: "Display Name", value: profile.displayName, inline: true },
                        { name: "Country", value: profile.countryName || "Not set", inline: true },
                        { name: "Submissions", value: profile.totalSubmissions.toString(), inline: true },
                        { name: "World Records", value: profile.currentWorldRecords.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const errorData = await response.json();
                await interaction.editReply({
                    content: `Failed to update profile: ${errorData.message || response.statusText}`
                });
            }
        } catch (error) {
            console.error("Error updating TT profile:", error);
            await interaction.editReply({
                content: "Network error while updating profile"
            });
        }
    }
};