import { CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder } from "discord.js";
import { getChannels, getConfig } from "../config.js";
import { getColor, getMiiImageURL, pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("swap")
        .setDescription("Swap all stats between two player licenses owned by the same person")
        .addStringOption(option => option.setName("source-id")
            .setDescription("friend code or pid of the first player")
            .setRequired(true))
        .addStringOption(option => option.setName("target-id")
            .setDescription("friend code or pid of the second player")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("reason for performing this swap")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let sourceId = interaction.options.getString("source-id", true).trim();
        let targetId = interaction.options.getString("target-id", true).trim();
        const reason = interaction.options.getString("reason", true);
        const moderator = interaction.user.id;

        const [validSource, errSource] = validateID(sourceId);
        if (!validSource) {
            await interaction.reply({ content: `Error swapping: invalid source ID "${sourceId}": ${errSource}` });
            return;
        }

        const [validTarget, errTarget] = validateID(targetId);
        if (!validTarget) {
            await interaction.reply({ content: `Error swapping: invalid target ID "${targetId}": ${errTarget}` });
            return;
        }

        const sourcePid = resolvePidFromString(sourceId);
        const targetPid = resolvePidFromString(targetId);

        if (sourcePid === targetPid) {
            await interaction.reply({ content: "Error swapping: source and target must be different players." });
            return;
        }

        const sourceFc = pidToFc(sourcePid);
        const targetFc = pidToFc(targetPid);

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const leaderboardResponse = await fetch(`${leaderboardUrl}/api/moderation/swap`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.wfcSecret}`
                },
                body: JSON.stringify({
                    sourcePid: sourcePid.toString(),
                    targetPid: targetPid.toString(),
                    moderator: moderator,
                    reason: reason
                })
            });

            if (leaderboardResponse.ok) {
                const member = interaction.member as GuildMember | null;

                const embed = new EmbedBuilder()
                    .setColor(getColor())
                    .setTitle(`Swap performed by ${member?.displayName ?? "Unknown"}`)
                    .setThumbnail(getMiiImageURL(sourceFc))
                    .addFields(
                        { name: "Server", value: interaction.guild!.name },
                        { name: "Moderator", value: `<@${member?.id ?? "Unknown"}>` },
                        { name: "Source FC", value: sourceFc },
                        { name: "Target FC", value: targetFc },
                        { name: "Reason", value: reason },
                    )
                    .setTimestamp();

                await getChannels().logs.send({ embeds: [embed] });
                await interaction.reply({
                    content: `Successfully swapped stats between "${sourceFc}" and "${targetFc}".`
                });
                console.log(`Successfully swapped stats between ${sourcePid} and ${targetPid} for reason: ${reason}`);
            }
            else {
                const errorText = await leaderboardResponse.text();
                console.error(`Failed to swap players ${sourcePid} <-> ${targetPid}: ${leaderboardResponse.status}`);
                console.error(`Error details: ${errorText}`);

                await interaction.reply({
                    content: `Failed to swap "${sourceFc}" and "${targetFc}": error ${leaderboardResponse.status}`
                });
            }
        }
        catch (error) {
            console.error(`Error calling leaderboard API for swap ${sourcePid} <-> ${targetPid}:`, error);
            await interaction.reply({
                content: `Failed to swap "${sourceFc}" and "${targetFc}": network error`
            });
        }
    }
};
