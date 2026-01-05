import { EmbedBuilder } from "discord.js";
import { getChannels, getConfig } from "../config.js";
import { createUserEmbed, makeRequest, WiiLinkUser } from "../utils.js";

const config = getConfig();
const channels = getChannels();

const numRegex = /[0-9]+/;

async function fetchNewPlayers() {
    const [success, res] = await makeRequest("/api/new_players", "POST", {
        secret: config.wfcSecret,
    });

    if (!success) {
        console.error(`Failed to query new users! ${res.Error ?? "no error message provided"}`);
        return;
    }

    if (!res.Users || res.Users.length == 0) {
        if (config.logServices)
            console.log("Fetched users, but no new users have been created.");

        return;
    }

    let ping: boolean = false;

    const embeds: EmbedBuilder[] = [];
    for (const user of res.Users as WiiLinkUser[]) {
        embeds.push(createUserEmbed(user, true));

        // Ping wrkus for csnums within a specific range
        for (const csnum of user.Csnum) {
            const matches = numRegex.exec(csnum);

            if (!matches || matches.length < 1)
                continue;

            if (Number.parseInt(matches[0].slice(0, 2)) < 5)
                ping = true;
        }
    }

    const message = channels.newPlayerLogs.send({
        embeds: embeds,
        content: ping ? "<@391240445201743873>" : "",
    });

    if (!message) {
        console.error("Failed to send message for new players!");
        return;
    }
}

export default {
    register: function() {
        setInterval(fetchNewPlayers, 60000);
        fetchNewPlayers();
    }
};
