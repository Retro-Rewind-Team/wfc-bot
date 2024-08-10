const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { fcToPid, makeRequest, makeUrl, sendEmbedLog, validateFc } = require("../utils.js");


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
        .addStringOption(option => option.setName("friend-code")
            .setDescription("friend code to ban")
            .setRequired(true))
        .addStringOption(option => option.setName("reason")
            .setDescription("ban reason")
            .setRequired(true))
        // .addStringOption(option => option.setName("hidden-reason")
        //     .setDescription("ban reason only visible to moderators"))
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
        var fc = interaction.options.getString("friend-code", true);
        fc = fc.trim();

        if (!validateFc(fc)) {
            await interaction.reply({ content: `Error banning friend code "${fc}": Friend code is not in the correct format` });
            return;
        }

        const pid = fcToPid(fc);
        const reason = interaction.options.getString("reason", true);
        // const reason_hidden = interaction.options.getString("hidden-reason");
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

        const url = makeUrl("ban", `&pid=${pid}&reason=${reason}&days=${days}&hours=${hours}&minutes=${minutes}&tos=${tos}`);

        if (await makeRequest(interaction, fc, url)) {
            sendEmbedLog(interaction, "ban", fc, hide, [
                { name: "Ban Length", value: perm ? "Permanent" : `${days} ${p(days, "day")}, ${hours} ${p(hours, "hour")}, ${minutes} ${p(minutes, "minute")}` },
                { name: "Reason", value: reason },
                { name: "TOS", value: tos.toString() }]
            );
        }
    }
};
