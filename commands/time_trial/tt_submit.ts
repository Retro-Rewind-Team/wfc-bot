import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { resolveModRestrictPermission } from "../../utils.js";
import { handleProfileAutocomplete, handleTrackAutocomplete } from "./tt_utils.js";

const config = getConfig();

interface SubmissionResponse {
    submission: {
        id: number;
        trackName: string;
        playerName: string;
        finishTimeDisplay: string;
        fastestLapDisplay: string;
        cc: number;
        driftCategory: number;
        shroomless: boolean;
        glitch: boolean;
        countryAlpha2: string | null;
        characterName: string;
        vehicleName: string;
        controllerName: string;
        driftTypeName: string;
    };
}

interface ErrorResponse {
    message?: string;
    title?: string;
}

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("tt_submit")
        .setDescription("Submit a Time Trial ghost file")
        .addAttachmentOption(option => option
            .setName("ghost_file")
            .setDescription("The .rkg ghost file")
            .setRequired(true))
        .addStringOption(option => option
            .setName("track")
            .setDescription("Track")
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option => option
            .setName("profile")
            .setDescription("Player profile")
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option => option
            .setName("cc")
            .setDescription("CC")
            .setRequired(true)
            .addChoices(
                { name: "150cc", value: 150 },
                { name: "200cc", value: 200 }
            ))
        .addIntegerOption(option => option
            .setName("drift_category")
            .setDescription("Drift category")
            .setRequired(true)
            .addChoices(
                { name: "Outside", value: 0 },
                { name: "Inside", value: 1 }
            ))
        .addBooleanOption(option => option
            .setName("shroomless")
            .setDescription("Shroomless run")
            .setRequired(false))
        .addBooleanOption(option => option
            .setName("glitch")
            .setDescription("Glitch/shortcut run")
            .setRequired(false))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    autocomplete: async function(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name == "track") {
            await handleTrackAutocomplete(interaction);
        } else if (focusedOption.name == "profile") {
            await handleProfileAutocomplete(interaction);
        }
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const ghostFile = interaction.options.getAttachment("ghost_file", true);
        const trackId = interaction.options.getString("track", true);
        const profileId = interaction.options.getString("profile", true);
        const cc = interaction.options.getInteger("cc", true);
        const driftCategory = interaction.options.getInteger("drift_category", true);
        const shroomless = interaction.options.getBoolean("shroomless") ?? false;
        const glitch = interaction.options.getBoolean("glitch") ?? false;

        if (!ghostFile.name.toLowerCase().endsWith(".rkg")) {
            await interaction.reply({
                content: "File must be a .rkg file",
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        const fileResponse = await fetch(ghostFile.url);
        if (!fileResponse.ok) {
            await interaction.editReply({
                content: `Error fetching ghost file: ${fileResponse.status}`
            });
            return;
        }

        const arrayBuffer = await fileResponse.arrayBuffer();

        // Create FormData
        const formData = new FormData();
        const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
        formData.append("ghostFile", blob, ghostFile.name);
        formData.append("trackId", trackId);
        formData.append("ttProfileId", profileId);
        formData.append("cc", cc.toString());
        formData.append("driftCategory", driftCategory.toString());
        formData.append("shroomless", shroomless.toString());
        formData.append("glitch", glitch.toString());

        const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;
        const response = await fetch(`${leaderboardUrl}/api/moderation/timetrial/submit`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.wfcSecret}`
            },
            body: formData
        });

        if (response.ok) {
            const result = await response.json() as SubmissionResponse;
            const submission = result.submission;

            const countryFlag = submission.countryAlpha2 ? `:flag_${submission.countryAlpha2.toLowerCase()}:` : "🌐";
            const ccBadge = submission.cc == 150 ? "150cc" : "200cc";
            const driftCategoryName = submission.driftCategory == 0 ? "Outside" : "Inside";
            const driftTypeWithCategory = `${submission.driftTypeName} ${driftCategoryName}`;

            let badges = `\`${ccBadge}\``;
            if (submission.shroomless) badges += " `Shroomless`";
            if (submission.glitch) badges += " `Glitch`";

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle("✅ Ghost Submitted")
                .setDescription(`**${submission.trackName}** - ${submission.finishTimeDisplay}`)
                .addFields(
                    { name: "Player", value: `${countryFlag} ${submission.playerName}`, inline: true },
                    { name: "Time", value: submission.finishTimeDisplay, inline: true },
                    { name: "Fastest Lap", value: submission.fastestLapDisplay || "N/A", inline: true },
                    { name: "Setup", value: `${submission.characterName} + ${submission.vehicleName}`, inline: true },
                    { name: "Controller", value: submission.controllerName, inline: true },
                    { name: "Drift Type", value: driftTypeWithCategory, inline: true },
                    { name: "Categories", value: badges, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Submission ID: ${submission.id}` });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const errorText = await response.text();
            let errorMessage: string;
            try {
                const errorData = JSON.parse(errorText) as ErrorResponse;
                errorMessage = errorData.message || errorData.title || response.statusText;
            } catch {
                errorMessage = errorText || response.statusText;
            }

            await interaction.editReply({
                content: `Failed to submit ghost: ${errorMessage}`
            });
        }
    }
};
