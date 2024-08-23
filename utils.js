const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const { client, getGroups } = require("./index.js");
const config = require("./config.json");
const urlBase = `http://${config["wfc-server"]}:${config["wfc-port"]}/api/`;

const fcRegex = new RegExp(/[0-9]{4}-[0-9]{4}-[0-9]{4}/);
const pidRegex = new RegExp(/^\d+$/);

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

    // Takes a string that's either an fc or pid and returns a pid
    resolvePidFromString: function(fcOrPid) {
        if (fcOrPid.includes("-"))
            return parseInt(fcOrPid.replace(/-/g, ""), 10) >>> 0;
        else
            return parseInt(fcOrPid);
    },

    // Checks if friendCode or Pid is correct
    validateId: function(fcOrPid) {
        return fcOrPid.match(pidRegex) || fcOrPid.match(fcRegex);
    },

    pidToFc: function(pid) {
        if (pid == 0)
            return "0000-0000-0000";
        else {
            try {
                const buffer = new Uint8Array(8);

                // buffer is pid in little endian, followed by RMCJ in little endian
                buffer[0] = pid >> 0;
                buffer[1] = pid >> 8;
                buffer[2] = pid >> 16;
                buffer[3] = pid >> 24;

                buffer[4] = ("J").charCodeAt(0); // the reversed online relevant game id
                buffer[5] = ("C").charCodeAt(0);
                buffer[6] = ("M").charCodeAt(0);
                buffer[7] = ("R").charCodeAt(0);

                const md5 = crypto.createHash("md5").update(buffer).digest();
                var fc = ((BigInt(md5.at(0) >> 1) << 32n) | BigInt(pid)).toString();

                return `${fc.slice(0, 4)}-${fc.slice(4, 8)}-${fc.slice(8, 12)}`;
            }
            catch {
                return "0000-0000-0000";
            }
        }
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
