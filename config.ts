import { existsSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";

interface Dictionary<T> { [key: string]: T }

interface Config {
    token: string
    applicationID: string
    wfcServer: string
    wfcPort: number
    wfcSecret: string
    adminServers: string[]
    allowedAdmins: string[]
    allowedModerators: string[]
    logsChannel: string
    publicLogsChannel: string
    friendbot: string
    packOwners: Dictionary<string[]>
}

let _config: Config;
let _path: string;

export function initConfig(path: string) {
    _path = path;

    try {
        if (!existsSync(path))
            setConfig({
                token: "your bot's token",
                applicationID: "your application id",
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
                friendbot: "FC used to link discord accounts to WFC profiles.",
                packOwners: {},
            });

        const buf = readFileSync(path, { encoding: "utf8" });
        _config = JSON.parse(buf);
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
