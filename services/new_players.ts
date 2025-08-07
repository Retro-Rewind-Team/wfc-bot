import { EmbedBuilder, TextChannel } from "discord.js";
import { client, } from "../index.js";
import { getConfig } from "../config.js";
import { createUserEmbed, makeRequest, WiiLinkUser } from "../utils.js";

const config = getConfig();

async function fetchNewPlayers() {
    const [res, success] = await makeRequest("/api/new_players", "POST", {
        secret: config.wfcSecret,
    });

    if (!success) {
        console.error(`Failed to query new users! ${res.Error ?? "no error message provided"}`);
        return;
    }

    if (!res.Users || res.Users.length == 0) {
        console.log("Fetched users, but no new users have been created.");
        return;
    }

    const embeds: EmbedBuilder[] = [];
    for (const user of res.Users as WiiLinkUser[])
        embeds.push(createUserEmbed(user, true));


    const message = await (client.channels.cache.get(config.crashReportChannel) as TextChannel | null)?.send({
        embeds: embeds,
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
