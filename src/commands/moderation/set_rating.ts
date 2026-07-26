import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "../../utils.js";
import { PermissionBit } from "../shared/roles.js";

const config = getConfig();

const ratingChoices = [
    { name: "VR", value: "vr" },
    { name: "BR", value: "br" },
    { name: "MMR RT", value: "mmr_rt" },
    { name: "MMR CT", value: "mmr_ct" },
    { name: "MMR Vanilla", value: "mmr_vanilla" },
];

const ratingLimits: Record<string, { min: number, max: number }> = {
    vr: { min: 100, max: 1000000 },
    br: { min: 100, max: 1000000 },
    mmr_rt: { min: 100, max: 30000 },
    mmr_ct: { min: 100, max: 30000 },
    mmr_vanilla: { min: 100, max: 30000 },
};

export default {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("setrating")
        .setDescription("Set one of a player's Mario Kart Wii ratings")
        .addStringOption(option => option.setName("friend-code")
            .setDescription("friend code or pid to update")
            .setRequired(true))
        .addStringOption(option => option.setName("rating-type")
            .setDescription("rating to update")
            .setRequired(true)
            .addChoices(...ratingChoices))
        .addIntegerOption(option => option.setName("rating")
            .setDescription("new rating amount")
            .setRequired(true)
            .setMinValue(100)
            .setMaxValue(1000000))
        .addStringOption(option => option.setName("reason")
            .setDescription("reason for updating the rating")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const id = interaction.options.getString("friend-code", true).trim();
        const ratingType = interaction.options.getString("rating-type", true);
        const value = interaction.options.getInteger("rating", true);
        const reason = interaction.options.getString("reason", true).trim();
        const label = ratingChoices.find(choice => choice.value == ratingType)?.name ?? ratingType;

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error updating ${label} for "${id}": ${err}` });
            return;
        }

        const limits = ratingLimits[ratingType];
        if (value < limits.min || value > limits.max) {
            await interaction.reply({ content: `${label} must be between ${limits.min.toLocaleString()} and ${limits.max.toLocaleString()}.` });
            return;
        }
        if (reason.length == 0) {
            await interaction.reply({ content: "A reason is required when changing a rating." });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const [success, response] = await makeWFCRequest("/set_mkw_rating", "POST", {
            secret: config.wfcSecret,
            pid,
            rating_type: ratingType,
            value,
            reason,
        });

        if (!success) {
            await interaction.reply({ content: `Failed to update ${label} for friend code "${fc}": error ${response.Error ?? response.error ?? "no error message provided"}` });
            return;
        }

        const user = response.User ?? response.user;
        const previous = response.PreviousValue ?? response.previous_value;
        if (!user || previous == undefined) {
            await interaction.reply({ content: `Failed to update ${label} for friend code "${fc}": server returned an unexpected response` });
            return;
        }

        await sendEmbedLog(interaction, `set ${label}`, user, [
            { name: `Previous ${label}`, value: Number(previous).toLocaleString() },
            { name: `New ${label}`, value: value.toLocaleString() },
            { name: "Reason", value: reason },
        ], false, true);
    },
};
