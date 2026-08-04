import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { createMiiEmbed, getMiiBuf, processMiiBuf } from "#src/commands/shared/mii.js";
import { pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "#src/utils.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("mii_private")
        .setDescription("Fetch the Mii for a pid or FC")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to fetch the mii of")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({
                content: `Error retrieving Mii for friend code or pid "${id}": ${err}`
            });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid); // Private comand, sanitized is false
        const [miiBuf, miiErr] = await getMiiBuf(id, false);

        if (miiErr != null || miiBuf == null) {
            await interaction.reply({ content: miiErr ?? "unknown error", flags: MessageFlags.Ephemeral });
            return;
        }

        const mii = processMiiBuf(null, miiBuf);

        await interaction.reply({
            embeds: [createMiiEmbed(mii, fc)],
            files: [{
                name: `${fc}.mii`,
                attachment: miiBuf,
            }],
            flags: MessageFlags.Ephemeral,
        });
    },
};
