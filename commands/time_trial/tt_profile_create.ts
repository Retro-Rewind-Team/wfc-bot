import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { handleCountryAutocomplete } from "./tt_utils.js";

const config = getConfig();

interface Profile {
    id: number;
    displayName: string;
    countryName: string | null;
}

interface CreateProfileResponse {
    profile: Profile;
}

interface CreateProfileRequest {
    displayName: string;
    countryCode?: number;
}

interface ErrorResponse {
    message?: string;
}

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_profile_create")
        .setDescription("Create a new Time Trial profile")
        .addStringOption(option => option
            .setName("display_name")
            .setDescription("Player display name (2-50 characters)")
            .setRequired(true))
        .addStringOption(option => option
            .setName("country")
            .setDescription("Country (optional)")
            .setRequired(false)
            .setAutocomplete(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "country") {
            await handleCountryAutocomplete(interaction);
        }
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const displayName = interaction.options.getString("display_name", true).trim();
        const countryCode = interaction.options.getString("country");

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const body: CreateProfileRequest = { displayName };
        if (countryCode) {
            body.countryCode = parseInt(countryCode);
        }

        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/profile/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.wfcSecret}`
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const result = await response.json() as CreateProfileResponse;
            const profile = result.profile;

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle("✅ TT Profile Created")
                .setDescription(`Profile **${profile.displayName}** has been created successfully!`)
                .addFields(
                    { name: "Profile ID", value: profile.id.toString(), inline: true },
                    { name: "Display Name", value: profile.displayName, inline: true },
                    { name: "Country", value: profile.countryName || "Not set", inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            const errorData = await response.json() as ErrorResponse;
            await interaction.editReply({
                content: `Failed to create profile: ${errorData.message || response.statusText}`
            });
        }
    }
};
