import { ActionRowBuilder, APIMessageTopLevelComponent, ButtonInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { Dictionary } from "../../dictionary.js";
import { registerButtonHandlerByMessageID } from "../../index.js";
import { PermissionBit } from "../shared/roles.js";
import { getNavigationButtons, newIndexFromButtonInteraction, validateButtonInteraction } from "../shared/buttons.js";

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

export default {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("tt_profile_list")
        .setDescription("List all Time Trial profiles"),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
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
            const createEmbed = (page: number): EmbedBuilder => {
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
                    .addComponents(getNavigationButtons(interaction.user.id));

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

async function handleButton(buttonInteraction: ButtonInteraction<CacheType>): Promise<void> {
    if (!await validateButtonInteraction(buttonInteraction))
        return;

    const state = stateByMessageID[buttonInteraction.message.id];

    const maxPage = state.totalPages - 1;
    const newPage = newIndexFromButtonInteraction(
        buttonInteraction,
        state.currentPage,
        maxPage,
    );

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
            getNavigationButtons(
                buttonInteraction.user.id,
                state.currentPage,
                maxPage
            )
        );

    await buttonInteraction.update({
        embeds: [embed],
        components: [row as unknown as APIMessageTopLevelComponent]
    });
}
