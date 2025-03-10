import { CacheType, ChatInputCommandInteraction, Client, Events, IntentsBitField, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPutAPIApplicationCommandsResult, Routes, SlashCommandOptionsOnlyBuilder, TextChannel } from "discord.js";
import config from "./config.json" with { type: "json" };
import * as fs from "fs";
import * as path from "path";
import { exit } from "process";

interface Mii {
    data: string,
    name: string,
}

interface Player {
    count: string,
    pid: string,
    name: string,
    conn_map: string,
    conn_fail: string,
    suspend: string,
    fc: string,
    ev: string,
    eb: string,
    mii: Mii[],
}

interface Group {
    id: string,
    game: string,
    created: string,
    type: string,
    suspend: boolean,
    host: string,
    rk: string,
    players: Player[],
}

interface Groups {
    timestamp: number,
    rooms: Group[],
}

interface Stat {
    online: number,
    active: number,
    groups: number,
}

interface Stats {
    global: Stat,
    mariokartwii: Stat,
}

export const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages] });
let groups: Groups | null = null;
let stats: Stats | null = null;

export function getGroups() {
    return groups;
}

export function getStats() {
    return stats;
}

if (!config["allowed-moderators"] || typeof config["allowed-moderators"] != "object" || config["allowed-moderators"].length === 0) {
    console.log("No moderators set!");
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
    function plural(count: number, text: string) {
        return count == 1 ? text : text + "s";
    }

    function throwInline(err: string) {
        throw new Error(err);
    }

    async function queryJson(url: string) {
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Unable to fetch groups, status code: ${response.status}`);
            return null;
        }

        const json = await response.json();

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
        const players = stats!.mariokartwii.active;
        const rooms = stats!.mariokartwii.groups;

        const presenceText = `${players} ${plural(players, "player")} in ${rooms} ${plural(rooms, "room")}!`;

        client.user?.setPresence({
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

    const channel = await client.channels.fetch(config["logs-channel"]);

    if (!channel) {
        console.error("Invalid channelid set for logs!");
        exit(1);
    }
    else
        console.log(`Logs set to send to channel ${(channel as TextChannel).name}`);

    const pubchannel = await client.channels.fetch(config["public-logs-channel"]);

    if (!pubchannel) {
        console.error("Invalid channelid set for public logs!");
        exit(1);
    }
    else
        console.log(`Public logs set to send to channel ${(pubchannel as TextChannel).name}`);
    // Runs once a minute
    setInterval(fetchGroups, 60000);
    fetchGroups();
});

client.login(config["token"]);

// TODO: Make this function not suck?
function isAllowedInteraction(interaction: ChatInputCommandInteraction<CacheType>, modOnly: boolean, adminOnly: boolean) {
    const err: string[] = [];

    let user = true;

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

interface Command {
    modOnly: boolean,
    adminOnly: boolean,
    data: SlashCommandOptionsOnlyBuilder;
    exec: (_: ChatInputCommandInteraction<CacheType>) => Promise<void>,
}

interface Dictionary<T> { [key: string]: T }

async function resolveCommands(root: string, files: string[], callback: (_: Dictionary<Command>) => void) {
    const ret: Dictionary<Command> = {};

    for (const file of files) {
        let spec = await import(path.join(root, file));
        spec = spec.default;
        if ("data" in spec && "exec" in spec) {
            const name = path.basename(file, ".js");
            console.log(`Registered command ${name}`);
            ret[name] = spec;
        }
        else
            console.error(`The command at ${file} is missing a required data or exec property`);
    }

    callback(ret);
}

async function handleInteraction(interaction: ChatInputCommandInteraction<CacheType>, commands: Dictionary<Command>) {
    if (!interaction.isChatInputCommand())
        return;

    try {
        for (const cname in commands) {
            if (cname != interaction.commandName)
                continue;

            const command = commands[cname];
            const [allowed, err] = isAllowedInteraction(interaction, command.modOnly, command.adminOnly);
            if (!allowed) {
                await interaction.reply({ content: `Command ${cname} is not allowed! Error: ${err}` });
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
}

async function refreshCommands(commands: Dictionary<Command>) {
    const commandsJson: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    for (const cname in commands)
        commandsJson.push(commands[cname].data.toJSON());

    console.log("Refreshing global slash commands");

    const rest = new REST().setToken(config["token"]);

    const data = await rest.put(
        Routes.applicationCommands(config["application-id"]),
        { body: commandsJson }
    ) as RESTPutAPIApplicationCommandsResult;

    console.log(`Successfully reloaded ${data.length} global application (/) commands`);
}

const commandsRoot = path.join(import.meta.dirname, "commands");
const commandFiles = fs.readdirSync(commandsRoot).filter(file => file.endsWith(".js"));

// Because of really strange node behavior involving import and resolving
// promises, commands cannot be awaited, so a callback is used instead.
resolveCommands(commandsRoot, commandFiles, (commands) => {
    client.on(Events.InteractionCreate, async interaction => {
        handleInteraction(interaction as ChatInputCommandInteraction<CacheType>, commands);
    });

    for (const i in process.argv) {
        const arg = process.argv[i];

        if (arg == "--refresh-commands")
            refreshCommands(commands);
    }
});
