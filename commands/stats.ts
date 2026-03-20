import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getColor, pidToFc, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

interface PlayerStatsResponse {
    pid: string;
    name: string;
    fc: string;
    vr: number;
    rank: number;
    lastSeen: string;
    isSuspicious: boolean;
    vrGain24h: number;
    vrGain7d: number;
    vrGain30d: number;
    raceStats: {
        totalRaces: number;
        trackedSince: string;
        topCombos: { name: string; raceCount: number }[];
        topTracks: { trackName: string; raceCount: number }[];
        avgFramesIn1stPerRace: number;
    } | null;
}

function formatVRChange(change: number): string {
    if (change > 0)
        return `+${change}`;
    if (change < 0)
        return `${change}`;

    return `${change}`;
}

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show detailed statistics for a player")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to check")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error checking friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;

        try {
            const response = await fetch(`${leaderboardUrl}/api/racestats/player/${pid}/full`, {
                method: "GET",
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to get stats for ${pid}: ${response.status}`);
                console.error(`Error details: ${errorText}`);
                await interaction.editReply({
                    content: `Failed to retrieve stats for friend code "${fc}": error ${response.status}`
                });
                return;
            }

            const stats = await response.json() as PlayerStatsResponse;
            const lastSeenDate = new Date(stats.lastSeen);

            const embed = new EmbedBuilder()
                .setColor(stats.isSuspicious ? 0xff0000 : getColor())
                .setTitle(`📊 Player Stats: ${stats.name || "Unknown"}`)
                .setDescription(`**Friend Code:** \`${fc}\`\n**Player ID:** \`${stats.pid}\`\n\u200B`)
                .setThumbnail(`https://${config.statusServer}/miiimg?fc=${fc}`)
                .addFields(
                    {
                        name: "🏆 Rating",
                        value: `**${stats.vr.toLocaleString()}** VR`,
                        inline: true
                    },
                    {
                        name: "📈 Rank",
                        value: `#${stats.rank.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: "📅 Last Seen",
                        value: `<t:${Math.floor(lastSeenDate.getTime() / 1000)}:R>`,
                        inline: true
                    },
                    { name: "\u200B", value: "" },
                    {
                        name: "VR Gain (24h)",
                        value: formatVRChange(stats.vrGain24h),
                        inline: true
                    },
                    {
                        name: "VR Gain (7d)",
                        value: formatVRChange(stats.vrGain7d),
                        inline: true
                    },
                    {
                        name: "VR Gain (30d)",
                        value: formatVRChange(stats.vrGain30d),
                        inline: true
                    }
                );

            if (stats.raceStats) {
                const trackedSince = new Date(stats.raceStats.trackedSince).toLocaleDateString("nl-NL");
                const topCombo = stats.raceStats.topCombos?.[0];
                const topTrack = stats.raceStats.topTracks?.[0];

                embed.addFields(
                    { name: "\u200B", value: "" },
                    {
                        name: `🎮 Race Stats (since ${trackedSince})`,
                        value: "\u200B",
                        inline: false
                    },
                    {
                        name: "Total Races",
                        value: stats.raceStats.totalRaces.toLocaleString(),
                        inline: true
                    },
                    {
                        name: "Avg Frames in 1st",
                        value: stats.raceStats.avgFramesIn1stPerRace.toFixed(1),
                        inline: true
                    },
                    { name: "\u200B", value: "\u200B", inline: true },
                    {
                        name: "Favourite Setup",
                        value: topCombo ? topCombo.name : "N/A",
                        inline: true
                    },
                    {
                        name: "Most Played Track",
                        value: topTrack ? `${topTrack.trackName} (${topTrack.raceCount}x)` : "N/A",
                        inline: true
                    },
                    { name: "\u200B", value: "\u200B", inline: true }
                );
            }

            embed
                .setTimestamp()
                .setFooter({
                    text: stats.isSuspicious
                        ? "⚠ This player has been flagged as suspicious"
                        : "Retro Rewind Leaderboard"
                });

            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error(`Error calling leaderboard API for player ${pid}:`, error);
            await interaction.editReply({
                content: `Failed to retrieve stats for friend code "${fc}": network error`
            });
        }
    }
};