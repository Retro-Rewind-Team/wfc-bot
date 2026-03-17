import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { handleTrackAutocomplete, Track } from "./tt_utils.js";

const config = getConfig();

interface BKTResponse {
    id: number;
    trackName: string;
    playerName: string;
    finishTimeDisplay: string;
    fastestLapDisplay: string;
    cc: number;
    shroomless: boolean;
    glitch: boolean;
    isFlap: boolean;
    countryAlpha2: string;
    characterName: string;
    vehicleName: string;
    controllerName: string;
    driftTypeName: string;
    driftCategoryName: string;
    dateSet: string;
    lapSplitsDisplay?: string[];
}

interface FlapLeaderboardResponse {
    submissions: BKTResponse[];
}

interface ErrorResponse {
    message?: string;
    title?: string;
}

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("bkt")
        .setDescription("Get the Best Known Time for a track, or the best Flap run with the flap option")
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
        .addBooleanOption(option => option
            .setName("flap")
            .setDescription("Show the best flap run instead of the best finish time (default: false)")
            .setRequired(false))
        .addStringOption(option => option
            .setName("shroomless")
            .setDescription("Filter by shroomless runs")
            .setRequired(false)
            .addChoices(
                { name: "All runs", value: "all" },
                { name: "Shroomless only", value: "only" },
                { name: "Exclude shroomless", value: "exclude" }
            ))
        .addStringOption(option => option
            .setName("vehicle")
            .setDescription("Filter by vehicle type")
            .setRequired(false)
            .addChoices(
                { name: "All vehicles", value: "all" },
                { name: "Bikes only", value: "bikes" },
                { name: "Karts only", value: "karts" }
            ))
        .addStringOption(option => option
            .setName("drift")
            .setDescription("Filter by drift type (regular BKT only)")
            .setRequired(false)
            .addChoices(
                { name: "All drift types", value: "all" },
                { name: "Manual only", value: "manual" },
                { name: "Hybrid only", value: "hybrid" }
            ))
        .addStringOption(option => option
            .setName("drift_category")
            .setDescription("Filter by drift category (regular BKT only)")
            .setRequired(false)
            .addChoices(
                { name: "All drift categories", value: "all" },
                { name: "Inside drift only", value: "inside" },
                { name: "Outside drift only", value: "outside" }
            )),

    autocomplete: async function(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "track")
            await handleTrackAutocomplete(interaction);
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const trackId = parseInt(interaction.options.getString("track", true));
        const cc = interaction.options.getInteger("cc", true);
        const nonGlitchOnly = interaction.options.getBoolean("no_glitch") ?? false;
        const isFlap = interaction.options.getBoolean("flap") ?? false;
        const shroomless = interaction.options.getString("shroomless");
        const vehicle = interaction.options.getString("vehicle");
        const drift = interaction.options.getString("drift");
        const driftCategory = interaction.options.getString("drift_category");

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;

        const trackResponse = await fetch(`${leaderboardUrl}/api/timetrial/tracks/${trackId}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (!trackResponse.ok) {
            await interaction.editReply({ content: `Track with ID ${trackId} not found` });
            return;
        }

        const track = await trackResponse.json() as Track;

        let submission: BKTResponse | null = null;
        let response: Response;

        if (isFlap) {
            const params = new URLSearchParams({
                trackId: trackId.toString(),
                cc: cc.toString(),
                glitchAllowed: (!nonGlitchOnly).toString(),
                page: "1",
                pageSize: "1"
            });
            if (shroomless && shroomless !== "all") params.append("shroomless", shroomless);
            if (vehicle && vehicle !== "all") params.append("vehicle", vehicle);

            response = await fetch(`${leaderboardUrl}/api/timetrial/leaderboard/flap?${params}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${config.wfcSecret}` }
            });

            if (response.ok) {
                const data = await response.json() as FlapLeaderboardResponse;
                submission = data.submissions?.[0] ?? null;
            }
        }
        else {
            const params = new URLSearchParams({
                trackId: trackId.toString(),
                cc: cc.toString(),
                nonGlitchOnly: nonGlitchOnly.toString()
            });
            if (shroomless && shroomless !== "all") params.append("shroomless", shroomless);
            if (vehicle && vehicle !== "all") params.append("vehicle", vehicle);
            if (drift && drift !== "all") params.append("drift", drift);
            if (driftCategory && driftCategory !== "all") params.append("driftCategory", driftCategory);

            response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/bkt?${params}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${config.wfcSecret}` }
            });

            if (response.ok)
                submission = await response.json() as BKTResponse;
        }

        if (!response.ok) {
            if (response.status == 404) {
                const category = nonGlitchOnly ? "non-glitch/shortcut" : "unrestricted";
                await interaction.editReply({
                    content: `No ${isFlap ? "flap runs" : "times"} found for ${track.name} at ${cc}cc (${category})`
                });
            }
            else {
                const errorText = await response.text();
                let errorMessage: string;
                try {
                    const errorData = JSON.parse(errorText) as ErrorResponse;
                    errorMessage = errorData.message || errorData.title || response.statusText;
                }
                catch {
                    errorMessage = errorText || response.statusText;
                }
                await interaction.editReply({ content: `Failed to fetch BKT: ${errorMessage}` });
            }
            return;
        }

        if (!submission) {
            const category = nonGlitchOnly ? "non-glitch/shortcut" : "unrestricted";
            await interaction.editReply({
                content: `No ${isFlap ? "flap runs" : "times"} found for ${track.name} at ${cc}cc (${category})`
            });
            return;
        }

        const countryFlag = submission.countryAlpha2 ? `:flag_${submission.countryAlpha2.toLowerCase()}:` : "🌐";
        const ccBadge = submission.cc == 150 ? "150cc" : "200cc";
        let badges = `\`${ccBadge}\``;
        if (submission.shroomless) badges += " `Shroomless`";
        if (submission.glitch) badges += " `Glitch`";

        const appliedFilters: string[] = [];
        if (nonGlitchOnly) appliedFilters.push("Non-Glitch/Shortcut");
        if (shroomless == "only") appliedFilters.push("Shroomless Only");
        if (shroomless == "exclude") appliedFilters.push("No Shroomless");
        if (vehicle == "bikes") appliedFilters.push("Bikes Only");
        if (vehicle == "karts") appliedFilters.push("Karts Only");
        if (!isFlap && drift == "manual") appliedFilters.push("Manual Drift");
        if (!isFlap && drift == "hybrid") appliedFilters.push("Hybrid Drift");
        if (!isFlap && driftCategory == "inside") appliedFilters.push("Inside Drift");
        if (!isFlap && driftCategory == "outside") appliedFilters.push("Outside Drift");

        const filterText = appliedFilters.length > 0
            ? `\n**Filters:** ${appliedFilters.join(", ")}`
            : "";

        const driftInfo = `${submission.driftTypeName || "Unknown"} ${submission.driftCategoryName || ""}`.trim();
        const dateSet = new Date(submission.dateSet);

        const primaryTime = isFlap ? submission.fastestLapDisplay : submission.finishTimeDisplay;
        const secondaryLabel = isFlap ? "Finish Time" : "Fastest Lap";
        const secondaryTime = isFlap ? submission.finishTimeDisplay : submission.fastestLapDisplay;

        const embed = new EmbedBuilder()
            .setColor(isFlap ? 0xff8c00 : 0xffd700)
            .setTitle(`${isFlap ? "⚡ Best Flap Run" : "🏆 Best Known Time"}: ${track.name}`)
            .setDescription(`**${primaryTime}** by ${countryFlag} **${submission.playerName}**${filterText}`)
            .addFields(
                { name: isFlap ? "Fastest Lap" : "Time", value: primaryTime || "N/A", inline: true },
                { name: secondaryLabel, value: secondaryTime || "N/A", inline: true },
                { name: "Categories", value: badges, inline: true },
                { name: "Setup", value: `${submission.characterName || "Unknown"} + ${submission.vehicleName || "Unknown"}`, inline: true },
                { name: "Controller", value: submission.controllerName || "Unknown", inline: true },
                { name: "Drift", value: driftInfo, inline: true },
                { name: "Date Set", value: `<t:${Math.floor(dateSet.getTime() / 1000)}:D>`, inline: true },
                { name: "\u200B", value: "\u200B", inline: true },
                { name: "\u200B", value: "\u200B", inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Submission ID: ${submission.id}` });

        if (submission.lapSplitsDisplay && submission.lapSplitsDisplay.length > 0) {
            const lapSplits = submission.lapSplitsDisplay
                .map((time, index) => `Lap ${index + 1}: ${time}`)
                .join("\n");
            embed.addFields({ name: "Lap Splits", value: lapSplits, inline: false });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
