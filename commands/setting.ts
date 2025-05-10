import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getColor } from "../utils.js";


export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("setting")
        .setDescription("View the contents of a settings (setting.txt) file. Do not share this except with moderation.")
        .addAttachmentOption(option => option.setName("file")
            .setDescription("The settings file")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const binaryAttachment = interaction.options.getAttachment("file", true);
        const binaryResponse = await fetch(binaryAttachment.url);

        if (!binaryResponse.ok) {
            await interaction.reply({
                content: `Error fetching settings attachment: ${binaryResponse.status}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Credit to Gab. See https://gabrlel.github.io/NAPTweb.html
        const buffer = Buffer.from(await binaryResponse.arrayBuffer());
        const out = [];
        let key = 0x73B5DBFA >>> 0;

        for (let i = 0; i < buffer.length; i++) {
            const curByte = buffer.at(i);
            if (!curByte)
                break;

            const decoded = curByte ^ (key & 0xFF);
            if (decoded == 0)
                break;

            out.push(decoded);

            key = ((key << 1) | (key >>> 31)) >>> 0; // Tremendous?
        }

        const text = new TextDecoder("ascii").decode(new Uint8Array(out));

        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle("Settings");

        let code = null;
        let serno = null;

        const lines = text.split("\n");
        for (const line of lines) {
            const split = line.split("=");

            // Should never happen...
            if (split.length < 2)
                continue;

            const field = split[0];
            const value = split[1];

            if (field == "CODE")
                code = value.trim();
            else if (field == "SERNO")
                serno = value.trim();

            embed.addFields({
                name: field,
                value: value,
            });
        }

        if (code && serno) {
            embed.addFields({
                name: "CSNUM",
                value: `${code}${serno}`,
            });
        }

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
};
