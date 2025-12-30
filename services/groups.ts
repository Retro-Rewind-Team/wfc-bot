import { Message, TextChannel } from "discord.js";
import { getConfig } from "../config.js";
import { client } from "../index.js";
import * as utils from "../utils.js";
import { Dictionary } from "../dictionary.js";

const config = getConfig();

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

let groups: Groups | null = null;

export function getGroups() {
    return groups;
}

const fetchGroupsUrl = `http://${config.wfcServer}:${config.wfcPort}/api/groups`;

async function fetchGroups() {
    let shouldPing = true;
    try {
        // Don't ping if this is the first groups response. This avoids pinging
        // when the bot is restarted.
        if (groups == null)
            shouldPing = false;

        const groupsJson = (await utils.queryJson(fetchGroupsUrl)) ?? utils.throwInline("Empty or no json response from groups api.");
        groups = { timestamp: Date.now(), rooms: groupsJson };

        if (config.logServices)
            console.log(`Successfully fetched groups! Time is ${new Date(Date.now())}`);

        // Push only rooms which are validly configured, so invalid rooms do
        // not show as being already pinged in logs
        if (!shouldPing) {
            for (const group of groups.rooms) {
                if (config.roomPingRoles[group.rk])
                    pingedRooms.push(group);
            }
        }
    }
    catch (e) {
        console.error(`Failed to fetch groups, error: ${e}`);
        return;
    }

    // if (!shouldPing)
    //     return;

    await sendPings();
}

const pingedRooms: Group[] = [];
const roomMessages: Dictionary<Message> = {};
async function sendPings() {
    // Update existing logged rooms
    for (const group of pingedRooms) {
        const roomMessage = roomMessages[group.id];
        if (!roomMessage) {
            if (config.logServices)
                console.log(`Missing message for group ${group.id}`);

            continue;
        }

        const groupName = config.roomTypeNameMap[group.rk] ?? group.rk;
        // Guaranteed to exist, otherwise the message would not exist
        const groupPing = config.roomPingRoles[group.rk];

        // Delete the room
        if (!groupsContains(groups!.rooms, group)) {
            const message = await roomMessage.edit(`<@&${groupPing}>, room ${group.id} has closed.`);

            // If the message fails to edit, do not delete the room
            if (!message) {
                console.log(`Failed to edit close message for ${group.id}`);
                continue;
            }

            if (config.logServices)
                console.log(`Room ${group.id} has closed`);

            pingedRooms.splice(groupsIndexOf(pingedRooms, group), 1);
            delete roomMessages[group.id];

            continue;
        }

        // Otherwise, update the room.
        const playerCount = Object.keys(group.players).length;
        const message = await roomMessage.edit(
            `<@&${groupPing}>, ${aOrAn(groupName)} ${groupName} room (${group.id}) is open with ${playerCount} ${utils.plural(playerCount, "player")}!`
        );

        if (!message)
            console.log(`Failed to edit message for room ${group.id}`);
        else if (config.logServices)
            console.log(`Updated room ${group.id} with playercount ${playerCount}`);
    }

    // Send out alerts for subscribed users
    // This handles new rooms
    for (const group of groups!.rooms) {
        if (group.type == "private") {
            if (config.logServices)
                console.log(`Skipping private room ${group.id}`);

            continue;
        }

        if (groupsContains(pingedRooms, group)) {
            if (config.logServices)
                console.log(`Room ${group.id} has already been pinged!`);

            continue;
        }

        const groupName = config.roomTypeNameMap[group.rk] ?? group.rk;
        const groupPing = config.roomPingRoles[group.rk];

        if (!groupPing) {
            if (config.logServices)
                console.error(`No role has been configured to alert for rooms of type ${group.rk}, for room ${group.id}`);

            continue;
        }

        const content = `<@&${groupPing}>, ${aOrAn(groupName)} ${groupName} room (${group.id}) has opened!`;

        if (config.logServices)
            console.log(`Sending message ${content}`);

        const message = await (client.channels.cache.get(config.roomPingChannel) as TextChannel | null)?.send({
            content: content,
        });

        if (!message) {
            console.error(`Failed to send message for group ${group.rk}!`);
            continue;
        }

        roomMessages[group.id] = message;
        pingedRooms.push(group);
    }
}

function groupsContains(groups: Group[], group: Group): boolean {
    for (const _group of groups) {
        if (_group.id == group.id)
            return true;
    }

    return false;
}

function groupsIndexOf(groups: Group[], group: Group) {
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id == group.id)
            return i;
    }

    return -1;
}

function aOrAn(following: string) {
    const start = following.charAt(0).toLowerCase();
    const isVowel = start == "a" || start == "e" || start == "i" || start == "o" || start == "u";

    return isVowel ? "an" : "a";
}

export default {
    register: function() {
        setInterval(fetchGroups, 60000);

        // Call to shut up the compiler.
        fetchGroups();
    },
};
