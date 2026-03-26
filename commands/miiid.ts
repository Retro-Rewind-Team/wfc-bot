import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { processMiiBuf } from "./miiid_shared.js";

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("miiid")
        .setDescription("Extract the miiid field from a mii file")
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

        const mii = processMiiBuf(buffer);

        await interaction.reply({
            content: `Mii File: ${binaryAttachment.name}\n`
                + `Mii Name: ${mii.name}\n`
                + `Creator: ${mii.creator}\n`
                + `MiiID: ${mii.miiID.toString(16)}\n`
                + `SysID: ${mii.sysID.toString(16)}\n`
                + `Mii TimeStamp: ${mii.date.toLocaleString()}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
