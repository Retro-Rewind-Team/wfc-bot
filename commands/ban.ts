import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { makeRequest, pidToFc, resolvePidFromString, sendEmbedLog, validateId } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

function p(count: number, str: string) {
    if (count == 1)
        return str;

    return str + "s";
};

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to ban")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("ban reason")
            .setRequired(true))
        .addStringOption(option => option.setName("hidden-reason")
            .setDescription("ban reason only visible to moderators"))
        .addNumberOption(option => option.setName("days")
            .setDescription("ban days length"))
        .addNumberOption(option => option.setName("hours")
            .setDescription("ban hours length"))
        .addNumberOption(option => option.setName("minutes")
            .setDescription("ban minutes length"))
        .addBooleanOption(option =>
            option.setName("tos")
                .setDescription("tos violation (ban from entire service), default true"))
        .addBooleanOption(option =>
            option.setName("hide-name")
                .setDescription("hide mii name in logs"))
        .addBooleanOption(option =>
            option.setName("hide-public")
                .setDescription("hide public log message"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error banning friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reasonHidden = interaction.options.getString("hidden-reason");
        let days = interaction.options.getNumber("days") ?? 0;
        const hours = interaction.options.getNumber("hours") ?? 0;
        const minutes = interaction.options.getNumber("minutes") ?? 0;
        const tos = interaction.options.getBoolean("tos") ?? true;
        const hide = interaction.options.getBoolean("hide-name") ?? false;
        const hidePublic = interaction.options.getBoolean("hide-public") ?? false;
        const moderator = interaction.user.username;

        let perm = false;
        if (hours + minutes + days == 0) {
            // Perm ban lol
            perm = true;
            // A normal person lives about 31000 days
            days = 100000;
        }

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/ban", "POST", {
            secret: config.wfcSecret,
            pid: pid,
            days: days,
            hours: hours,
            minutes: minutes,
            tos: tos,
            reason: reason,
            reasonHidden: reasonHidden ?? "",
            moderator: moderator
        });

        if (success) {
            await sendEmbedLog(interaction, "ban", fc, res.User, [
                { name: "Ban Length", value: perm ? "Permanent" : `${days} ${p(days, "day")}, ${hours} ${p(hours, "hour")}, ${minutes} ${p(minutes, "minute")}` },
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reasonHidden ?? "None", hidden: true },
                { name: "TOS", value: tos.toString() },
            ], hide, hidePublic);
        }
        else
            await interaction.reply({ content: `Failed to ban friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};
