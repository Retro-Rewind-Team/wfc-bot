import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

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
        // From https://wiibrew.org/wiki/Mii_data#Mii_format
        const miiID = buffer.readUint32BE(0x18);
        // Jan 1, 2006
        const miiDate = new Date(2006, 0, 1);
        // Timestamp is stored as 4 second intervals since 2006/0/1,
        // Only bottom 29 bits needed.
        const miiTimeStamp = ((miiID << 3) >>> 3) * 4;
        miiDate.setSeconds(miiDate.getSeconds() + miiTimeStamp);
        const sysID = buffer.readUint32BE(0x1C);

        await interaction.reply({
            content: `Mii: ${binaryAttachment.name}\n`
                + `MiiID: ${miiID}, ${miiID.toString(16)}, ${miiID.toString(2)}\n`
                + `Mii TimeStamp: ${miiDate.toLocaleString()}\n`
                + `SysID: ${sysID}, ${sysID.toString(16)}, ${sysID.toString(2)}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
