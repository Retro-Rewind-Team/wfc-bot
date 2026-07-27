import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, MessageFlags } from "discord.js";

export function getNavigationButtons(userID: string, idx: number = 0, maxIdx: number = -1): ButtonBuilder[] {
    return [
        new ButtonBuilder()
            .setCustomId(`start-${userID}`)
            .setLabel("<<")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(idx == 0),
        new ButtonBuilder()
            .setCustomId(`back-${userID}`)
            .setLabel("<")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(idx == 0),
        new ButtonBuilder()
            .setCustomId(`forward-${userID}`)
            .setLabel(">")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(idx == maxIdx),
        new ButtonBuilder()
            .setCustomId(`end-${userID}`)
            .setLabel(">>")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(idx == maxIdx),
    ];
}

// Splits a custom ID into its name and userID
export function parseButtonCustomID(customID: string): [string, string] {
    const split = customID.split("-");
    if (split.length != 2)
        return [customID, ""];

    return [split[0], split[1]];
}

export function newIndexFromButtonInteraction(interaction: ButtonInteraction<CacheType>, currentIdx: number, maxIdx: number): number {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [name, _] = parseButtonCustomID(interaction.customId);
    let newIdx = -1;

    switch (name) {
    case "start":
        newIdx = 0;
        break;
    case "forward":
        newIdx = currentIdx + 1;
        break;
    case "end":
        newIdx = maxIdx;
        break;
    case "back":
        newIdx = currentIdx - 1;
        break;
    }

    if (newIdx > maxIdx)
        newIdx = maxIdx;

    if (newIdx < 0)
        newIdx = 0;

    return newIdx;
}

export async function validateButtonInteraction(interaction: ButtonInteraction<CacheType>): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, userID] = parseButtonCustomID(interaction.customId);

    if (userID != interaction.user.id) {
        await interaction.reply({
            content: "This button is not allowed",
            flags: MessageFlags.Ephemeral,
        });

        return false;
    }

    return true;
}
