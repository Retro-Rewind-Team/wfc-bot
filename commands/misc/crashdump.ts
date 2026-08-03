import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { processCrashdump } from "../shared/crash.js";
import { PermissionBit } from "../shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("crashdump")
        .setDescription("Print the stacktrace and registers from a crashdump")
        .addAttachmentOption(option => option.setName("file")
            .setDescription("The crash.pul file")
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

        const [code, out, err] = await processCrashdump(buffer);

        if (code == 0) {
            await interaction.reply({
                content: out,
            });
        }
        else {
            console.error(`Error processing crashdump: ${err}`);
            await interaction.reply({
                content: `\`\`\`${err}\`\`\``,
                flags: MessageFlags.Ephemeral,
            });
        }
    }
};
