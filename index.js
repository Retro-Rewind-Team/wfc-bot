const { Client, Events, REST, Routes, IntentsBitField } = require("discord.js");
const config = require("./config.json");
const fs = require("fs");
const path = require("path");
const { exit } = require("process");

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages] });

module.exports = {
    client: client
};

if (!config["moderation-role"]) {
    console.error("No moderation role is set! Please set one to continue.");
    exit(1);
}

client.once(Events.ClientReady, async function(readyClient) {
    console.log(`Logged in as ${readyClient.user.tag}`);

    var channel = await client.channels.fetch(config["logs-channel"]);

    if (!channel) {
        console.error("Incorrect channel set for logs!");
        exit(1);
    }
    else
        console.log(`Logs set to send to ${channel.name}`);

    // TODO: Set activity with user count?

    // client.user.setPresence({
    //     status: "online",
    // });
});

client.login(config["token"]);

// TODO: Make this function not suck?
function isAllowedInteraction(interaction, modOnly) {
    var err = [];

    var server = false, channel = false, user = false;

    if (config["allowed-servers"].length == 0 || config["allowed-servers"].includes(interaction.guildId))
        server = true;
    else
        err.push("disallowed guild");

    if (config["allowed-channels"].length == 0 || config["allowed-channels"].includes(interaction.channelId))
        channel = true;
    else
        err.push("disallowed channel");

    if (modOnly && !interaction.member.roles.cache.get(config["moderation-role"]))
        err.push("incorrect role");
    else
        user = true;

    return [server && channel && user, err.join(", ")];
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
            const [allowed, err] = isAllowedInteraction(interaction, command.modOnly);
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

    for (var j in config["allowed-servers"]) {
        var guildId = config["allowed-servers"][j];

        console.log(`refreshing slash commands for guild ${guildId}`);

        const rest = new REST().setToken(config["token"]);

        const data = await rest.put(
            Routes.applicationGuildCommands(config["application-id"], guildId),
            { body: commandsJson }
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
