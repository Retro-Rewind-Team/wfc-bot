import { AutocompleteInteraction, ButtonInteraction, CacheType, ChatInputCommandInteraction, Client, Events, IntentsBitField, MessageFlags, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPutAPIApplicationCommandsResult, Routes } from "discord.js";
import { getConfig, initChannels, initConfig } from "#src/config.js";
import { Dictionary } from "#src/dictionary.js";
import * as fs from "fs";
import * as path from "path";
import { Command, SharedInitializer } from "#src/commands/shared/command.js";
import { isAllowedInteraction, PermissionBit as PermissionBit } from "#src/commands/shared/roles.js";
import { shouldEnable } from "#src/feature_flags.js";
import { Service } from "#src/services/service.js";

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

await initConfig(configPath.length > 0 ? configPath : path.join(process.cwd(), "config.json"));
const config = getConfig();

function findCommandFiles(root: string): string[] {
    let ret: string[] = [];
    const files = fs.readdirSync(root);

    for (const file of files) {
        const full = path.join(root, file);

        if (file.endsWith(".js")) {
            ret.push(full);
            continue;
        }

        if (fs.statSync(full).isDirectory())
            ret = ret.concat(findCommandFiles(full));
    }

    return ret;
}

const cwd = import.meta.dirname ?? __dirname;

client.once(Events.ClientReady, async function(readyClient) {
    console.log(`Logged in as ${readyClient.user.tag}`);

    await initChannels(client);

    const commandsRoot = path.join(cwd, "commands");
    const commandFiles = findCommandFiles(commandsRoot);

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

        const servicesRoot = path.join(cwd, "services");
        const serviceFiles = fs.readdirSync(servicesRoot).filter(file => file.endsWith(".js"));
        await startServices(servicesRoot, serviceFiles);
    });
});

await client.login(config["token"]);

async function resolveCommands(files: string[], callback: (_: Dictionary<Command>) => void): Promise<void> {
    const ret: Dictionary<Command> = {};

    for (const file of files) {
        const commandFile = await import(file);
        const relative = path.relative(cwd, file);

        const spec: Command | SharedInitializer = commandFile.command ?? commandFile.initializer;

        if (spec == undefined || spec == null)
            continue;

        if (spec.featureFlags) {
            const [success, missing] = shouldEnable(spec.featureFlags, config.featureFlags);

            if (!success) {
                console.log(`Disabling spec ${relative}, Feature flags ${missing.join(", ")} missing.`);
                continue;
            }
        }

        if (spec.init) {
            spec.init()
                .then(() => console.log(`Ran init for spec ${relative}`))
                .catch(err => console.error(`Failed to run init for spec ${relative}, ${err}`));

            if (commandFile.initializer)
                continue;
        }

        if ("data" in spec && "exec" in spec) {
            const name = spec.data.name;
            console.log(`Registered command ${name} from file ${relative}`);
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
        const serviceFile = await import(path.join(root, file));
        const spec: Service = serviceFile.service;

        if (spec == undefined || spec == null)
            continue;

        if (spec.register) {
            spec.register()
                .then(() => console.log(`Started service ${file}`))
                .catch(err => console.error(`Error starting service ${file}: ${err}.`));
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
    const privilegedCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    for (const cname in commands) {
        const permissions = commands[cname].permissions;
        // Any command with restricted permissions is registered as a prvileged
        // command, and will only show on specified servers
        if (permissions != PermissionBit.NONE)
            privilegedCommands.push(commands[cname].data.toJSON());
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

    for (const j in config.privilegedServers) {
        const guildId = config.privilegedServers[j];

        const adminData = await rest.put(
            Routes.applicationGuildCommands(config.applicationID, guildId.toString()),
            { body: privilegedCommands }
        ) as RESTPutAPIApplicationCommandsResult;

        console.log(`Successfully reloaded ${adminData.length} application (/) commands for guild ${guildId}`);
    }
}
