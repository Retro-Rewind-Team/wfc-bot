import { Client, GuildChannel, PermissionFlagsBits, TextChannel, VoiceChannel } from "discord.js";
import { Dictionary } from "./dictionary.js";
import { PermissionBit } from "./commands/shared/roles.js";
import { fileExists } from "./fs_helpers.js";
import * as fs from "fs/promises";
import * as process from "process";

export interface Config {
    token: string
    applicationID: string
    miiEndPoint: string
    wfcAPIBase: string
    wfcSecret: string
    privilegedServers: string[]
    userPermissions: Dictionary<number>,
    logsChannel: string
    publicLogsChannel: string
    packOwnersLogsChannel: string
    crashReportChannel: string
    newPlayerLogsChannel: string,
    statusChannel: string,
    roomPingChannel: string,
    roomTypeNameMap: Dictionary<string>,
    roomPingRoles: Dictionary<string>,
    highVRPingRole: string,
    highVRMinVR: number,
    highVRMinPlayers: number,
    modRestrictPerm: string
    friendbot: string
    packOwners: Dictionary<string[]>
    pulsarToolsTag: string
    leaderboardServer: string
    leaderboardPort: number
    logServices: boolean
}

let _config: Config;
let _path: string;

function verifyConfig(config: Config): void {
    if (!config.userPermissions || config.userPermissions.length == 0)
        throw "At least one user must have the super admin permission (bit 1)!";

    let foundSuperAdmin: boolean = false;

    for (const user in config.userPermissions) {
        const bits = config.userPermissions[user];
        foundSuperAdmin ||= !!(bits & PermissionBit.SUPER_ADMIN);
    }

    if (!foundSuperAdmin)
        throw "At least one user must have the super admin permission (bit 1)!";

    if (!config.modRestrictPerm
        || !(PermissionFlagsBits as Dictionary<bigint>)[config.modRestrictPerm])
        throw "No modRestrictPerm is set or it is incorrect! Please set one to continue.";

    if (!config.wfcAPIBase || config.wfcAPIBase.length == 0)
        throw "No wfcAPIBase is set! Please set one to continue.";
}

export async function initConfig(path: string): Promise<void> {
    _path = path;

    try {
        if (!fileExists(path)) {
            await setConfig({
                token: "your bot's token",
                applicationID: "your application id",
                miiEndPoint: "https://rwfc.net/api/leaderboard/player/{fc}/mii",
                wfcAPIBase: "base route for wfc apis. Something like http://rwfc.net/api",
                wfcSecret: "your wfc secret key",
                privilegedServers: [
                    "Allow guild ids here."
                ],
                userPermissions: {},
                logsChannel: "Channel id to send successful moderative actions to.",
                publicLogsChannel: "Channel id to send the public version of moderative actions to.",
                packOwnersLogsChannel: "Channel id to send the hash logs to.",
                crashReportChannel: "Channel id to send crash reports to.",
                newPlayerLogsChannel: "Channel id to send new players to.",
                statusChannel: "Channel to update with status messages.",
                roomPingChannel: "Channel id to send room openings to.",
                roomTypeNameMap: {},
                roomPingRoles: {},
                highVRPingRole: "Role ID for the high vr ping role",
                highVRMinVR: 40000, // it's the threshold where if a room is above it the highVrPingRole will be pinged.
                highVRMinPlayers: 6,
                modRestrictPerm: "Permission used to restrict mod commands. See PermissionFlagsBits",
                friendbot: "FC used to link discord accounts to WFC profiles.",
                packOwners: {},
                pulsarToolsTag: "Stored release of pulsar tools. Will be overwritten with the latest version",
                leaderboardPort: 5000,
                leaderboardServer: "localhost",
                logServices: false,
            });

            throw "No config.json was provided. One has been generated for you, please adjust it before retrying!";
        }

        const buf = await fs.readFile(path, { encoding: "utf8" });
        _config = JSON.parse(buf);

        if (migrateConfig(_config)) {
            console.log("Config migrated, saving config");
            await setConfig(_config);
            console.log("Config saved");
        }
        verifyConfig(_config);
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}

export function getConfig(): Config {
    if (!_config)
        throw "_config accessed before being initialized";

    return _config;
}

export async function setConfig(config: Config): Promise<void> {
    _config = config;

    await fs.writeFile(_path, JSON.stringify(_config, null, 4), { encoding: "utf8" });
}

interface Channels {
    logs: TextChannel,
    publicLogs: TextChannel,
    packOwnersLogs: TextChannel,
    crashReport: TextChannel,
    newPlayerLogs: TextChannel,
    roomPing: TextChannel,
    status: VoiceChannel,
}

let _channels: Channels;

export async function initChannels(client: Client<boolean>): Promise<void> {
    _channels = {
        logs: await fetchChannel<TextChannel>(client, _config.logsChannel, "logs"),
        publicLogs: await fetchChannel<TextChannel>(client, _config.publicLogsChannel, "publicLogs"),
        packOwnersLogs: await fetchChannel<TextChannel>(client, _config.packOwnersLogsChannel, "packOwnersLogs"),
        crashReport: await fetchChannel<TextChannel>(client, _config.crashReportChannel, "crashReport"),
        newPlayerLogs: await fetchChannel<TextChannel>(client, _config.newPlayerLogsChannel, "newPlayerLogs"),
        roomPing: await fetchChannel<TextChannel>(client, _config.roomPingChannel, "roomPing"),
        status: await fetchChannel<VoiceChannel>(client, _config.statusChannel, "status"),
    };
}

export function getChannels(): Channels {
    if (!_channels)
        throw "_channels accessed before being initialized";

    return _channels;
}

async function fetchChannel<T>(client: Client<boolean>, channelID: string, fieldName: string): Promise<T> {
    if (!channelID || channelID.length == 0)
        throw `channelID is null or empty for channel ${fieldName}. Please set one to continue.`;

    const ret = await client.channels.fetch(channelID);

    if (!ret)
        throw new Error(`Failed to fetch channelID ${channelID} for field ${fieldName}`);
    else
        console.log(`${fieldName} set to channel ${(ret as GuildChannel).name}`);

    return ret as T;
}

function migrateConfig(config: Config): boolean {
    console.log("Attempting to migrate config");

    const m1 = migrateOldPermission(config, "allowedAdmins", PermissionBit.ADMIN);
    const m2 = migrateOldPermission(config, "allowedModerators", PermissionBit.MODERATOR);
    const m3 = migrateOldPermission(config, "allowedBKTUpdaters", PermissionBit.BKT_UPDATER);

    const m4 = migrateAdminServers(config);

    return m1 || m2 || m3 || m4;
}

function migrateOldPermission(
    config: Config,
    field: string,
    permissionBit: PermissionBit
): boolean {
    // Reference to config as a Dictionary so we can access old fields
    const oldConfig = config as unknown as Dictionary<unknown>;

    const allowedUsers = oldConfig[field] as string[];
    if (allowedUsers && allowedUsers.length != 0) {
        console.log(`Removing ${field} from config`);

        for (const user of allowedUsers) {
            const userBits = config.userPermissions[user] ?? 0;
            config.userPermissions[user] = userBits | permissionBit;

            console.log(`Adding bit ${PermissionBit[permissionBit]} to ID ${user}`);
        }

        delete (oldConfig)[field];
        return true;
    }

    return false;
}

function migrateAdminServers(config: Config): boolean {
    const oldConfig = config as unknown as Dictionary<unknown>;

    const adminServers = oldConfig["adminServers"] as string[];
    if (adminServers && adminServers.length != 0) {
        console.log("Removing adminServers from config");

        config.privilegedServers = adminServers;

        delete (oldConfig)["adminServers"];
        return true;
    }

    return false;
}
