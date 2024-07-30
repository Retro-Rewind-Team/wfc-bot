const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getGroups } = require("../index.js");
const { getColor } = require("../utils.js");

function listRooms(interaction, groups) {
    const embed = new EmbedBuilder();

    const access = [];
    const type = [];
    const playerCounts = [];
    const ids = [];
    const created = [];
    for (const room of groups.rooms) {
        var roomType;
        if (room.rk == "vs_10" || room.rk == "vs_751")
            roomType = "VS";
        else if (room.rk == "vs_11")
            roomType = "TT";
        else
            roomType = "??";

        access.push(room.type == "private" ? "Private" : "Public");
        type.push(roomType);
        playerCounts.push(Object.keys(room.players).length);
        ids.push(room.id);
        created.push(`<t:${Math.floor(new Date(room.created).getTime() / 1000)}:t>`);
    }

    embed.setTitle("Retro Rewind Room Info")
        .setFields(
            {
                name: "Access",
                value: access.join("\n"),
                inline: true
            },
            {
                name: "Type",
                value: type.join("\n"),
                inline: true
            },
            {
                name: "Players",
                value: playerCounts.join("\n"),
                inline: true
            },
            {
                name: "ID",
                value: ids.join("\n"),
                inline: true
            },
            {
                name: "Created",
                value: created.join("\n"),
                inline: true
            }
        );

    interaction.reply({ embeds: [embed] });
}

function listRoom(interaction, groups, rid) {
    const embed = new EmbedBuilder()
        .setColor(getColor());

    interaction.reply({ embeds: [embed] });
}

module.exports = {
    modOnly: false,

    data: new SlashCommandBuilder()
        .setName("rooms")
        .setDescription("List open rooms")
        .addStringOption(option => option.setName("room-id")
            .setDescription("Room ID to query")),

    exec: async function(interaction) {
        const groups = getGroups();

        if (!groups) {
            interaction.reply("Room data is not populated yet! Please wait a moment. If this keeps happening contact the bot owner.");
            return;
        }

        const rid = interaction.options.getString("room-id");

        if (rid)
            listRoom(interaction, groups, rid);
        else
            listRooms(interaction, groups);
    }
};
