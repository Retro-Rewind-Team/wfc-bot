import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { _fetch as fetch } from "#src/fetch.js";
import { Command } from "#src/commands/shared/command.js";
import { createMiiEmbed, processMiiBuf } from "#src/commands/shared/mii.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("mii_info")
        .setDescription("Extract mii info from a mii file")
        .addAttachmentOption(option => option.setName("file")
            .setDescription("The mii file")
            .setRequired(true)),


    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
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
            embeds: [createMiiEmbed(mii)],
            flags: MessageFlags.Ephemeral,
        });
    },
};
