import { _fetch as fetch } from "#src/fetch.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { BadgeType, listBadges } from "./badges.js";
import { getColor, getMiiImageURL, pidToFc } from "../../utils.js";

const config = getConfig();

export enum StatsSectionFlag {
    RANK = 1 << 0,
    RACESTATS = 1 << 1,
    BADGES = 1 << 2,
    ALL = 0b111,
}

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
    badges: BadgeType[];
}

function formatVRChange(change: number): string {
    if (change > 0)
        return `+${change}`;
    if (change < 0)
        return `${change}`;

    return `${change}`;
}

export async function fetchStatsEmbed(
    pid: number | string,
    flags: StatsSectionFlag = StatsSectionFlag.ALL
): Promise<[EmbedBuilder | null, string | null]> {
    const fc = typeof pid == "number" ? pidToFc(pid) : pidToFc(parseInt(pid));

    const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
    try {
        const response = await fetch(`${leaderboardUrl}/api/racestats/player/${pid}/full`, {
            method: "GET",
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to get stats for ${pid}: ${response.status}`);
            console.error(`Error details: ${errorText}`);
            return [null, `Failed to retrieve stats for friend code "${fc}": error ${response.status}`];
        }

        const stats = await response.json() as PlayerStatsResponse;
        const lastSeenDate = new Date(stats.lastSeen);

        const embed = new EmbedBuilder()
            .setColor(stats.isSuspicious ? 0xff0000 : getColor())
            .setTitle(`📊 Player Stats: ${stats.name || "Unknown"}`)
            .setDescription(`**Friend Code:** \`${fc}\`\n**Player ID:** \`${stats.pid}\`\n\u200B`)
            .setThumbnail(getMiiImageURL(fc));

        if (flags & StatsSectionFlag.RANK) {
            embed.addFields(
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
        }

        if (stats.raceStats && flags & StatsSectionFlag.RACESTATS) {
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
            );
        }

        if (flags & StatsSectionFlag.BADGES && stats.badges && stats.badges.length != 0) {
            if (flags != StatsSectionFlag.BADGES)
                embed.addFields({ name: "\u200B", value: "" });

            const badgeNames = listBadges(stats.badges);
            embed.addFields({
                name: "Badges",
                value: badgeNames,
                inline: true
            });

        }

        embed.addFields({ name: "\u200B", value: "" });
        embed
            .setTimestamp()
            .setFooter({
                text: stats.isSuspicious
                    ? "⚠ This player has been flagged as suspicious"
                    : "Retro Rewind Leaderboard"
            });

        return [embed, null];
    }
    catch (error) {
        console.error(`Error calling leaderboard API for player ${pid}:`, error);
        return [null, `Error calling leaderboard API for player ${pid}: ${error}`];
    }
}
