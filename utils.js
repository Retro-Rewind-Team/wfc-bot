const { client, getGroups } = require("./index.js");
const config = require("./config.json");
const { EmbedBuilder } = require("discord.js");

const urlBase = `http://${config["wfc-server"]}:${config["wfc-port"]}/api/`;
const fcRegex = new RegExp(/[0-9]{4}-[0-9]{4}-[0-9]{4}/);

var currentColor = 0;
const colors = [
    0xf38ba8,
    0xfab387,
    0xf9e2af,
    0xa6e3a1,
    0x89b4fa,
    0xb4befe,
];

function getColor() {
    currentColor++;

    if (currentColor >= colors.length)
        currentColor = 0;

    return colors[currentColor];
}

function getMiiName(fc) {
    const rooms = getGroups().rooms;

    for (const room of rooms) {
        for (const idx in room.players) {
            if (room.players[idx].fc == fc)
                return room.players[idx].name;
        }
    }

    return null;
}

module.exports = {
    getColor: getColor,

    fcToPid: function(friendCode) {
        return parseInt(friendCode.replace(/-/g, ""), 10) >>> 0;
    },

    validateFc: function(friendCode) {
        return friendCode.match(fcRegex);
    },

    plural: function(count, text) {
        return count == 1 ? text : text + "s";
    },

    makeRequest: async function(interaction, fc, url) {
        try {
            var response = await fetch(url, { method: "GET" });
            var rjson = await response.json();

            if (response.ok && !rjson.error)
                return true;
            else {
                console.error(`Failed to make request ${url}, response: ${rjson ? rjson.error : "no error message provided"}`);
                interaction.reply({ content: `Failed to perform operation on friend code "${fc}": error ${rjson ? rjson.error : "no error message provided"}` });

                return false;
            }
        }
        catch (error) {
            console.error(`Error performing operation on friend code "${fc}": ${error}`);
            await interaction.reply({ content: `Error performing operation on friend code "${fc}": ${error}` });

            return false;
        }
    },

    makeUrl: function(path, opts) {
        return `${urlBase}${path}?secret=${config["wfc-secret"]}${opts}`;
    },

    sendEmbedLog: async function(interaction, action, fc, opts, hideMiiName = false) {
        const miiName = getMiiName(fc) ?? "Unknown";

        const privEmbed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by ${interaction.member.displayName}`)
            .addFields(
                { name: "Server", value: interaction.guild.name },
                { name: "Moderator", value: `<@${interaction.member.id}>` },
                { name: "Friend Code", value: fc },
                { name: "Mii Name", value: miiName }
            )
            .setTimestamp();

        if (opts)
            privEmbed.addFields(...opts);

        await client.channels.cache.get(config["logs-channel"]).send({ embeds: [privEmbed] });

        const pubEmbed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by moderator`)
            .addFields(
                { name: "Server", value: interaction.guild.name },
                { name: "Friend Code", value: fc },
                { name: "Mii Name", value: hideMiiName ? "\\*\\*\\*\\*\\*" : miiName }
            )
            .setTimestamp();

        if (opts) {
            const filtered = opts.filter((opt) => !opt["hidden"]);

            pubEmbed.addFields(...filtered);
        }

        await client.channels.cache.get(config["public-logs-channel"]).send({ embeds: [pubEmbed] });

        interaction.reply({ content: `Successful ${action} performed on friend code "${fc}"` });
    },
};
