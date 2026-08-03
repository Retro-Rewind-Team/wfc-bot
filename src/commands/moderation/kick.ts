import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "#src/utils.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

const config = getConfig();

export const command: Command = {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to kick")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("kick reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("kick reason only visible to moderators"))
        .addBooleanOption(option => option.setName("hide-mii")
            .setDescription("hide mii and mii name in logs"))
        .addBooleanOption(option => option.setName("hide-public")
            .setDescription("hide public log message"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error kicking friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        const hideMii = interaction.options.getBoolean("hide-mii") ?? false;
        const hidePublic = interaction.options.getBoolean("hide-public") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/kick", "POST", { secret: config.wfcSecret, pid: pid, reason: reason });
        if (success) {
            await sendEmbedLog(interaction, res.User, {
                action: "kick",
                extraFields: [
                    { name: "Reason", value: reason },
                    { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
                ],
                hideMii: hideMii,
                noPublicEmbed: hidePublic,
                verbose: false,
                showBanInfo: false,
            });
        }
        else
            await interaction.reply({ content: `Failed to kick friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
