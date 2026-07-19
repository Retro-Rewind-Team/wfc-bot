import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { pinfo } from "../shared/pinfo.js";

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("pinfo")
        .setDescription("Query information for a given player id")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        await pinfo(interaction, false);
    }
};
