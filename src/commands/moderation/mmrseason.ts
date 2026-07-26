import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getChannels, getConfig } from "../../config.js";
import { capitalize, getColor, makeWFCRequest } from "../../utils.js";
import { PermissionBit } from "../shared/roles.js";

const config = getConfig();

export default {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("mmrseason")
        .setDescription("Switch the active Mario Kart Wii MMR season")
        .addIntegerOption(option => option.setName("new-season")
            .setDescription("new season number")
            .setRequired(true)
            .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const season = interaction.options.getInteger("new-season", true);
        const [success, response] = await makeWFCRequest("/set_mkw_mmr_season", "POST", {
            secret: config.wfcSecret,
            season,
        });

        if (!success) {
            await interaction.reply({
                content: `Failed to switch MMR season: ${response.Error ?? response.error ?? "no error message provided"}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const previous = response.previous_season ?? response.PreviousSeason;
        const current = response.season ?? response.Season ?? season;
        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`${capitalize("mmr season")} changed`)
            .addFields(
                { name: "Moderator", value: `<@${interaction.user.id}>` },
                { name: "Old season", value: `${previous}` },
                { name: "New season", value: `${current}` },
            )
            .setTimestamp();
        await getChannels().logs.send({ embeds: [embed] });
        await interaction.reply({ content: `MMR season changed from ${previous} to ${current}.`, flags: MessageFlags.Ephemeral });
    },
};
