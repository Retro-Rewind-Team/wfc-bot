import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { formatMiiData, getMiiBuf, processMiiBuf } from "./mii_shared.js";
import { getMiiImageURL, pidToFc, resolvePidFromString, validateID } from "../../utils.js";

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("mii_private")
        .setDescription("Fetch the Mii for a pid or FC")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to kick")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid)
            return [null, `Error retrieving Mii for friend code or pid "${id}": ${err}`];

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);        // Private comand, sanitized is false
        const [miiBuf, miiErr] = await getMiiBuf(id, false);

        if (miiErr != null || miiBuf == null) {
            interaction.reply({ content: err ?? "unknown error", flags: MessageFlags.Ephemeral });
            return;
        }

        const mii = processMiiBuf(null, miiBuf);

        await interaction.reply({
            content: formatMiiData(mii),
            embeds: [
                new EmbedBuilder().setImage(getMiiImageURL(fc)),
            ],
            files: [{
                name: `${fc}.mii`,
                attachment: miiBuf,
            }],
            flags: MessageFlags.Ephemeral,
        });
    },
};
