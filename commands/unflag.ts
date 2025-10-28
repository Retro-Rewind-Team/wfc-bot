import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("unflag")
        .setDescription("Remove suspicious flag from a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to unflag")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error unflagging friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const moderator = interaction.user.id;
        const fc = pidToFc(pid);

        // Call leaderboard API to unflag the player
        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const leaderboardResponse = await fetch(`${leaderboardUrl}/api/moderation/unflag`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.wfcSecret}`
                },
                body: JSON.stringify({
                    pid: pid.toString(),
                    moderator: moderator
                })
            });

            if (leaderboardResponse.ok) {
                await interaction.reply({ 
                    content: `Successfully removed suspicious flag from player with friend code "${fc}"` 
                });
                console.log(`Successfully unflagged player ${pid}`);
            } else {
                const errorText = await leaderboardResponse.text();
                console.error(`Failed to unflag player ${pid}: ${leaderboardResponse.status}`);
                console.error(`Error details: ${errorText}`);
                await interaction.reply({ content: `Failed to unflag friend code "${fc}": error ${leaderboardResponse.status}` });
            }
        } catch (error) {
            console.error(`Error calling leaderboard API for player ${pid}:`, error);
            await interaction.reply({ content: `Failed to unflag friend code "${fc}": network error` });
        }
    }
};