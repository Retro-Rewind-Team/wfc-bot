import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { formatMiiData, processMiiBuf } from "./mii_shared.js";

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("mii_info")
        .setDescription("Extract mii info from a mii file")
        .addAttachmentOption(option => option.setName("file")
            .setDescription("The mii file")
            .setRequired(true)),


    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const binaryAttachment = interaction.options.getAttachment("file", true);
        const binaryResponse = await fetch(binaryAttachment.url);

        if (!binaryResponse.ok) {
            await interaction.reply({
                content: `Error fetching crash attachment: ${binaryResponse.status}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const buffer = Buffer.from(await binaryResponse.arrayBuffer());

        const mii = processMiiBuf(binaryAttachment.name, buffer);

        await interaction.reply({
            content: formatMiiData(mii),
            flags: MessageFlags.Ephemeral,
        });
    },
};
