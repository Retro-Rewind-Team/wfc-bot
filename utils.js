const { client } = require("./index.js");
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

module.exports = {
    fcToPid: function(friendCode) {
        return parseInt(friendCode.replace(/-/g, ""), 10) >>> 0;
    },

    validateFc: function(friendCode) {
        return friendCode.match(fcRegex);
    },

    makeRequest: async function(interaction, fc, url) {
        try {
            var response = await fetch(url, { method: "GET" });

            if (response.ok)
                return true;
            else {
                var rjson = await response.json();
                console.log(rjson);
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

    sendEmbedLog: async function(interaction, action, fc, opts) {
        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} performed by ${interaction.member.displayName}`)
            .addFields({ name: "Moderator", value: `<@${interaction.member.id}>` }, { name: "Friend Code", value: fc })
            .setTimestamp();

        if (opts)
            embed.addFields(...opts);

        await client.channels.cache.get(config["logs-channel"]).send({ embeds: [embed] });

        interaction.reply({ content: `Successful ${action} performed on friend code ${fc}` });
    }
};
