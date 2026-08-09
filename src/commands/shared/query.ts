import { getNavigationButtons, newIndexFromButtonInteraction, validateButtonInteraction } from "#src/commands/shared/buttons.js";
import { Dictionary } from "#src/dictionary.js";
import { registerButtonHandlerByMessageID } from "#src/index.js";
import { createUserEmbed, CreateUserEmbedOpts, WiiLinkUser } from "#src/utils.js";
import { ActionRowBuilder, APIMessageTopLevelComponent, ButtonInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

interface QueryState {
    Embeds: EmbedBuilder[];
    Idx: number;
}

const stateByMessageID: Dictionary<QueryState> = {};

// Create embeds and reply with a user-list.
// Expects a deferred interaction
export async function replyUserEmbedList(
    interaction: ChatInputCommandInteraction<CacheType>,
    users: WiiLinkUser[],
    opts: CreateUserEmbedOpts,
): Promise<void> {
    const embeds: EmbedBuilder[] = [];

    for (let i = 0; i < users.length; i++) {
        embeds.push(
            createUserEmbed(users[i], opts)
                .setFooter({ text: `User ${i+1} of ${users.length }` }),
        );
    }

    if (embeds.length == 1) {
        await interaction.editReply({ embeds: embeds });
        return;
    }

    const row = new ActionRowBuilder()
        .addComponents(getNavigationButtons(interaction.user.id));

    const res = await interaction.editReply({
        embeds: [embeds[0]],
        components: [row as unknown as APIMessageTopLevelComponent],
    });

    registerButtonHandlerByMessageID(
        res.id,
        300000, // 5 minutes
        (messageID) => {
            delete stateByMessageID[messageID];
        },
        handleButton,
    );

    stateByMessageID[res.id] = {
        Embeds: embeds,
        Idx: 0,
    };
}

async function handleButton(buttonInteraction: ButtonInteraction<CacheType>): Promise<void> {
    if (!await validateButtonInteraction(buttonInteraction))
        return;

    const state = stateByMessageID[buttonInteraction.message.id];

    const maxIdx = state.Embeds.length - 1;
    state.Idx = newIndexFromButtonInteraction(
        buttonInteraction,
        state.Idx,
        maxIdx,
    );

    const row = new ActionRowBuilder()
        .addComponents(
            getNavigationButtons(
                buttonInteraction.user.id,
                state.Idx,
                maxIdx,
            ),
        );

    await buttonInteraction.update({
        embeds: [state.Embeds[state.Idx]],
        components: [row as unknown as APIMessageTopLevelComponent],
    });
}
