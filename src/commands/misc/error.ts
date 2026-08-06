import { _fetch as fetch } from "#src/fetch.js";
import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { getWiiLinkErrorAddendum, getWiiLinkErrorDef, WiiLinkErrorAddendum } from "#src/commands/shared/error.js";
import { capitalize } from "#src/utils.js";

interface WiimmfiErrorInfo {
    type: string;
    name: string;
    info: string;
}

interface WiimmfiError {
    error: number;
    found: number;
    infolist: WiimmfiErrorInfo[];
}

type WiimmfiErrorResponse = WiimmfiError[];

const wiimmfiVerboseTypes: string[] = [
    "class",
    "section",
    "group",
];

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("error")
        .setDescription("Look up an RWFC numeric error")
        .addIntegerOption(option => option.setName("ecode")
            .setDescription("5-6 digit error code")
            .setRequired(true))
        .addBooleanOption(option => option.setName("verbose")
            .setDescription("show additionl error fields")),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const ecode = interaction.options.getInteger("ecode", true);
        const length = ecode.toString().length;
        const verbose = interaction.options.getBoolean("verbose") ?? false;

        if (length < 5 || length > 6) {
            await interaction.reply({
                content: "Error Codes must be between 5 and 6 digits.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply();

        const wiiLinkErrorDef = getWiiLinkErrorDef(ecode);

        const url = `https://wiimmfi.de/error?e=${ecode}&m=json`;
        const response = await fetch(url);

        const embed = new EmbedBuilder()
            .setTitle(`Retro WFC Error ${ecode}: ${wiiLinkErrorDef.name}\n`);

        const addendum = getWiiLinkErrorAddendum(ecode);
        const status = await addWiimmfiError(embed, response, verbose, addendum);

        let footer = "";

        switch (status) {
        case WiimmfiErrrorStatus.FAILED:
            footer = "Failed to retrieve error definitions from wiimmfi.de.";
            break;
        case WiimmfiErrrorStatus.MISSING:
        case WiimmfiErrrorStatus.UNUSED:
            footer = "No relevant error definitions found from wiimmfi.de.";
            break;
        case WiimmfiErrrorStatus.USED:
            footer = "Using error definitions from wiimmfi.de.";
            break;
        }

        embed.addFields({
            name: "WiiLink Description",
            value: wiiLinkErrorDef.description,
        });

        const comments = addendum.comments;

        if (comments && comments.length != 0) {
            for (let i = 0; i < comments.length; i++) {
                const comment = comments[i];
                embed.addFields({
                    name: `Comment ${i + 1}`,
                    value: comment,
                });
            }

            footer += "\nUsing comments from Retro WFC Developers and Moderators.";
        }

        embed.setFooter({ text: footer });

        await interaction.editReply({ embeds: [embed] });
    },
};

enum WiimmfiErrrorStatus {
    FAILED,
    MISSING,
    UNUSED,
    USED,
}

// Returns false if there is an issue with the wiimmfi error response
async function addWiimmfiError(
    embed: EmbedBuilder,
    response: Response,
    verbose: boolean,
    addendum: WiiLinkErrorAddendum,
): Promise<WiimmfiErrrorStatus> {
    if (!response.ok)
        return WiimmfiErrrorStatus.FAILED;

    const wiimmfiError = await response.json() as WiimmfiErrorResponse;
    const overrideKeys = Object.keys(addendum.overrides);

    if (wiimmfiError[0].found == 0 && overrideKeys.length == 0)
        return WiimmfiErrrorStatus.MISSING;

    const originalInfoList = Object.values(wiimmfiError[0].infolist);

    const filtered = originalInfoList.filter(info =>
        !wiimmfiVerboseTypes.includes(info.type.toLowerCase()));

    const infolist = !verbose ? filtered : originalInfoList;

    for (const info of infolist) {
        const override = addendum.overrides[info.type.toLowerCase()];

        if (override == "skip")
            continue;

        embed.addFields({
            name: `${info.name}: ${info.type}`,
            value: override ?? formatHREF(info.info),
        });
    }

    for (const type of overrideKeys) {
        if (originalInfoList.find(info => info.type.toLowerCase() == type))
            continue;

        embed.addFields({
            name: `xxxxx: ${capitalize(type)}`,
            value: addendum.overrides[type]!,
        });
    }

    // Wait to return until here so extra overrides can apply
    if (infolist.length == 0)
        return WiimmfiErrrorStatus.UNUSED;

    return WiimmfiErrrorStatus.USED;
}

const hrefRegex = /<a\shref="(?<link>.*?)">(?<display>.*?)<\/a>/;

interface HREFMatch {
    link: string | undefined;
    display: string | undefined;
}

// Replace all href links in wiimmfi info fields with Discord link embeds
function formatHREF(str: string): string {
    let match;

    while ((match = hrefRegex.exec(str)) != null) {
        const href = match.groups as unknown as HREFMatch;
        str = str.slice(0, match.index)
            + `[${href.display}](${href.link})`
            + str.slice(match.index + match[0].length);
    }

    return str;
}
