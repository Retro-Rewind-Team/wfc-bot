import { Message } from "discord.js";
import { Dictionary } from "./dictionary.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";
import { getChannels } from "./config.js";
import { Group } from "./services/groups.js";
import { Status, StatusColor } from "./commands/shared/server_status.js";

const channels = getChannels();

const STATE_PATH: string = "./state.json";

export class State {
    public messages: Dictionary<Message>;
    public pingedRooms: Group[];
    public status: Status;
    public motd: string;

    constructor(messages: Dictionary<Message>, pingedRooms: Group[], status: Status, motd: string) {
        this.messages = messages;
        this.pingedRooms = pingedRooms;
        this.status = status;
        this.motd = motd;
    }

    toSerialized(): StateSerialized {
        const messages: Dictionary<string> = {};

        for (const key of Object.keys(this.messages))
            messages[key] = this.messages[key].id;

        return {
            messages: messages,
            pingedRooms: this.pingedRooms,
            status: this.status,
            motd: this.motd,
        };
    }

    static async fromSerialized(stateSerialized: StateSerialized): Promise<State> {
        const messages: Dictionary<Message> = {};

        for (const key of Object.keys(stateSerialized.messages)) {
            try {
                const message = await channels.roomPing.messages.fetch(stateSerialized.messages[key]);

                if (message)
                    messages[key] = message;
                else
                    console.error(`Message for ID ${key}:${stateSerialized.messages[key]} could not be found!`);
            }
            catch (error) {
                console.error(`Message for ID ${key}:${stateSerialized.messages[key]} could not be loaded! error: ${error}`);
                continue;
            }
        }

        return new State(messages, stateSerialized.pingedRooms, stateSerialized.status, stateSerialized.motd);
    }

    save() {
        const stateSerialized = this.toSerialized();

        writeFileSync(STATE_PATH, JSON.stringify(stateSerialized));
    }
}

interface StateSerialized {
    messages: Dictionary<string>;
    pingedRooms: Group[];
    status: Status;
    motd: string;
}

const defaultState: State = new State({}, [], { color: StatusColor.GREEN, message: "ONLINE" }, "");
let _state: State | null = null;

export async function loadState(): Promise<State> {
    if (_state != null)
        return _state;

    try {
        if (!existsSync(STATE_PATH)) {
            _state = defaultState;
            _state.save();
            return _state;
        }

        const buf = readFileSync(STATE_PATH, { encoding: "utf8" });
        if (buf == null || buf.length == 0) {
            _state = defaultState;
            _state.save();
            return _state;
        }

        _state = await State.fromSerialized(JSON.parse(buf));
        return _state;
    }
    catch (e) {
        console.error(e);
        exit(1);
    }
}
