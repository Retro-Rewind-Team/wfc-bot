import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { handleTrackAutocomplete } from "./tt_utils.js";

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
    countryAlpha2: string;
    characterName: string;
    vehicleName: string;
    controllerName: string;
    driftTypeName: string;
    driftCategoryName: string;
    dateSet: string;
    lapSplitsDisplay?: string[];
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
        .setDescription("Get the Best Known Time (World Record) for a track with optional filters")
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
            .setDescription("Filter by drift type")
            .setRequired(false)
            .addChoices(
                { name: "All drift types", value: "all" },
                { name: "Manual only", value: "manual" },
                { name: "Hybrid only", value: "hybrid" }
            ))
        .addStringOption(option => option
            .setName("drift_category")
            .setDescription("Filter by drift category")
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
        const shroomless = interaction.options.getString("shroomless");
        const vehicle = interaction.options.getString("vehicle");
        const drift = interaction.options.getString("drift");
        const driftCategory = interaction.options.getString("drift_category");

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;

        const params = new URLSearchParams({
            trackId: trackId.toString(),
            cc: cc.toString(),
            nonGlitchOnly: nonGlitchOnly.toString()
        });

        if (shroomless && shroomless != "all")
            params.append("shroomless", shroomless);

        if (vehicle && vehicle != "all")
            params.append("vehicle", vehicle);

        if (drift && drift != "all")
            params.append("drift", drift);

        if (driftCategory && driftCategory != "all")
            params.append("driftCategory", driftCategory);


        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/bkt?${params}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (response.ok) {
            const wr = await response.json() as BKTResponse;

            const countryFlag = wr.countryAlpha2 ? `:flag_${wr.countryAlpha2.toLowerCase()}:` : "🌐";
            const ccBadge = wr.cc == 150 ? "150cc" : "200cc";

            let badges = `\`${ccBadge}\``;
            if (wr.shroomless) badges += " `Shroomless`";
            if (wr.glitch) badges += " `Glitch`";

            const appliedFilters: string[] = [];
            if (nonGlitchOnly) appliedFilters.push("Non-Glitch/Shortcut");
            if (shroomless == "only") appliedFilters.push("Shroomless Only");
            if (shroomless == "exclude") appliedFilters.push("No Shroomless");
            if (vehicle == "bikes") appliedFilters.push("Bikes Only");
            if (vehicle == "karts") appliedFilters.push("Karts Only");
            if (drift == "manual") appliedFilters.push("Manual Drift");
            if (drift == "hybrid") appliedFilters.push("Hybrid Drift");
            if (driftCategory == "inside") appliedFilters.push("Inside Drift");
            if (driftCategory == "outside") appliedFilters.push("Outside Drift");

            const filterText = appliedFilters.length > 0
                ? `\n**Filters:** ${appliedFilters.join(", ")}`
                : "";

            const dateSet = new Date(wr.dateSet);

            const driftInfo = `${wr.driftTypeName || "Unknown"} ${wr.driftCategoryName || ""}`.trim();

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle(`🏆 Best Known Time: ${wr.trackName}`)
                .setDescription(`**${wr.finishTimeDisplay}** by ${countryFlag} **${wr.playerName}**${filterText}`)
                .addFields(
                    { name: "Time", value: wr.finishTimeDisplay || "N/A", inline: true },
                    { name: "Fastest Lap", value: wr.fastestLapDisplay || "N/A", inline: true },
                    { name: "Categories", value: badges, inline: true },
                    { name: "Setup", value: `${wr.characterName || "Unknown"} + ${wr.vehicleName || "Unknown"}`, inline: true },
                    { name: "Controller", value: wr.controllerName || "Unknown", inline: true },
                    { name: "Drift", value: driftInfo, inline: true },
                    { name: "Date Set", value: `<t:${Math.floor(dateSet.getTime() / 1000)}:D>`, inline: true },
                    { name: "\u200B", value: "\u200B", inline: true },
                    { name: "\u200B", value: "\u200B", inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Submission ID: ${wr.id}` });

            if (wr.lapSplitsDisplay && wr.lapSplitsDisplay.length > 0) {
                const lapSplits = wr.lapSplitsDisplay
                    .map((time: string, index: number) => `Lap ${index + 1}: ${time}`)
                    .join("\n");
                embed.addFields({ name: "Lap Splits", value: lapSplits, inline: false });
            }

            await interaction.editReply({ embeds: [embed] });
        }
        else if (response.status == 404) {
            await interaction.editReply({
                content: "No times found matching the specified filters"
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

            await interaction.editReply({
                content: `Failed to fetch BKT: ${errorMessage}`
            });
        }
    }
};
