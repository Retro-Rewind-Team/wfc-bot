import { EmbedBuilder } from "discord.js";
import { getChannels, getConfig } from "../config.js";
import { createUserEmbed, makeWFCRequest as makeWFCRequest, WiiLinkUser, wrapTryCatch } from "../utils.js";

const config = getConfig();
const channels = getChannels();

async function fetchNewPlayers() {
    const [success, res] = await makeWFCRequest("/new_players", "POST", {
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

    const embeds: EmbedBuilder[] = [];
    for (const user of res.Users as WiiLinkUser[])
        embeds.push(createUserEmbed(user, true));

    const message = channels.newPlayerLogs.send({
        embeds: embeds,
    });

    if (!message) {
        console.error("Failed to send message for new players!");
        return;
    }
}

export default {
    register: function() {
        setInterval(wrapTryCatch(fetchNewPlayers), 60000);

        wrapTryCatch(fetchNewPlayers)();
    }
};
