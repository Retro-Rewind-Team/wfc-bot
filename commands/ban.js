const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { makeRequest, makeUrl, pidToFc, resolvePidFromString, sendEmbedLog, validateId } = require("../utils.js");


function p(count, str) {
    if (count == 1)
        return str;

    return str + "s";
};

module.exports = {
    modOnly: true,

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
                .setDescription("tos violation (ban from entire service), default false"))
        .addBooleanOption(option =>
            option.setName("hide-name")
                .setDescription("hide mii name in logs"))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    exec: async function(interaction) {
        var id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error banning friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);
        const reason = interaction.options.getString("reason", true);
        const reason_hidden = interaction.options.getString("hidden-reason");
        var days = interaction.options.getNumber("days") ?? 0;
        const hours = interaction.options.getNumber("hours") ?? 0;
        const minutes = interaction.options.getNumber("minutes") ?? 0;
        const tos = interaction.options.getBoolean("tos") ?? true;
        const hide = interaction.options.getBoolean("hide-name") ?? false;

        var perm = false;
        if (hours + minutes + days == 0) {
            // Perm ban lol
            perm = true;
            // A normal person lives about 31000 days
            days = 100000;
        }

        const url = makeUrl("ban", `&pid=${pid}&reason=${reason}&reason_hidden=${reason_hidden}&days=${days}&hours=${hours}&minutes=${minutes}&tos=${tos}`);

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest(interaction, fc, url);
        if (success) {
            sendEmbedLog(interaction, "ban", fc, [
                { name: "Ban Length", value: perm ? "Permanent" : `${days} ${p(days, "day")}, ${hours} ${p(hours, "hour")}, ${minutes} ${p(minutes, "minute")}` },
                { name: "Reason", value: reason },
                { name: "Hidden Reason", value: reason_hidden ?? "None", hidden: true },
                { name: "TOS", value: tos.toString() },
                { name: "IP", value: res.ip ?? "Unknown", hidden: true }
            ], hide);
        }
    }
};
