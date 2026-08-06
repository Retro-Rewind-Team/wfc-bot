import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "#src/utils.js";
import { getConfig } from "#src/config.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

const config = getConfig();

export const command: Command = {
    permissions: PermissionBit.PROFILE_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear a user from the database")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to clear")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("clear reason")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error clearing friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);

        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/clear", "POST", { secret: config.wfcSecret, pid: pid });
        if (success) {
            await sendEmbedLog(interaction, res.User, {
                action: "clear",
                extraFields: [{ name: "Reason", value: reason }],
                noPublicEmbed: true,
                verbose: true,
                showBanInfo: true,
            });
        }
        else
            await interaction.reply({ content: `Failed to clear friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    },
};
