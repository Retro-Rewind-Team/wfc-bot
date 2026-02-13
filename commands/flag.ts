import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("flag")
        .setDescription("Mark a user as suspicious")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to flag")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("reason for flagging this user")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();
        const reason = interaction.options.getString("reason", true);

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error flagging friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const moderator = interaction.user.id;
        const fc = pidToFc(pid);

        // Call leaderboard API to flag the player
        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const leaderboardResponse = await fetch(`${leaderboardUrl}/api/moderation/flag`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.wfcSecret}`
                },
                body: JSON.stringify({
                    pid: pid.toString(),
                    moderator: moderator,
                    reason: reason
                })
            });

            if (leaderboardResponse.ok) {
                await interaction.reply({
                    content: `Successfully flagged player with friend code "${fc}" as suspicious.`
                });
                console.log(`Successfully flagged player ${pid} for reason: ${reason}`);
            }
            else {
                const errorText = await leaderboardResponse.text();
                console.error(`Failed to flag player ${pid}: ${leaderboardResponse.status}`);
                console.error(`Error details: ${errorText}`);

                await interaction.reply({
                    content: `Failed to flag friend code "${fc}": error ${leaderboardResponse.status}`
                });
            }
        }
        catch (error) {
            console.error(`Error calling leaderboard API for player ${pid}:`, error);
            await interaction.reply({
                content: `Failed to flag friend code "${fc}": network error`
            });
        }
    }
};
