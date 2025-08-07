import { getConfig } from "../config.js";
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
    try {
        const groupsJson = (await utils.queryJson(fetchGroupsUrl)) ?? utils.throwInline("Empty or no json response from groups api.");
        groups = { timestamp: Date.now(), rooms: groupsJson };

        console.log(`Successfully fetched groups! Time is ${new Date(Date.now())}`);
    }
    catch (e) {
        console.error(`Failed to fetch groups, error: ${e}`);
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
