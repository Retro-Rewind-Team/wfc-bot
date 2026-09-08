import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getColor, makeWFCRequest } from "#src/utils.js";
import { getChannels, getConfig } from "#src/config.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { Command } from "#src/commands/shared/command.js";

const config = getConfig();

export const command: Command = {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("mmr_season")
        .setDescription("Switch the active Mario Kart Wii MMR season")
        .addIntegerOption(option => option.setName("new-season")
            .setDescription("new season number")
            .setRequired(true)
            .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const season = interaction.options.getInteger("new-season", true);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const [success, response] = await makeWFCRequest("/mkw_mmr_season", "POST", {
            secret: config.wfcSecret,
            season: season,
        });

        if (!success) {
            await interaction.editReply({
                content: `Failed to switch MMR season: ${response.Error ?? "no error message provided"}`,
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle("MMR Season changed")
            .addFields(
                { name: "Moderator", value: `<@${interaction.user.id}>` },
                { name: "Old Season", value: response.OldSeason?.toString() ?? "None" },
                { name: "New Season", value: response.Season.toString() },
            )
            .setTimestamp();

        await getChannels().logs.send({ embeds: [embed] });
        await interaction.editReply({
            content: `MMR season changed from ${response.OldSeason} to ${response.Season}.`,
        });
    },
};
