import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolvePidFromString, validateID } from "#src/utils.js";
import { Command } from "#src/commands/shared/command.js";
import { createMiiEmbed, getMiiBuf, processMiiBuf } from "#src/commands/shared/mii.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("mii")
        .setDescription("Fetch the Mii for a pid or fc")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to fetch the mii of")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({
                content: `Error retrieving Mii for friend code or pid "${id}": ${err}`,
            });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        // Public command, sanitized is true
        const [miiBuf, miiErr] = await getMiiBuf(id, true);

        if (miiErr != null || miiBuf == null) {
            await interaction.reply({ content: miiErr ?? "unknown error", flags: MessageFlags.Ephemeral });
            return;
        }

        const mii = processMiiBuf(null, miiBuf);

        await interaction.reply({
            embeds: [createMiiEmbed(mii, fc) ],
            files: [{
                name: `${fc}.mii`,
                attachment: miiBuf,
            }],
        });
    },
};
