import { getConfig } from "#src/config.js";
import { client } from "#src/index.js";
import * as utils from "#src/utils.js";
import { Service } from "#src/services/service.js";

const config = getConfig();

interface Stat {
    online: number;
    active: number;
    groups: number;
}

interface Stats {
    global: Stat;
    mariokartwii: Stat;
}

let stats: Stats | null = null;

export function getStats(): Stats | null {
    return stats;
}

const fetchStatsUrl = `${config.wfcAPIBase}/stats`;

async function fetchStats(): Promise<void> {
    stats = await utils.queryJson<Stats>(fetchStatsUrl)
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
        }],
    });

    if (config.logServices)
        console.log(`Successfully fetched stats! Time is ${new Date(Date.now())}. ${presenceText}`);
}

export const service: Service = {
    async register(): Promise<void> {
        setInterval(utils.wrapTryCatch(fetchStats), 60000);

        await utils.wrapTryCatch(fetchStats)();
    },
};
