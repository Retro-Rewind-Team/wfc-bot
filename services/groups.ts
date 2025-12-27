import { TextChannel } from "discord.js";
import { getConfig } from "../config.js";
import { client } from "../index.js";
import * as utils from "../utils.js";

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
    }
    catch (e) {
        console.error(`Failed to fetch groups, error: ${e}`);
        return;
    }

    if (!shouldPing)
        return;

    await sendPings();
}

const pingedRooms: string[] = [];
async function sendPings() {
    const currentRooms: string[] = [];

    // Send out alerts for subscribed users
    for (const group of groups!.rooms) {
        currentRooms.push(group.id);

        if (pingedRooms.includes(group.id))
            continue;

        const groupName = config.roomTypeNameMap[group.rk] ?? group.rk;
        const groupPing = config.roomPingRoles[group.rk];

        let content = "";

        if (!groupPing) {
            console.error(`No role has been configured to alert for rooms of type ${group.rk}`);
            content = `A ${groupName} room (${group.id}) has opened!`;
        }
        else
            content = `<@&${groupPing}>, a ${groupName} room (${group.id}) has opened!`;

        const message = await (client.channels.cache.get(config.roomPingChannel) as TextChannel | null)?.send({
            content: content,
        });

        if (!message) {
            console.error(`Failed to send message for group ${group.rk}!`);
            continue;
        }
    }

    // Clear rooms which no longer exist from pingedRooms, to avoid it filling
    // up over time
    for (const id of pingedRooms) {
        if (!currentRooms.includes(id))
            pingedRooms.splice(pingedRooms.indexOf(id), 1);
    }
}

export default {
    register: function() {
        // TODO: Groups unused for now
        // setInterval(fetchGroups, 60000);

        // Call to shut up the compiler.
        fetchGroups();
    },
};
