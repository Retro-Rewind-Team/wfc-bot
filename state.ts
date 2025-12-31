import { Message } from "discord.js";
import { Dictionary } from "./dictionary.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { exit } from "process";
import { getChannels } from "./config.js";
import { Group } from "./services/groups.js";

const channels = getChannels();

const STATE_PATH: string = "./state.json";

export class State {
    public messages: Dictionary<Message>;
    public pingedRooms: Group[];

    constructor(messages: Dictionary<Message>, pingedRooms: Group[]) {
        this.messages = messages;
        this.pingedRooms = pingedRooms;
    }

    toSerialized(): StateSerialized {
        const messages: Dictionary<string> = {};

        for (const key of Object.keys(this.messages))
            messages[key] = this.messages[key].id;

        return { messages: messages, pingedRooms: this.pingedRooms };
    }

    static async fromSerialized(stateSerialized: StateSerialized): Promise<State> {
        const messages: Dictionary<Message> = {};

        for (const key of Object.keys(stateSerialized.messages)) {
            const message = await channels.roomPing.messages.fetch(stateSerialized.messages[key]);

            if (message)
                messages[key] = message;
            else
                console.error(`Message for ID ${key}:${stateSerialized.messages[key]} could not be found!`);
        }

        return new State(messages, stateSerialized.pingedRooms);
    }

    save() {
        const stateSerialized = this.toSerialized();

        writeFileSync(STATE_PATH, JSON.stringify(stateSerialized));
    }
}

interface StateSerialized {
    messages: Dictionary<string>;
    pingedRooms: Group[];
}

export async function loadState(): Promise<State> {
    try {
        if (!existsSync(STATE_PATH)) {
            const state = new State({}, []);
            state.save();
            return state;
        }

        const buf = readFileSync(STATE_PATH, { encoding: "utf8" });
        return State.fromSerialized(JSON.parse(buf));
    }
    catch (e) {
        console.error(e);
        exit(1);
    }
}
