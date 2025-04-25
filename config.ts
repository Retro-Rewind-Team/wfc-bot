import { PermissionFlagsBits } from "discord.js";
import { Dictionary } from "./dictionary.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";

export interface Config {
    token: string
    applicationID: string
    statusServer: string
    wfcServer: string
    wfcPort: number
    wfcSecret: string
    adminServers: string[]
    allowedAdmins: string[]
    allowedModerators: string[]
    logsChannel: string
    publicLogsChannel: string
    packOwnersLogsChannel: string
    modRestrictPerm: string
    friendbot: string
    packOwners: Dictionary<string[]>
    pulsarToolsTag: string
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

    if (!config.modRestrictPerm
        || !(PermissionFlagsBits as Dictionary<bigint>)[config.modRestrictPerm])
        throw "No or an incorrect modRestrictPerm is set! Please set one to continue.";
}

export function initConfig(path: string) {
    _path = path;

    try {
        if (!existsSync(path))
            setConfig({
                token: "your bot's token",
                applicationID: "your application id",
                statusServer: "The status server to query miis from (RetroRewindRooms)",
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
                logsChannel: "Channel id to send successful moderative actions to.",
                publicLogsChannel: "Channel id to send the public version of moderative actions to.",
                packOwnersLogsChannel: "Channel id to send the hash logs to.",
                modRestrictPerm: "Permission used to restrict mod commands. See PermissionFlagsBits",
                friendbot: "FC used to link discord accounts to WFC profiles.",
                packOwners: {},
                pulsarToolsTag: "Stored release of pulsar tools. Will be overwritten with the latest version"
            });

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
    return _config;
}

export function setConfig(config: Config) {
    _config = config;

    writeFileSync(_path, JSON.stringify(_config, null, 4), { encoding: "utf8" });
}
