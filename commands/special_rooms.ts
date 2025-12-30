import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getGroups, Group } from "../services/groups.js";
import { getConfig } from "../config.js";
import { getColor } from "../utils.js";

const config = getConfig();

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("special_rooms")
        .setDescription("Show open special mode rooms"),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const groups = getGroups();

        if (!groups) {
            await interaction.reply({
                content: "Rooms have not been fetched yet! Try again in a few minutes.",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const specialRooms: Group[] = [];
        for (const group of groups.rooms) {
            if (config.roomPingRoles[group.rk])
                specialRooms.push(group);
        }

        if (specialRooms.length == 0) {
            await interaction.reply({
                content: "No special rooms are open right now!",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const embeds: EmbedBuilder[] = [];

        for (const group of specialRooms) {
            const players = Object.values(group.players);
            const playersWithVR = players.filter(player => player.ev != undefined);
            const avgVR = playersWithVR.reduce((sum, player) => sum + Number(player.ev || 0), 0) / playersWithVR.length;

            embeds.push(new EmbedBuilder()
                .setColor(getColor())
                .setTitle(`${config.roomTypeNameMap[group.rk]} Room (${group.id})`)
                .addFields(
                    { name: "Players", value: Object.keys(group.players).length.toString() },
                    { name: "Average VR", value: Math.round(avgVR).toString() },
                    { name: "Uptime", value: formatUptime(new Date(group.created), new Date(Date.now())) },
                )
            );
        }

        await interaction.reply({
            embeds: embeds,
            flags: MessageFlags.Ephemeral,
        });
    }
};

function pad(num: number, size: number) {
    let _num = num.toString();
    while (_num.length < size)
        _num = "0" + _num;

    return _num;
}

function formatUptime(startDate: Date, endDate: Date) {
    let timeDiff = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    timeDiff -= hours * (1000 * 60 * 60);

    const mins = Math.floor(timeDiff / (1000 * 60));
    timeDiff -= mins * (1000 * 60);

    const seconds = Math.floor(timeDiff / (1000));
    timeDiff -= seconds * (1000);

    return `${pad(hours, 2)}:${pad(mins, 2)}:${pad(seconds, 2)}`;
}
