import { _fetch as fetch } from "#src/fetch.js";
import { Command } from "#src/commands/shared/command.js";
import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { handleProfileAutocomplete } from "#src/commands/time_trial/tt_utils.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

const config = getConfig();

interface Profile {
    id: number;
    displayName: string;
    totalSubmissions: number;
    currentWorldRecords: number;
    countryAlpha2: string | null;
    countryName: string | null;
}

interface ProfileResponse {
    profile: Profile;
}

interface ErrorResponse {
    message?: string;
}

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("tt_profile_view")
        .setDescription("View details of a Time Trial profile")
        .addStringOption(option => option
            .setName("profile")
            .setDescription("Player profile")
            .setRequired(true)
            .setAutocomplete(true)),

    autocomplete: async function(interaction: AutocompleteInteraction): Promise<void> {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "profile")
            await handleProfileAutocomplete(interaction);
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const profileId = interaction.options.getString("profile", true);

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/profile/${profileId}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` },
        });

        if (response.ok) {
            const result = await response.json() as ProfileResponse;
            const profile = result.profile;

            const countryFlag = profile.countryAlpha2 ? `:flag_${profile.countryAlpha2.toLowerCase()}:` : "🌐";

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`${countryFlag} ${profile.displayName}`)
                .setDescription(`Profile ID: \`${profile.id}\``)
                .addFields(
                    { name: "Total Submissions", value: profile.totalSubmissions.toString(), inline: true },
                    { name: "Current World Records", value: profile.currentWorldRecords.toString(), inline: true },
                    { name: "Country", value: profile.countryName || "Not set", inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
        else {
            const errorData = await response.json() as ErrorResponse;
            await interaction.editReply({
                content: `Failed to fetch profile: ${errorData.message || response.statusText}`,
            });
        }
    },
};
