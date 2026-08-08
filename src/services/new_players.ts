import { EmbedBuilder } from "discord.js";
import { getChannels, getConfig } from "#src/config.js";
import { createUserEmbed, makeWFCRequest as makeWFCRequest, WiiLinkUser, wrapTryCatch } from "#src/utils.js";
import { Service } from "#src/services/service.js";

const config = getConfig();
const channels = getChannels();

async function fetchNewPlayers(): Promise<void> {
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
    for (const user of res.Users as WiiLinkUser[]) {
        embeds.push(createUserEmbed(user, {
            priv: true,
            verbose: true,
            showBanInfo: false,
        }));
    }

    const message = channels.newPlayerLogs.send({
        embeds: embeds,
    });

    if (!message) {
        console.error("Failed to send message for new players!");
        return;
    }
}

export const service: Service = {
    async register(): Promise<void> {
        setInterval(wrapTryCatch(fetchNewPlayers), 60000);

        await wrapTryCatch(fetchNewPlayers)();
    },
};
