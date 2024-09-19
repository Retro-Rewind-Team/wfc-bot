const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const { client } = require("./index.js");
const config = require("./config.json");

const fcRegex = new RegExp(/[0-9]{4}-[0-9]{4}-[0-9]{4}/);
const pidRegex = new RegExp(/^\d+$/);
const urlBase = `http://${config["wfc-server"]}:${config["wfc-port"]}`;

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

                if (fc.length < 12)
                    fc = "0".repeat(12 - fc.length) + fc;

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

    makeRequest: async function(route, method, data) {
        try {
            const url = urlBase + route;
            var response = await fetch(url, {
                method: method,
                body: data ? JSON.stringify(data) : null
            });

            var rjson = await response.json();

            if (response.ok && !rjson.Error)
                return [true, rjson];
            else {
                console.error(`Failed to make request ${url}, response: ${rjson ? rjson.Error : "no error message provided"}`);

                return [false, rjson];
            }
        }
        catch (error) {
            console.error(`Failed to make request ${url}, error: ${error}`);

            return [false, { error: error }];
        }
    },

    sendEmbedLog: async function(interaction, action, fc, user, opts, hideMiiName = false, noPublicEmbed = false) {
        const miiName = user.LastInGameSn != "" ? user.LastInGameSn : "Unknown";

        const privEmbed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by ${interaction.member.displayName}`)
            .addFields(
                { name: "Server", value: interaction.guild.name },
                { name: "Moderator", value: `<@${interaction.member.id}>` },
                { name: "Friend Code", value: fc },
                { name: "Mii Name", value: miiName },
                { name: "IP", value: user.LastIPAddress != "" ? user.LastIPAddress : "Unknown", hidden: true }
            )
            .setTimestamp();

        if (opts)
            privEmbed.addFields(...opts);

        await client.channels.cache.get(config["logs-channel"]).send({ embeds: [privEmbed] });
        interaction.reply({ content: `Successful ${action} performed on friend code "${fc}"` });

        if (noPublicEmbed)
            return;

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
    },
};
