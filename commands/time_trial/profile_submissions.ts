import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { handleProfileAutocomplete } from "./tt_utils.js";

const config = getConfig();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_profile_submissions")
        .setDescription("List recent submissions for a TT profile")
        .addStringOption(option => option
            .setName("profile")
            .setDescription("Player profile")
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option => option
            .setName("limit")
            .setDescription("Number of submissions to show (default: 10)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === "profile") {
            await handleProfileAutocomplete(interaction);
        }
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const profileId = interaction.options.getString("profile", true);
        const limit = interaction.options.getInteger("limit") ?? 10;

        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        try {
            const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/submissions/search?ttProfileId=${profileId}&limit=${limit}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${config.wfcSecret}` }
            });

            if (response.ok) {
                const result = await response.json();
                const submissions = result.submissions;

                if (submissions.length === 0) {
                    await interaction.editReply({ content: "No submissions found for this profile." });
                    return;
                }

                const playerName = submissions[0].playerName;
                const countryFlag = submissions[0].countryAlpha2 ? `:flag_${submissions[0].countryAlpha2.toLowerCase()}:` : "🌐";

                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle(`🏁 Recent Submissions: ${countryFlag} ${playerName}`)
                    .setDescription(`Showing ${submissions.length} most recent submission(s)`)
                    .setTimestamp();

                submissions.forEach((sub: any) => {
                    const ccBadge = sub.cc === 150 ? "150cc" : "200cc";
                    const driftBadge = sub.driftCategory === 0 ? "Outside" : "Inside";
                    let badges = `\`${ccBadge}\` \`${driftBadge}\``;
                    if (sub.shroomless) badges += " `Shroomless`";
                    if (sub.glitch) badges += " `Glitch`";

                    const submittedDate = new Date(sub.submittedAt);
                    const timestamp = `<t:${Math.floor(submittedDate.getTime() / 1000)}:R>`;

                    embed.addFields({
                        name: `${sub.trackName} - ${sub.finishTimeDisplay}`,
                        value: `**ID:** \`${sub.id}\` | ${badges}\n**Submitted:** ${timestamp}`,
                        inline: false
                    });
                });

                await interaction.editReply({ embeds: [embed] });
            } else {
                const errorData = await response.json();
                await interaction.editReply({
                    content: `Failed to fetch submissions: ${errorData.message || response.statusText}`
                });
            }
        } catch (error) {
            console.error("Error fetching profile submissions:", error);
            await interaction.editReply({
                content: "Network error while fetching submissions"
            });
        }
    }
};
