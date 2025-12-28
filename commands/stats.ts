import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getColor, pidToFc, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

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
            const leaderboardResponse = await fetch(`${leaderboardUrl}/api/moderation/player-stats/${pid}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${config.wfcSecret}` },
            });

            if (leaderboardResponse.ok) {
                const res = await leaderboardResponse.json();
                const player = res.player;

                const lastSeenDate = new Date(player.lastSeen);

                const embed = new EmbedBuilder()
                    .setColor(player.isSuspicious ? 0xff0000 : getColor())
                    .setTitle(`📊 Player Stats: ${player.name || "Unknown"}`)
                    .setDescription(`**Friend Code:** \`${fc}\`\n**Player ID:** \`${player.pid}\`\n\u200B`)
                    .setThumbnail(`https://${config.statusServer}/miiimg?fc=${fc}`)
                    .addFields(
                        {
                            name: "🏆 VR Rating",
                            value: `**${player.vr.toLocaleString()}** VR`,
                            inline: true
                        },
                        {
                            name: "📈 Rank",
                            value: `#${player.rank.toLocaleString()}`,
                            inline: true
                        },
                        {
                            name: "⚠️ Flagged",
                            value: player.isSuspicious ? "Yes" : "No",
                            inline: true
                        },
                        { name: "\u200B", value: "" },
                        {
                            name: "📅 Last Seen",
                            value: `<t:${Math.floor(lastSeenDate.getTime() / 1000)}:R>`,
                            inline: true
                        },
                        { name: "\u200B", value: "\u200B", inline: true },
                        { name: "\u200B", value: "\u200B", inline: true },
                        { name: "\u200B", value: "" },
                        {
                            name: "VR Gain (24h)",
                            value: formatVRChange(player.vrStats.last24Hours),
                            inline: true
                        },
                        {
                            name: "VR Gain (7d)",
                            value: formatVRChange(player.vrStats.lastWeek),
                            inline: true
                        },
                        {
                            name: "VR Gain (30d)",
                            value: formatVRChange(player.vrStats.lastMonth),
                            inline: true
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text: player.isSuspicious ? "⚠ This player has been flagged as suspicious" : "Retro Rewind Leaderboard"
                    });

                await interaction.editReply({ embeds: [embed] });
            }
            else {
                const errorText = await leaderboardResponse.text();
                console.error(`Failed to get stats for ${pid}: ${leaderboardResponse.status}`);
                console.error(`Error details: ${errorText}`);
                await interaction.editReply({
                    content: `Failed to retrieve stats for friend code "${fc}": error ${leaderboardResponse.status}`
                });
            }
        }
        catch (error) {
            console.error(`Error calling leaderboard API for player ${pid}:`, error);
            await interaction.editReply({
                content: `Failed to retrieve stats for friend code "${fc}": network error`
            });
        }
    }
};