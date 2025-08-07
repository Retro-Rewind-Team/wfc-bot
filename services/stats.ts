import { client } from "../index.js";
import { getConfig } from "../config.js";
import * as utils from "../utils.js";

const config = getConfig();

interface Stat {
    online: number,
    active: number,
    groups: number,
}

interface Stats {
    global: Stat,
    mariokartwii: Stat,
}

let stats: Stats | null = null;

export function getStats() {
    return stats;
}

const fetchStatsUrl = `http://${config.wfcServer}:${config.wfcPort}/api/stats`;

async function fetchStats() {
    try {
        stats = await utils.queryJson(fetchStatsUrl)
            ?? utils.throwInline("Empty or no json response from stats api.");
        const players = stats!.mariokartwii.active;
        const rooms = stats!.mariokartwii.groups;

        const presenceText =
            `${players} ${utils.plural(players, "player")} in ${rooms} ${utils.plural(rooms, "room")}!`;

        client.user?.setPresence({
            status: "online",
            activities: [{
                name: "Stats",
                type: 4,
                state: presenceText,
            }]
        });

        console.log(`Successfully fetched stats! Time is ${new Date(Date.now())}. ${presenceText}`);
    }
    catch (e) {
        console.error(`Failed to fetch stats, error: ${e}`);
    }
}

export default {
    register: function() {
        setInterval(fetchStats, 60000);
        fetchStats();
    },
};
