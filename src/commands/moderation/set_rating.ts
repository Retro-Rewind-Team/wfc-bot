import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { commandOptsFromEnum, makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "#src/utils.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { fetchPinfo } from "#src/commands/shared/pinfo.js";
import { Command } from "#src/commands/shared/command.js";

const config = getConfig();

interface MKWUserRating {
    VR: number;
    BR: number;
    MMR: {
        RetroTracks: number;
        CustomTracks: number;
        Vanilla: number;
    };
}

interface MKWRatingResponse {
    Rating: MKWUserRating;
    OldRating: MKWUserRating;
    Success: boolean;
    Error: string;
}

enum RatingType {
    VR,
    BR,
    MMR_RT,
    MMR_CT,
    MMR_VANILLA,
}

const ratingOpts = commandOptsFromEnum(RatingType);

const ratingLimits: Record<RatingType, { min: number; max: number }> = {
    [RatingType.VR]: { min: 100, max: 1000000 },
    [RatingType.BR]: { min: 100, max: 1000000 },
    [RatingType.MMR_RT]: { min: 100, max: 30000 },
    [RatingType.MMR_CT]: { min: 100, max: 30000 },
    [RatingType.MMR_VANILLA]: { min: 100, max: 30000 },
};

function mkwUserRatingGetByRatingType(rating: MKWUserRating, ratingType: RatingType): number {
    switch (ratingType) {
    case RatingType.VR:
        return rating.VR;
    case RatingType.BR:
        return rating.BR;
    case RatingType.MMR_RT:
        return rating.MMR.RetroTracks;
    case RatingType.MMR_CT:
        return rating.MMR.CustomTracks;
    case RatingType.MMR_VANILLA:
        return rating.MMR.Vanilla;
    }
}

export const command: Command = {
    permissions: PermissionBit.PROFILE_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("set_rating")
        .setDescription("Set one of a player's Mario Kart Wii ratings")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to update")
            .setRequired(true))
        .addIntegerOption(option => option.setName("rating-type")
            .setDescription("rating to update")
            .addChoices(ratingOpts)
            .setRequired(true))
        .addIntegerOption(option => option.setName("rating")
            .setDescription("new rating amount")
            .setMinValue(100)
            .setMaxValue(1000000)
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("reason for updating the rating")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const id = interaction.options.getString("id", true).trim();
        const ratingType: RatingType = interaction.options.getInteger("rating-type", true);
        const label = RatingType[ratingType];
        const value = interaction.options.getInteger("rating", true);
        const reason = interaction.options.getString("reason", true).trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error updating ${label} for "${id}": ${err}` });
            return;
        }

        const limits = ratingLimits[ratingType];
        if (value < limits.min || value > limits.max) {
            await interaction.reply({ content: `${label} must be between ${limits.min} and ${limits.max}.` });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        await interaction.deferReply();

        const [success, response] = await makeWFCRequest("/mkw_rating", "POST", {
            secret: config.wfcSecret,
            pid: pid,
            rating_type: ratingType,
            value: value,
            reason: reason,
        }) as [boolean, MKWRatingResponse];

        if (!success) {
            await interaction.editReply({
                content: `Failed to update ${label} for friend code "${fc}": error ${response.Error ?? "no error message provided"}`,
            });
            return;
        }

        const [user, pinfoErr] = await fetchPinfo(pid, true);
        if (pinfoErr != null) {
            await interaction.editReply({
                content: `Successfully updated ${label} for friend code "${fc}", but failed to retrieve user for embed: ${pinfoErr}`,
            });
        }

        await sendEmbedLog(interaction, user, {
            action: `Set ${label}`,
            extraFields: [
                {
                    name: `New ${label}`,
                    value: mkwUserRatingGetByRatingType(response.Rating, ratingType).toString(),
                },
                {
                    name: `Previous ${label}`,
                    value: mkwUserRatingGetByRatingType(response.OldRating, ratingType).toString(),
                },
                { name: "Reason", value: reason },
            ],
            hideMii: false,
            noPublicEmbed: true,
        });
    },
};
