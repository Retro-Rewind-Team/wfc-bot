import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { handleTrackAutocomplete, Track } from "./tt_utils.js";

const config = getConfig();

interface LeaderboardResponse {
    fastestLapMs: number | null;
    fastestLapDisplay: string | null;
}

interface Submission {
    id: number;
    playerName: string;
    trackName: string;
    finishTimeDisplay: string;
    fastestLapDisplay: string;
    cc: number;
    shroomless: boolean;
    glitch: boolean;
    countryAlpha2: string;
    characterName: string;
    vehicleName: string;
    controllerName: string;
    driftTypeName: string;
    driftCategoryName: string;
    dateSet: string;
    lapSplitsMs: number[] | null;
    lapSplitsDisplay?: string[] | null;
}

interface SearchResponse {
    submissions: Submission[];
}

interface ErrorResponse {
    message?: string;
    title?: string;
}

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("bkt_flap")
        .setDescription("Get the Fastest Lap (FLAP) for a track")
        .addStringOption(option => option
            .setName("track")
            .setDescription("Track")
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option => option
            .setName("cc")
            .setDescription("CC")
            .setRequired(true)
            .addChoices(
                { name: "150cc", value: 150 },
                { name: "200cc", value: 200 }
            ))
        .addBooleanOption(option => option
            .setName("no_glitch")
            .setDescription("Only show non-glitch/shortcut runs (default: unrestricted)")
            .setRequired(false))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "track") {
            await handleTrackAutocomplete(interaction);
        }
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const trackId = parseInt(interaction.options.getString("track", true));
        const cc = interaction.options.getInteger("cc", true);
        const nonGlitchOnly = interaction.options.getBoolean("no_glitch") ?? false;

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;

        const trackResponse = await fetch(`${leaderboardUrl}/api/timetrial/tracks/${trackId}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (!trackResponse.ok) {
            await interaction.editReply({
                content: `Track with ID ${trackId} not found`
            });
            return;
        }

        const track = await trackResponse.json() as Track;

        const response = await fetch(
            `${leaderboardUrl}/api/timetrial/leaderboard?trackId=${trackId}&cc=${cc}&glitch=${!nonGlitchOnly}&page=1&pageSize=1`,
            {
                method: "GET",
                headers: { "Authorization": `Bearer ${config.wfcSecret}` }
            }
        );

        if (response.ok) {
            const data = await response.json() as LeaderboardResponse;

            if (!data.fastestLapMs) {
                const category = nonGlitchOnly ? "non-glitch/shortcut" : "unrestricted";
                await interaction.editReply({
                    content: `No lap times found for ${track.name} at ${cc}cc (${category})`
                });
                return;
            }

            const flapMs = data.fastestLapMs;
            const flapDisplay = data.fastestLapDisplay;

            let searchUrl = `${leaderboardUrl}/api/moderation/timetrial/submissions/search?trackId=${trackId}&cc=${cc}&limit=100`;
            if (nonGlitchOnly) {
                searchUrl += `&glitch=false`;
            }

            const searchResponse = await fetch(
                searchUrl,
                {
                    method: "GET",
                    headers: { "Authorization": `Bearer ${config.wfcSecret}` }
                }
            );

            if (!searchResponse.ok) {
                await interaction.editReply({
                    content: `Found fastest lap (${flapDisplay}) but couldn't retrieve submission details`
                });
                return;
            }

            const searchData = await searchResponse.json() as SearchResponse;

            if (!searchData.submissions || searchData.submissions.length === 0) {
                await interaction.editReply({
                    content: `Found fastest lap (${flapDisplay}) but no submissions were found matching the criteria`
                });
                return;
            }

            let flapSubmission: Submission | null = null;
            for (const submission of searchData.submissions) {
                if (submission.lapSplitsMs && submission.lapSplitsMs.length > 0) {
                    const minLap = Math.min(...submission.lapSplitsMs);
                    if (minLap === flapMs) {
                        flapSubmission = submission;
                        break;
                    }
                }
            }

            if (!flapSubmission) {
                await interaction.editReply({
                    content: `Fastest lap found (${flapDisplay}) but couldn't locate the submission`
                });
                return;
            }

            const countryFlag = flapSubmission.countryAlpha2 ? `:flag_${flapSubmission.countryAlpha2.toLowerCase()}:` : "🌍";
            const ccBadge = cc == 150 ? "150cc" : "200cc";

            let badges = `\`${ccBadge}\``;
            if (flapSubmission.shroomless) badges += " `Shroomless`";
            if (flapSubmission.glitch) badges += " `Glitch`";

            const driftInfo = `${flapSubmission.driftTypeName || "Unknown"} ${flapSubmission.driftCategoryName || ""}`.trim();
            const dateSet = new Date(flapSubmission.dateSet);

            const embed = new EmbedBuilder()
                .setColor(0xff6b6b)
                .setTitle(`⚡ Fastest Lap: ${track.name}`)
                .setDescription(`**${flapDisplay}** by ${countryFlag} **${flapSubmission.playerName}**\n*From their finish time of ${flapSubmission.finishTimeDisplay}*`)
                .addFields(
                    { name: "Fastest Lap", value: flapDisplay || "N/A", inline: true },
                    { name: "Full Run Time", value: flapSubmission.finishTimeDisplay || "N/A", inline: true },
                    { name: "Categories", value: badges, inline: true },
                    { name: "Setup", value: `${flapSubmission.characterName || "Unknown"} + ${flapSubmission.vehicleName || "Unknown"}`, inline: true },
                    { name: "Controller", value: flapSubmission.controllerName || "Unknown", inline: true },
                    { name: "Drift", value: driftInfo, inline: true },
                    { name: "Date Set", value: `<t:${Math.floor(dateSet.getTime() / 1000)}:D>`, inline: true },
                    { name: "\u200B", value: "\u200B", inline: true },
                    { name: "\u200B", value: "\u200B", inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Submission ID: ${flapSubmission.id}` });

            if (flapSubmission.lapSplitsDisplay && flapSubmission.lapSplitsDisplay.length > 0) {
                const lapSplits = flapSubmission.lapSplitsDisplay
                    .map((time: string, index: number) => {
                        const isFastest = flapSubmission.lapSplitsMs?.[index] == flapMs;
                        return isFastest ? `**Lap ${index + 1}: ${time}** ⚡` : `Lap ${index + 1}: ${time}`;
                    })
                    .join("\n");
                embed.addFields({ name: "Lap Splits", value: lapSplits, inline: false });
            }

            await interaction.editReply({ embeds: [embed] });
        } else if (response.status == 404) {
            const category = nonGlitchOnly ? "non-glitch/shortcut" : "unrestricted";
            await interaction.editReply({
                content: `No times found for ${track.name} at ${cc}cc (${category})`
            });
        } else {
            const errorText = await response.text();
            let errorMessage: string;
            try {
                const errorData = JSON.parse(errorText) as ErrorResponse;
                errorMessage = errorData.message || errorData.title || response.statusText;
            } catch {
                errorMessage = errorText || response.statusText;
            }

            await interaction.editReply({
                content: `Failed to fetch fastest lap: ${errorMessage}`
            });
        }
    }
};
