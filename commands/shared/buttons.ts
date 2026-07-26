import { ButtonBuilder, ButtonStyle } from "discord.js";

export const Buttons = {
    start: new ButtonBuilder()
        .setCustomId("start")
        .setLabel("<<")
        .setStyle(ButtonStyle.Primary),
    back: new ButtonBuilder()
        .setCustomId("back")
        .setLabel("<")
        .setStyle(ButtonStyle.Primary),
    forward: new ButtonBuilder()
        .setCustomId("forward")
        .setLabel(">")
        .setStyle(ButtonStyle.Primary),
    end: new ButtonBuilder()
        .setCustomId("end")
        .setLabel(">>")
        .setStyle(ButtonStyle.Primary),
};
