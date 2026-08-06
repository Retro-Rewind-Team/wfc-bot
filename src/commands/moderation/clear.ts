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
        .setDescription("Clear a user's login info from the database")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to clear")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("clear reason")
            .setRequired(true))
        .addBooleanOption(option => option.setName("full")
            .setDescription("should the entire profile be wiped"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();
        const full = interaction.options.getBoolean("full") ?? false;

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error clearing friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);

        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/clear", "POST", {
            secret: config.wfcSecret,
            pid: pid,
            full: full,
        });
        if (success) {
            await sendEmbedLog(interaction, res.User, {
                action: full ? "clear" : "partial-clear",
                extraFields: [{ name: "Reason", value: reason }],
                noPublicEmbed: true,
                verbose: full,
                showBanInfo: full,
            });
        }
        else
            await interaction.reply({ content: `Failed to clear friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    },
};
