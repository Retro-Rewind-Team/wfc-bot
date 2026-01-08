import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { handleProfileAutocomplete, handleTrackAutocomplete } from "./tt_utils.js";

const config = getConfig();

interface Submission {
    id: number;
    playerName: string;
    trackName: string;
    finishTimeDisplay: string;
    cc: number;
    driftCategory: number;
    shroomless: boolean;
    glitch: boolean;
    countryAlpha2: string | null;
    dateSet: string;
}

interface SearchSubmissionsResponse {
    submissions: Submission[];
}

interface ErrorResponse {
    message?: string;
}

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_search_submissions")
        .setDescription("Search ghost submissions with filters")
        .addStringOption(option => option
            .setName("profile")
            .setDescription("Player profile (optional)")
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option => option
            .setName("track")
            .setDescription("Track (optional)")
            .setRequired(false)
            .setAutocomplete(true))
        .addIntegerOption(option => option
            .setName("cc")
            .setDescription("CC (optional)")
            .setRequired(false)
            .addChoices(
                { name: "150cc", value: 150 },
                { name: "200cc", value: 200 }
            ))
        .addIntegerOption(option => option
            .setName("drift_category")
            .setDescription("Drift category (optional)")
            .setRequired(false)
            .addChoices(
                { name: "Outside", value: 0 },
                { name: "Inside", value: 1 }
            ))
        .addBooleanOption(option => option
            .setName("glitch")
            .setDescription("Glitch/shortcut runs only (optional)")
            .setRequired(false))
        .addBooleanOption(option => option
            .setName("shroomless")
            .setDescription("Shroomless runs only (optional)")
            .setRequired(false))
        .addIntegerOption(option => option
            .setName("limit")
            .setDescription("Number of results (default: 25)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "profile") {
            await handleProfileAutocomplete(interaction);
        } else if (focusedOption.name == "track") {
            await handleTrackAutocomplete(interaction);
        }
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const profileId = interaction.options.getString("profile");
        const trackId = interaction.options.getString("track");
        const cc = interaction.options.getInteger("cc");
        const driftCategory = interaction.options.getInteger("drift_category");
        const glitch = interaction.options.getBoolean("glitch");
        const shroomless = interaction.options.getBoolean("shroomless");
        const limit = interaction.options.getInteger("limit") ?? 25;

        const params = new URLSearchParams();
        if (profileId) params.append("ttProfileId", profileId);
        if (trackId) params.append("trackId", trackId);
        if (cc != null) params.append("cc", cc.toString());
        if (driftCategory != null) params.append("driftCategory", driftCategory.toString());
        if (glitch != null) params.append("glitch", glitch.toString());
        if (shroomless != null) params.append("shroomless", shroomless.toString());
        params.append("limit", limit.toString());

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/submissions/search?${params.toString()}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (response.ok) {
            const result = await response.json() as SearchSubmissionsResponse;
            const submissions = result.submissions;

            if (submissions.length == 0) {
                await interaction.editReply({ content: "No submissions found matching your filters." });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("🔍 Submission Search Results")
                .setDescription(`Found ${submissions.length} submission(s)`)
                .setTimestamp();

            submissions.forEach((sub: Submission) => {
                const countryFlag = sub.countryAlpha2 ? `:flag_${sub.countryAlpha2.toLowerCase()}:` : "🌍";
                const ccBadge = sub.cc == 150 ? "150cc" : "200cc";
                const driftBadge = sub.driftCategory == 0 ? "Outside" : "Inside";
                let badges = `\`${ccBadge}\` \`${driftBadge}\``;
                if (sub.shroomless) badges += " `Shroomless`";
                if (sub.glitch) badges += " `Glitch`";

                const dateSet = new Date(sub.dateSet);
                const timestamp = `<t:${Math.floor(dateSet.getTime() / 1000)}:R>`;

                embed.addFields({
                    name: `${sub.trackName} - ${sub.finishTimeDisplay}`,
                    value: `**ID:** \`${sub.id}\` | ${countryFlag} ${sub.playerName}\n${badges} | **Date Set:** ${timestamp}`,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const errorData = await response.json() as ErrorResponse;
            await interaction.editReply({
                content: `Failed to search submissions: ${errorData.message || response.statusText}`
            });
        }
    }
};
