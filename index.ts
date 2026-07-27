import { AutocompleteInteraction, ButtonInteraction, CacheType, ChatInputCommandInteraction, Client, Events, IntentsBitField, MessageFlags, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPutAPIApplicationCommandsResult, Routes } from "discord.js";
import { getConfig, initChannels, initConfig } from "./config.js";
import { Dictionary } from "./dictionary.js";
import * as fs from "fs";
import * as path from "path";
import { Command } from "./commands/shared/command.js";
import { isAllowedInteraction, PermissionBit as PermissionBit } from "./commands/shared/roles.js";

// https://stackoverflow.com/questions/43834559/how-to-find-which-promises-are-unhandled-in-node-js-unhandledpromiserejectionwar
// Better logging of unhandled promises
process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
});

export const client = new Client({
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildModeration]
});

let refresh = false;
let configPath = "";
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch (arg) {
    case "--refresh-commands":
        refresh = true;
        break;
    case "--config":
        if (process.argv.length > i + 1) {
            configPath = process.argv[i + 1];

            if (configPath.charAt(0) != "/")
                configPath = path.join(process.cwd(), configPath);

            console.log("Config retrieved from " + configPath);
            i++;
        }

        break;
    default:
        console.error("Unknown argument: " + arg);
    }
}

initConfig(configPath.length > 0 ? configPath : path.join(process.cwd(), "config.json"));
const config = getConfig();

function findCommadFiles(root: string): string[] {
    let ret: string[] = [];
    const files = fs.readdirSync(root);

    for (const file of files) {
        const full = path.join(root, file);

        if (file.endsWith(".js")) {
            ret.push(full);
            continue;
        }

        if (fs.statSync(full).isDirectory())
            ret = ret.concat(findCommadFiles(full));
    }

    return ret;
}

client.once(Events.ClientReady, async function(readyClient) {
    console.log(`Logged in as ${readyClient.user.tag}`);

    await initChannels(client);

    const commandsRoot = path.join(import.meta.dirname ?? __dirname, "commands");
    const commandFiles = findCommadFiles(commandsRoot);

    // Because of really strange node behavior involving import and resolving
    // promises, commands cannot be awaited, so a callback is used instead.
    await resolveCommands(commandFiles, async (commands) => {
        client.on(Events.InteractionCreate, async interaction => {
            if (interaction.isAutocomplete())
                await handleAutocomplete(interaction, commands);
            else if (interaction.isChatInputCommand())
                await handleCommand(interaction as ChatInputCommandInteraction<CacheType>, commands);
            else if (interaction.isButton())
                await handleButton(interaction);
        });

        if (refresh)
            await refreshCommands(commands);

        const servicesRoot = path.join(import.meta.dirname ?? __dirname, "services");
        const serviceFiles = fs.readdirSync(servicesRoot).filter(file => file.endsWith(".js"));
        await startServices(servicesRoot, serviceFiles);
    });
});

await client.login(config["token"]);

async function resolveCommands(files: string[], callback: (_: Dictionary<Command>) => void): Promise<void> {
    const ret: Dictionary<Command> = {};

    for (const file of files) {
        let spec = await import(file);
        spec = spec.default;

        if (spec == undefined || spec == null)
            continue;

        if ("init" in spec) {
            try {
                await spec.init();
            }
            catch (e) {
                console.error(`Failed to run init for spec ${file}, ${e}`);
            }
        }

        if ("data" in spec && "exec" in spec) {
            const name = path.basename(file, ".js");
            console.log(`Registered command ${name} from file ${file}`);
            ret[name] = spec;

            if (!("permissions" in spec))
                throw `spec ${file} is missing permissions!`;

            // Allow all admins and super admins to run any command not restricted to super admins
            if (spec.permissions != PermissionBit.NONE && !(spec.permissions & PermissionBit.SUPER_ADMIN))
                spec.permissions |= (PermissionBit.ADMIN | PermissionBit.SUPER_ADMIN);
        }
        else
            console.error(`The command at ${file} is missing a required data or exec property`);
    }

    callback(ret);
}

async function startServices(root: string, files: string[]): Promise<void> {
    for (const file of files) {
        let spec = await import(path.join(root, file));
        spec = spec.default;

        if (spec == undefined || spec == null)
            continue;

        if ("register" in spec) {
            try {
                spec.register();
            }
            catch (e) {
                console.error(`Error starting service ${file}: ${e}.`);
            }

            console.log(`Started service ${file}`);
        }
    }
}

async function handleCommand(interaction: ChatInputCommandInteraction<CacheType>, commands: Dictionary<Command>): Promise<void> {
    if (!interaction.isChatInputCommand())
        return;

    try {
        const command = commands[interaction.commandName];

        if (!command) {
            await interaction.reply({
                content: `No command exists by the name of ${interaction.commandName}`
            });
            return;
        }

        const [allowed, err] = isAllowedInteraction(interaction, command);
        if (!allowed) {
            await interaction.reply({
                content: `Command ${interaction.commandName} is not allowed! Error: ${err}`
            });
            return;
        }

        await command.exec(interaction);
    }
    catch (error) {
        console.error(error);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "There was an error while executing this command!",
                    flags: MessageFlags.Ephemeral,
                });
            }
            else {
                await interaction.reply({
                    content: "There was an error while executing this command!",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
        catch (error) {
            console.error(`Could not reply to message with error. New error: ${error}`);
        }
    }
}

async function handleAutocomplete(interaction: AutocompleteInteraction<CacheType>, commands: Dictionary<Command>): Promise<void> {
    if (!interaction.isAutocomplete())
        return;

    try {
        for (const cname in commands) {
            if (cname != interaction.commandName)
                continue;

            const command = commands[cname];

            if (command.autocomplete)
                await command.autocomplete(interaction);
            else
                break;

            return;
        }

        await interaction.respond([]);
    }
    catch (error) {
        console.error(error);

        if (!interaction.responded)
            await interaction.respond([]);
    }
}

type TimeoutCallback = (messageID: string) => void;
type ButtonCallback = (interaction: ButtonInteraction<CacheType>) => Promise<void>;

const buttonHandlers: Dictionary<ButtonCallback> = {};

export function registerButtonHandlerByMessageID(messageID: string, timeout: number, timeoutcb: TimeoutCallback, clickcb: ButtonCallback): void {
    buttonHandlers[messageID] = clickcb;

    setTimeout(() => {
        timeoutcb(messageID);
        delete buttonHandlers[messageID];
    }, timeout);
}

async function handleButton(interaction: ButtonInteraction<CacheType>): Promise<void> {
    if (!interaction.isButton())
        return;

    const cb = buttonHandlers[interaction.message.id];

    if (cb)
        await cb(interaction);
    else {
        await interaction.reply({
            content: "This interaction has expired! Try resending your original command.",
            components: [],
            embeds: [],
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function refreshCommands(commands: Dictionary<Command>): Promise<void> {
    const globalCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const adminCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    for (const cname in commands) {
        const permissions = commands[cname].permissions;
        if (permissions == (PermissionBit.ADMIN | PermissionBit.SUPER_ADMIN) ||
            permissions == PermissionBit.SUPER_ADMIN)
            adminCommands.push(commands[cname].data.toJSON());
        else
            globalCommands.push(commands[cname].data.toJSON());
    }

    console.log("Refreshing global slash commands");

    const rest = new REST().setToken(config["token"]);

    const data = await rest.put(
        Routes.applicationCommands(config.applicationID),
        { body: globalCommands }
    ) as RESTPutAPIApplicationCommandsResult;

    console.log(`Successfully reloaded ${data.length} global application (/) commands`);

    console.log("Refreshing admin slash commands");

    for (const j in config.adminServers) {
        const guildId = config.adminServers[j];

        const adminData = await rest.put(
            Routes.applicationGuildCommands(config.applicationID, guildId.toString()),
            { body: adminCommands }
        ) as RESTPutAPIApplicationCommandsResult;

        console.log(`Successfully reloaded ${adminData.length} application (/) commands for guild ${guildId}`);
    }
}
