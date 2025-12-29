import { ActionRowBuilder, APIMessageTopLevelComponent, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getConfig } from "../config.js";
import { Dictionary } from "../dictionary.js";
import { registerButtonHandlerByMessageID } from "../index.js";
import { createUserEmbed, makeRequest, resolveModRestrictPermission, resolvePidFromString, validateID } from "../utils.js";

const config = getConfig();

interface QueryState {
    Embeds: EmbedBuilder[];
    Idx: number;
}

const stateByMessageID: Dictionary<QueryState> = {};

const start = new ButtonBuilder()
    .setCustomId("start")
    .setLabel("<<")
    .setStyle(ButtonStyle.Primary);

const back = new ButtonBuilder()
    .setCustomId("back")
    .setLabel("<")
    .setStyle(ButtonStyle.Primary);

const forward = new ButtonBuilder()
    .setCustomId("forward")
    .setLabel(">")
    .setStyle(ButtonStyle.Primary);

const end = new ButtonBuilder()
    .setCustomId("end")
    .setLabel(">>")
    .setStyle(ButtonStyle.Primary);

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("query")
        .setDescription("Query users")
        .addStringOption(option => option.setName("ip")
            .setDescription("the ip address to search for"))
        .addIntegerOption(option => option.setName("deviceid")
            .setDescription("the device id to search for"))
        .addStringOption(option => option.setName("csnum")
            .setDescription("the serial number to search for"))
        .addIntegerOption(option => option.setName("userid")
            .setDescription("the user id to search for"))
        .addStringOption(option => option.setName("discordid")
            .setDescription("the discord id to search for"))
        .addBooleanOption(option => option.setName("banned")
            .setDescription("whether the user is banned, defaults to either if unset"))
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve"))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const ip = interaction.options.getString("ip");
        const deviceID = interaction.options.getInteger("deviceid") ?? 0;
        const csnum = interaction.options.getString("csnum");
        const userID = interaction.options.getInteger("userid") ?? 0;
        const discordID = interaction.options.getString("discordid");
        const banned = interaction.options.getBoolean("banned");
        let id = interaction.options.getString("id") ?? "";
        id = id.trim();

        let pid = 0;
        if (id != "") {
            const [valid, err] = validateID(id);
            if (!valid) {
                await interaction.reply({
                    content: `Error querying friend code or pid "${id}": ${err}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            pid = resolvePidFromString(id);
        }


        let hasban;
        if (banned == undefined || banned == null)
            hasban = 0;
        else if (!banned)
            hasban = 1;
        else if (banned)
            hasban = 2;

        const [success, res] = await makeRequest("/api/query", "POST", {
            secret: config.wfcSecret,
            ip: ip,
            deviceID: deviceID,
            csnum: csnum,
            userID: userID,
            discordID: discordID,
            hasban: hasban,
            pid: pid,
        });

        if (!success) {
            await interaction.reply({
                content: `Failed to query users! ${res.Error ?? "no error message provided"}`,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        if (!res.Users || res.Users.length == 0) {
            await interaction.reply({
                content: "No users matching the query were found!",
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const embeds: EmbedBuilder[] = [];
        for (let i = 0; i < res.Users.length; i++) {
            const user = res.Users[i];

            embeds.push(
                createUserEmbed(user, true)
                    .setFooter({
                        text: `User ${i + 1} of ${res.Users.length}`
                    })
            );
        }

        if (embeds.length > 1) {
            const row = new ActionRowBuilder()
                .addComponents(
                    start.setDisabled(true),
                    back.setDisabled(true),
                    forward.setDisabled(false),
                    end.setDisabled(false)
                );

            const res = await interaction.reply({
                embeds: [embeds[0]],
                flags: MessageFlags.Ephemeral,
                // I have to do this dumbass cast because apparently the docs
                // lie or the typings are incorrect...
                // https://discordjs.guide/message-components/buttons.html#sending-buttons
                components: [row as unknown as APIMessageTopLevelComponent],
            });

            // Wrong ID is associated with the interaction's reply for some
            // reason, but fetch gives the correct one!.
            const message = await res.fetch();

            registerButtonHandlerByMessageID(
                message.id,
                300000, // 5 minutes
                (messageID) => {
                    delete stateByMessageID[messageID];
                },
                handleButton,
            );

            stateByMessageID[message.id] = {
                Embeds: embeds,
                Idx: 0,
            };
        }
        else {
            await interaction.reply({
                embeds: embeds,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

async function handleButton(buttonInteraction: ButtonInteraction<CacheType>) {
    const state = stateByMessageID[buttonInteraction.message.id];

    let newidx = -1;
    const maxidx = state.Embeds.length - 1;

    switch (buttonInteraction.customId) {
    case "start":
        newidx = 0;
        break;
    case "forward":
        newidx = state.Idx + 1;
        break;
    case "end":
        newidx = maxidx;
        break;
    case "back":
        newidx = state.Idx - 1;
        break;
    }

    if (newidx > maxidx)
        newidx = maxidx;

    if (newidx < 0)
        newidx = 0;

    state.Idx = newidx;

    const row = new ActionRowBuilder()
        .addComponents(
            start.setDisabled(newidx == 0),
            back.setDisabled(newidx == 0),
            forward.setDisabled(newidx == maxidx),
            end.setDisabled(newidx == maxidx)
        );

    buttonInteraction.update({
        embeds: [state.Embeds[newidx]],
        components: [row as unknown as APIMessageTopLevelComponent],
    });
}
