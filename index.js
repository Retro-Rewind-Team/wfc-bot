const { Client, Events, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require("discord.js");
const config = require("./config.json");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, readyClient => {
    console.log(`Logged in as ${readyClient.user.tag}`);
});

client.login(config["token"]);

const urlBase = `http://${config["wfc-server"]}:${config["wfc-port"]}/api/`;

function makeUrl(path, opts) {
    return `${urlBase}${path}?secret=${config["wfc-secret"]}${opts}`;
}

var banCommand = new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addStringOption(option =>
        option.setName("friend-code")
            .setDescription("friend code to ban")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("reason")
            .setDescription("ban reason")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("hidden-reason")
            .setDescription("ban reason only visible to moderators"))
    .addNumberOption(option =>
        option.setName("days")
            .setDescription("ban days length"))
    .addNumberOption(option =>
        option.setName("hours")
            .setDescription("ban hours length"))
    .addNumberOption(option =>
        option.setName("minutes")
            .setDescription("ban minutes length"))
    .addBooleanOption(option =>
        option.setName("tos")
            .setDescription("tos violation (ban from entire service), default false"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

var kickCommand = new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addStringOption(option =>
        option.setName("friend-code")
            .setDescription("friend code to kick")
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

var unbanCommand = new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user")
    .addStringOption(option =>
        option.setName("friend-code")
            .setDescription("friend code to unban")
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

async function allowedInteraction(interaction) {
    var server = false, channel = false, user = false;

    if (config["allowed-servers"].includes(interaction.guildId))
        server = true;

    if (config["allowed-channels"].includes(interaction.channelId))
        channel = true;

    if (config["allowed-users"].includes(interaction.user.id))
        user = true;

    var ret = server && channel && user;

    if (!ret) {
        console.error(`User ${interaction.user.id} in channel ${interaction.channelId} in guild ${interaction.guildId} was not allowed! Failed checks: ${user ? "" : "user"} ${channel ? "" : "channel"} ${server ? "" : "server"}`);
        await interaction.reply({ content: `Command not allowed! Failed checks: ${user ? "" : "user"} ${channel ? "" : "channel"} ${server ? "" : "server"}` });
    }

    return ret;
}

function fcToPid(friendCode) {
    return parseInt(friendCode.replace(/-/g, ""), 10) >>> 0;
}

const fcRegex = new RegExp(/[0-9]{4}-[0-9]{4}-[0-9]{4}/);
function validateFc(friendCode) {
    return friendCode.match(fcRegex);
}

async function makeRequest(interaction, fc, url) {
    try {
        var response = await fetch(url, { method: "GET" });

        if (response.ok)
            interaction.reply({ content: `Successfully performed operation on friend code ${fc}` });
        else {
            var rjson = await response.json();
            console.log(rjson);
            interaction.reply({ content: `Failed to perform operation on friend code ${fc}: error ${rjson ? rjson.error : "no error message provided"}` });
        }
    }
    catch (error) {
        console.error(`Error performing operation on friend code "${fc}": ${error}`);
        await interaction.reply({ content: `Error performing operation on friend code "${fc}": ${error}` });
    }
}

async function ban(interaction) {
    var fc = interaction.options.getString("friend-code", true);
    fc = fc.trim();

    if (!validateFc(fc)) {
        await interaction.reply({ content: `Error banning friend code "${fc}": Friend code is not in the correct format` });
        return;
    }

    var pid = fcToPid(fc);
    var reason = interaction.options.getString("reason", true);
    var reason_hidden = interaction.options.getString("reason_hidden") ?? null;
    var days = interaction.options.getNumber("days") ?? 0;
    var hours = interaction.options.getNumber("hours") ?? 0;
    var minutes = interaction.options.getNumber("minutes") ?? 0;
    var tos = interaction.options.getBoolean("tos") ?? false;

    if (hours + minutes + days == 0) {
        await interaction.reply({ content: `Error banning friend code "${fc}": Ban length cannot be zero` });
        return;
    }

    var url = makeUrl("ban", `&pid=${pid}&reason=${reason}&reason_hidden=${reason_hidden}&days=${days}&hours=${hours}&minutes=${minutes}&tos=${tos}`);

    makeRequest(interaction, fc, url);
}

async function kick(interaction) {
    var fc = interaction.options.getString("friend-code", true);
    fc = fc.trim();

    if (!validateFc(fc)) {
        await interaction.reply({ content: `Error banning friend code "${fc}": Friend code is not in the correct format` });
        return;
    }

    var pid = fcToPid(fc);

    var url = makeUrl("kick", `&pid=${pid}`);

    makeRequest(interaction, fc, url);
}

async function unban(interaction) {
    var fc = interaction.options.getString("friend-code", true);
    fc = fc.trim();

    if (!validateFc(fc)) {
        await interaction.reply({ content: `Error banning friend code "${fc}": Friend code is not in the correct format` });
        return;
    }

    var pid = fcToPid(fc);

    var url = makeUrl("unban", `&pid=${pid}`);

    makeRequest(interaction, fc, url);
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand())
        return;

    if (!await allowedInteraction(interaction)) {
        return;
    }

    try {
        if (interaction.commandName == "ban")
            await ban(interaction);
        else if (interaction.commandName == "kick")
            await kick(interaction);
        else if (interaction.commandName == "unban")
            await unban(interaction);
        else {
            await interaction.reply({ content: `No command exists by the name of ${interaction.commandName}` });
            return;
        }
    }
    catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred)
            await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
        else
            await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
    }
});

async function refreshCommands() {
    for (var j in config["allowed-servers"]) {
        var guildId = config["allowed-servers"][j];

        console.log(`refreshing slash commands for guild ${guildId}`);

        const rest = new REST().setToken(config["token"]);

        const data = await rest.put(
            Routes.applicationGuildCommands(config["application-id"], guildId),
            // TODO: If like way more commands are desired, then this should be abstracted...
            { body: [banCommand.toJSON(), kickCommand.toJSON(), unbanCommand.toJSON()] }
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}`);
    }
}

for (var i in process.argv) {
    var arg = process.argv[i];

    if (arg == "--refresh-commands") {
        refreshCommands();
    }
}
