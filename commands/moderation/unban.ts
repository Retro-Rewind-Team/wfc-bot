import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../../config.js";
import { makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateID } from "../../utils.js";
import { PermissionBit } from "../shared/roles.js";

const config = getConfig();

export default {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to unban")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("unban reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("unban reason only visible to moderators"))
        .addBooleanOption(option => option.setName("hide-name")
            .setDescription("hide mii name in logs"))
        .addBooleanOption(option => option.setName("hide-public")
            .setDescription("hide public log message"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error unbanning friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        const hide = interaction.options.getBoolean("hide-name") ?? false;
        const hidePublic = interaction.options.getBoolean("hide-public") ?? false;

        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/unban", "POST", { secret: config.wfcSecret, pid: pid });
        if (success) {
            await sendEmbedLog(interaction, "unban", res.User, [
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
            ], hide, hidePublic);
        }
        else
            await interaction.reply({ content: `Failed to unban friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
