import { Client, GuildChannel, PermissionFlagsBits, TextChannel, VoiceChannel } from "discord.js";
import { Dictionary } from "./dictionary.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";

export interface Config {
    token: string
    applicationID: string
    miiEndPoint: string
    wfcServer: string
    wfcPort: number
    wfcSecret: string
    adminServers: string[]
    allowedAdmins: string[]
    allowedModerators: string[]
    allowedBKTUpdaters: string[]
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

function verifyConfig(config: Config) {
    if (!config.allowedAdmins
        || !Array.isArray(config.allowedAdmins)
        || config.allowedAdmins.length == 0)
        throw "No admins set! Please set one to continue.";

    if (!config.logsChannel || config.logsChannel.length == 0)
        throw "No logs channel is set! Please set one to continue.";

    if (!config.publicLogsChannel || config.publicLogsChannel.length == 0)
        throw "No public logs channel is set! Please set one to continue.";

    if (!config.packOwnersLogsChannel || config.packOwnersLogsChannel.length == 0)
        throw "No pack owners logs channel is set! Please set one to continue.";

    if (!config.crashReportChannel || config.crashReportChannel.length == 0)
        throw "No crash report channel is set! Please set one to continue.";

    if (!config.modRestrictPerm
        || !(PermissionFlagsBits as Dictionary<bigint>)[config.modRestrictPerm])
        throw "No modRestrictPerm is set or it is incorrect! Please set one to continue.";

    if (!config.roomPingChannel)
        throw "No roomPingChannel is set! Please set one to continue";
}

export function initConfig(path: string) {
    _path = path;

    try {
        if (!existsSync(path)) {
            setConfig({
                token: "your bot's token",
                applicationID: "your application id",
                miiEndPoint: "https://rwfc.net/api/leaderboard/player/{fc}/mii",
                wfcServer: "the wfc server to connect to, such as 'ppeb.me' or 'localhost'",
                wfcPort: 8080,
                wfcSecret: "your wfc secret key",
                adminServers: [
                    "Allow guild ids here."
                ],
                allowedAdmins: [
                    "Allow user ids here."
                ],
                allowedModerators: [
                    "Allow user ids here."
                ],
                allowedBKTUpdaters: [
                    "Allow user ids here."
                ],
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
        }

        const buf = readFileSync(path, { encoding: "utf8" });
        _config = JSON.parse(buf);

        verifyConfig(_config);
    }
    catch (e) {
        console.error(e);
        exit(1);
    }
}

export function getConfig(): Config {
    if (!_config)
        throw "_config accessed before being initialized";

    return _config;
}

export function setConfig(config: Config) {
    _config = config;

    writeFileSync(_path, JSON.stringify(_config, null, 4), { encoding: "utf8" });
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

export async function initChannels(client: Client<boolean>) {
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
    const ret = await client.channels.fetch(channelID);

    if (!ret)
        throw new Error(`Failed to fetch channelID ${channelID} for field ${fieldName}`);
    else
        console.log(`${fieldName} set to channel ${(ret as GuildChannel).name}`);

    return ret as T;
}
