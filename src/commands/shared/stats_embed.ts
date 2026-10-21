import { _fetch as fetch } from "#src/fetch.js";
import { EmbedBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { BadgeType, listBadges } from "#src/commands/shared/badges.js";
import { getColor, getMiiImageURL, pidToFc } from "#src/utils.js";

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
        topCharacters: { name: string; raceCount: number }[];
        topVehicles: { name: string; raceCount: number }[];
        topCombosByWinRate: { name: string; raceCount: number; winCount: number; winRate: number }[];
        topTracks: { trackName: string; raceCount: number }[];
        avgFramesIn1stPerRace: number;
        recentRaces: { trackName: string; finishPos: number | null }[];
    } | null;
    badges: BadgeType[];
}

const TOP_TRACK_COUNT = 3;
const RECENT_RACE_COUNT = 5;

function formatVRChange(change: number): string {
    if (change > 0)
        return `+${change}`;

    return `${change}`;
}

function ordinal(n: number): string {
    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13)
        return `${n}th`;

    switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
    }
}

function codeBlock(rows: [string, string][], alignRight = false): string {
    const leftWidth = Math.max(...rows.map(([left]) => left.length));
    const rightWidth = Math.max(...rows.map(([, right]) => right.length));

    const lines = rows.map(([left, right]) =>
        `${left.padEnd(leftWidth)}  ${alignRight ? right.padStart(rightWidth) : right}`);

    return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

export async function fetchStatsEmbed(
    pid: number | string,
    flags: StatsSectionFlag = StatsSectionFlag.ALL,
): Promise<[EmbedBuilder | null, string | null]> {
    const fc = typeof pid == "number" ? pidToFc(pid) : pidToFc(parseInt(pid));

    const leaderboardUrl = config.leaderboardAPIBase;
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
            .setTitle(stats.name || "Unknown")
            .setDescription(`Friend code \`${fc}\`\nPlayer ID \`${stats.pid}\``)
            .setThumbnail(getMiiImageURL(fc));

        if (flags & StatsSectionFlag.RANK) {
            embed.addFields(
                {
                    name: "Rating",
                    value: `${stats.vr.toLocaleString()} VR`,
                    inline: true,
                },
                {
                    name: "Rank",
                    value: `#${stats.rank.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: "Last seen",
                    value: `<t:${Math.floor(lastSeenDate.getTime() / 1000)}:R>`,
                    inline: true,
                },
                {
                    name: "VR (24h)",
                    value: formatVRChange(stats.vrGain24h),
                    inline: true,
                },
                {
                    name: "VR (7d)",
                    value: formatVRChange(stats.vrGain7d),
                    inline: true,
                },
                {
                    name: "VR (30d)",
                    value: formatVRChange(stats.vrGain30d),
                    inline: true,
                },
            );
        }

        if (stats.raceStats && flags & StatsSectionFlag.RACESTATS) {
            const race = stats.raceStats;
            const trackedSince = new Date(race.trackedSince).toLocaleDateString("nl-NL");
            const topCharacter = race.topCharacters?.[0];
            const topVehicle = race.topVehicles?.[0];
            const bestCombo = race.topCombosByWinRate?.[0];

            const summary: [string, string][] = [
                ["Races", race.totalRaces.toLocaleString()],
                ["Avg frames in 1st", race.avgFramesIn1stPerRace.toFixed(1)],
            ];
            if (topCharacter)
                summary.push(["Character", topCharacter.name]);
            if (topVehicle)
                summary.push(["Vehicle", topVehicle.name]);
            if (bestCombo)
                summary.push(["Best combo", `${bestCombo.name} (${Math.round(bestCombo.winRate * 100)}%)`]);

            embed.addFields({
                name: `Race stats (since ${trackedSince})`,
                value: codeBlock(summary),
            });

            const topTracks = race.topTracks?.slice(0, TOP_TRACK_COUNT) ?? [];
            if (topTracks.length != 0) {
                embed.addFields({
                    name: "Top tracks",
                    value: codeBlock(topTracks.map((t): [string, string] => [t.trackName, `${t.raceCount}x`]), true),
                });
            }

            const recentRaces = race.recentRaces?.slice(0, RECENT_RACE_COUNT) ?? [];
            if (recentRaces.length != 0) {
                embed.addFields({
                    name: "Recent races",
                    value: codeBlock(recentRaces.map((r): [string, string] => [
                        r.finishPos == null ? "-" : ordinal(r.finishPos),
                        r.trackName,
                    ])),
                });
            }
        }

        if (flags & StatsSectionFlag.BADGES && stats.badges && stats.badges.length != 0) {
            embed.addFields({
                name: "Badges",
                value: listBadges(stats.badges),
            });
        }

        embed
            .setTimestamp()
            .setFooter({
                text: stats.isSuspicious
                    ? "This player has been flagged as suspicious"
                    : "Retro Rewind Leaderboard",
            });

        return [embed, null];
    }
    catch (error) {
        console.error(`Error calling leaderboard API for player ${pid}:`, error);
        return [null, `Error calling leaderboard API for player ${pid}: ${error}`];
    }
}
