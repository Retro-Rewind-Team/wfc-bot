import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolvePidFromString, validateId } from "../utils.js";

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("convert_id")
        .setDescription("Convert between pids and fcs")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to convert")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error converting friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        await interaction.reply({ content: `PID: ${pid}\nFC: ${fc}`, ephemeral: true });
    }
};
