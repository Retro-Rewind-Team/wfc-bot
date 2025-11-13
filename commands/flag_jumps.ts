import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getColor, pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("flag_jumps")
        .setDescription("Show suspicious VR jumps for a player")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to check")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ 
                content: `Error checking friend code or pid "${id}": ${err}`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const leaderboardResponse = await fetch(`${leaderboardUrl}/api/moderation/suspicious-jumps/${pid}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${config.wfcSecret}`
                }
            });

            if (leaderboardResponse.ok) {
                const res = await leaderboardResponse.json();

                if (res.count === 0) {
                    await interaction.editReply({
                        content: `No suspicious VR jumps found for player ${res.player.name} (${fc})`
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(getColor())
                    .setTitle(`Suspicious VR Jumps for ${res.player.name}`)
                    .setDescription(`Friend Code: ${fc}\nTotal Suspicious Jumps: ${res.count}\nCurrently Flagged: ${res.player.isSuspicious ? "Yes" : "No"}`)
                    .setTimestamp();

                const jumpsToShow = res.suspiciousJumps.slice(0, 25);
                for (const jump of jumpsToShow) {
                    const date = new Date(jump.date);
                    const dateStr = date.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    });

                    embed.addFields({
                        name: dateStr,
                        value: `Change: ${jump.vrChange > 0 ? "+" : ""}${jump.vrChange} VR → Total: ${jump.totalVR} VR`,
                        inline: true
                    });
                }

                if (res.count > 25) {
                    embed.setFooter({ text: `Showing 25 of ${res.count} suspicious jumps` });
                }

                await interaction.editReply({ embeds: [embed] });
            } else {
                const errorText = await leaderboardResponse.text();
                console.error(`Failed to get suspicious jumps for ${pid}: ${leaderboardResponse.status}`);
                console.error(`Error details: ${errorText}`);
                await interaction.editReply({
                    content: `Failed to retrieve suspicious jumps for friend code "${fc}": error ${leaderboardResponse.status}`
                });
            }
        } catch (error) {
            console.error(`Error calling leaderboard API for player ${pid}:`, error);
            await interaction.editReply({
                content: `Failed to retrieve suspicious jumps for friend code "${fc}": network error`
            });
        }
    }
};