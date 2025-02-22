const { Client, Events, IntentsBitField, REST, Routes } = require("discord.js");
const config = require("./config.json");
const fs = require("fs");
const path = require("path");
const { exit } = require("process");

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages] });
var groups = null;
var stats = null;

module.exports = {
    client: client,
    getGroups: function() {
        return groups;
    },
    getStats: function() {
        return stats;
    }
};
/*
if (!config["moderation-roles"] || typeof config["moderation-roles"] != "object" || config["moderation-roles"].length === 0) {
    console.error("No moderation role is set or it is set incorrectly! Correct this to continue.");
    exit(1);
} */
if (!config["allowed-moderators"] || typeof config["allowed-moderators"] != "object" || config["allowed-moderators"].length === 0) {
    console.log("No moderators set!")
}

if (!config["allowed-admins"] || typeof config["allowed-admins"] != "object" || config["allowed-admins"].length === 0) {
    console.error("No admins set! Please set one to continue.");
    exit(1);
}

if (!config["logs-channel"]) {
    console.error("No logs channel is set! Please set one to continue.");
    exit(1);
}

if (!config["public-logs-channel"]) {
    console.error("No public logs channel is set! Please set one to continue.");
    exit(1);
}

const fetchGroupsUrl = `http://${config["wfc-server"]}:${config["wfc-port"]}/api/groups`;
const fetchStatsUrl = `http://${config["wfc-server"]}:${config["wfc-port"]}/api/stats`;
async function fetchGroups() {
    function plural(count, text) {
        return count == 1 ? text : text + "s";
    }

    function throwInline(err) {
        throw new Error(err);
    }

    async function queryJson(url) {
        var response = await fetch(url);

        if (!response.ok) {
            console.error(`Unable to fetch groups, status code: ${response.status}`);
            return null;
        }

        var json = await response.json();

        if (!json) {
            console.error(`Invalid response from ${url}, unable to populate groups!`);
            return null;
        }

        return json;
    }

    try {
        const groupsJson = (await queryJson(fetchGroupsUrl)) ?? throwInline("Empty or no json response from groups api.");
        groups = { timestamp: Date.now(), rooms: groupsJson };
        stats = await queryJson(fetchStatsUrl) ?? throwInline("Empty or no json response from stats api.");
        const players = stats.mariokartwii.active;
        const rooms = stats.mariokartwii.groups;

        const presenceText = `${players} ${plural(players, "player")} in ${rooms} ${plural(rooms, "room")}!`;

        client.user.setPresence({
            status: "online",
            activities: [{
                name: "Stats",
                type: 4,
                state: presenceText,
            }]
        });

        console.log(`Successfully fetched groups and stats! Time is ${new Date(Date.now())}. ${presenceText}`);
    }
    catch (e) {
        console.error(`Failed to fetch groups and stats, error: ${e}`);
    }
}

client.once(Events.ClientReady, async function(readyClient) {
    console.log(`Logged in as ${readyClient.user.tag}`);

    var channel = await client.channels.fetch(config["logs-channel"]);

    if (!channel) {
        console.error("Invalid channelid set for logs!");
        exit(1);
    }
    else
        console.log(`Logs set to send to channel ${channel.name}`);

    var pubchannel = await client.channels.fetch(config["public-logs-channel"]);

    if (!pubchannel) {
        console.error("Invalid channelid set for public logs!");
        exit(1);
    }
    else
        console.log(`Public logs set to send to channel ${pubchannel.name}`);
    // Runs once a minute
    setInterval(fetchGroups, 60000);
    fetchGroups();
});

client.login(config["token"]);

/* function hasAnyRoles(member, roles) {
    for (const role of roles) {
        if (member.roles.cache.get(role))
            return true;
    }

    return false;
} */

// TODO: Make this function not suck?
function isAllowedInteraction(interaction, modOnly, adminOnly) {
    var err = [];

    var user = true;

    /* Deprecated
    if (!config["allowed-servers"] || config["allowed-servers"].length == 0 || config["allowed-servers"].includes(interaction.guildId)) {
        server = true;
    } else {
        err.push("disallowed guild");
    }

    if (!config["allowed-channels"] || config["allowed-channels"].length == 0 || config["allowed-channels"].includes(interaction.channelId)) {
        channel = true;
    } else {
        err.push("disallowed channel");
    }
    */

    if (adminOnly && !config["allowed-admins"].includes(interaction.user.id)) {
        err.push("not an admin");
        user = false;
    }

    if (modOnly && !config["allowed-moderators"].includes(interaction.user.id)) {
        err.push("not a moderator");
        user = false;
    }

    return [user, err.join(", ")];
}

const commands = {};
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const spec = require(path.join(commandsPath, file));

    if ("data" in spec && "exec" in spec)
        commands[path.basename(file, ".js")] = spec;
    else
        console.error(`The command at ${file} is missing a required data or exec property`);
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand())
        return;

    try {
        for (const cname in commands) {
            if (cname != interaction.commandName)
                continue;

            const command = commands[cname];
            const [allowed, err] = isAllowedInteraction(interaction, command.modOnly, command.adminOnly);
            if (!allowed) {
                interaction.reply({ content: `Command ${cname} is not allowed! Error: ${err}` });
                return;
            }

            await command.exec(interaction);
            return;
        }

        await interaction.reply({ content: `No command exists by the name of ${interaction.commandName}` });
        return;
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
    const commandsJson = [];

    for (const cname in commands)
        commandsJson.push(commands[cname].data.toJSON());

    console.log(`Refreshing global slash commands`);

    const rest = new REST().setToken(config["token"]);

    const data = await rest.put(
        Routes.applicationCommands(config["application-id"]),
        { body: commandsJson }
    );

    console.log(`Successfully reloaded ${data.length} global application (/) commands`);
}

for (var i in process.argv) {
    var arg = process.argv[i];

    if (arg == "--refresh-commands") {
        refreshCommands();
    }
}
