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

const fetchStatsUrl = `${config.wfcAPIBase}/stats`;

async function fetchStats() {
    stats = await utils.queryJson(fetchStatsUrl)
        ?? utils.throwInline("Empty or no json response from stats api.");
    const playersInRooms = stats?.mariokartwii?.active ?? 0;
    const playersOnline = stats?.mariokartwii?.online ?? 0;
    const rooms = stats?.mariokartwii?.groups ?? 0;

    const presenceText =
        `${playersInRooms}(${playersOnline}) ${utils.plural(playersInRooms, "player")} in ${rooms} ${utils.plural(rooms, "room")}!`;

    client.user?.setPresence({
        status: "online",
        activities: [{
            name: "Stats",
            type: 4,
            state: presenceText,
        }]
    });

    if (config.logServices)
        console.log(`Successfully fetched stats! Time is ${new Date(Date.now())}. ${presenceText}`);
}

export default {
    register: function() {
        setInterval(utils.wrapTryCatch(fetchStats), 60000);

        utils.wrapTryCatch(fetchStats)();
    },
};
