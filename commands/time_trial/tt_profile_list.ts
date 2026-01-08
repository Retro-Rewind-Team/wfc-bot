import { ActionRowBuilder, APIMessageTopLevelComponent, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { Dictionary } from "../../dictionary.js";
import { registerButtonHandlerByMessageID } from "../../index.js";
import { resolveModRestrictPermission } from "../../utils.js";

const config = getConfig();
const PROFILES_PER_PAGE = 10;

interface Profile {
    id: number;
    displayName: string;
    totalSubmissions: number;
    currentWorldRecords: number;
    countryAlpha2: string | null;
}

interface ProfileListResponse {
    profiles: Profile[];
}

interface ProfileListState {
    profiles: Profile[];
    currentPage: number;
    totalPages: number;
}

const stateByMessageID: Dictionary<ProfileListState> = {};

const firstButton = new ButtonBuilder()
    .setCustomId("tt_profile_first")
    .setLabel("⏮️")
    .setStyle(ButtonStyle.Primary);

const prevButton = new ButtonBuilder()
    .setCustomId("tt_profile_prev")
    .setLabel("◀️")
    .setStyle(ButtonStyle.Primary);

const nextButton = new ButtonBuilder()
    .setCustomId("tt_profile_next")
    .setLabel("▶️")
    .setStyle(ButtonStyle.Primary);

const lastButton = new ButtonBuilder()
    .setCustomId("tt_profile_last")
    .setLabel("⏭️")
    .setStyle(ButtonStyle.Primary);

export default {
    bktOnly: true,
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_profile_list")
        .setDescription("List all Time Trial profiles")
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        await interaction.deferReply();

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/profiles`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${config.wfcSecret}` }
        });

        if (response.ok) {
            const result = await response.json() as ProfileListResponse;
            const profiles = result.profiles;

            if (profiles.length == 0) {
                await interaction.editReply({ content: "No TT profiles found." });
                return;
            }

            const totalPages = Math.ceil(profiles.length / PROFILES_PER_PAGE);

            // Function to create embed for a specific page
            const createEmbed = (page: number) => {
                const start = page * PROFILES_PER_PAGE;
                const end = start + PROFILES_PER_PAGE;
                const pageProfiles = profiles.slice(start, end);

                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("📋 Time Trial Profiles")
                    .setDescription(`Total profiles: ${profiles.length}`)
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                    .setTimestamp();

                pageProfiles.forEach((profile: Profile) => {
                    const countryFlag = profile.countryAlpha2 ? `:flag_${profile.countryAlpha2.toLowerCase()}:` : "🌐";
                    embed.addFields({
                        name: `${countryFlag} ${profile.displayName}`,
                        value: `ID: \`${profile.id}\` | Submissions: ${profile.totalSubmissions} | WRs: ${profile.currentWorldRecords}`,
                        inline: false
                    });
                });

                return embed;
            };

            if (totalPages > 1) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        firstButton.setDisabled(true),
                        prevButton.setDisabled(true),
                        nextButton.setDisabled(false),
                        lastButton.setDisabled(false)
                    );

                const res = await interaction.editReply({
                    embeds: [createEmbed(0)],
                    components: [row as unknown as APIMessageTopLevelComponent]
                });

                const message = await res.fetch();

                registerButtonHandlerByMessageID(
                    message.id,
                    300000,
                    (messageID) => {
                        delete stateByMessageID[messageID];
                    },
                    handleButton
                );

                stateByMessageID[message.id] = {
                    profiles: profiles,
                    currentPage: 0,
                    totalPages: totalPages
                };
            }
            else {
                await interaction.editReply({
                    embeds: [createEmbed(0)]
                });
            }
        }
        else {
            await interaction.editReply({
                content: `Failed to fetch profiles: ${response.statusText}`
            });
        }
    }
};

async function handleButton(buttonInteraction: ButtonInteraction<CacheType>) {
    const state = stateByMessageID[buttonInteraction.message.id];

    let newPage = state.currentPage;

    switch (buttonInteraction.customId) {
    case "tt_profile_first":
        newPage = 0;
        break;
    case "tt_profile_prev":
        newPage = Math.max(0, state.currentPage - 1);
        break;
    case "tt_profile_next":
        newPage = Math.min(state.totalPages - 1, state.currentPage + 1);
        break;
    case "tt_profile_last":
        newPage = state.totalPages - 1;
        break;
    }

    state.currentPage = newPage;

    const start = newPage * PROFILES_PER_PAGE;
    const end = start + PROFILES_PER_PAGE;
    const pageProfiles = state.profiles.slice(start, end);

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📋 Time Trial Profiles")
        .setDescription(`Total profiles: ${state.profiles.length}`)
        .setFooter({ text: `Page ${newPage + 1} of ${state.totalPages}` })
        .setTimestamp();

    pageProfiles.forEach((profile: Profile) => {
        const countryFlag = profile.countryAlpha2 ? `:flag_${profile.countryAlpha2.toLowerCase()}:` : "🌐";
        embed.addFields({
            name: `${countryFlag} ${profile.displayName}`,
            value: `ID: \`${profile.id}\` | Submissions: ${profile.totalSubmissions} | WRs: ${profile.currentWorldRecords}`,
            inline: false
        });
    });

    const row = new ActionRowBuilder()
        .addComponents(
            firstButton.setDisabled(newPage == 0),
            prevButton.setDisabled(newPage == 0),
            nextButton.setDisabled(newPage == state.totalPages - 1),
            lastButton.setDisabled(newPage == state.totalPages - 1)
        );

    buttonInteraction.update({
        embeds: [embed],
        components: [row as unknown as APIMessageTopLevelComponent]
    });
}
