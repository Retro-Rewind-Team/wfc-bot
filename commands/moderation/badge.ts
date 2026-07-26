import { ActionRowBuilder, APIMessageTopLevelComponent, ButtonInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../../utils.js";
import { BadgeType } from "../shared/badges.js";
import { getConfig } from "../../config.js";
import { Dictionary } from "../../dictionary.js";
import { PermissionBit } from "../shared/roles.js";
import { Buttons } from "../shared/buttons.js";
import { registerButtonHandlerByMessageID } from "../../index.js";
import { fetchStatsEmbed, StatsSectionFlag } from "../shared/stats_embed.js";

const config = getConfig();
const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;

const BadgeOpts: { name: string, value: BadgeType }[] = [];

Object.entries(BadgeType).forEach(entry => {
    if (typeof entry[0] == "string" && typeof entry[1] == "number") {
        BadgeOpts.push({
            name: entry[0],
            value: entry[1],
        });
    }
});

interface BadgeManageResponse {
    success: boolean;
    message: string;
    badges: BadgeType[];
};

interface BadgeResponse {
    badges: BadgeType[];
}

interface BatchBadgeResponse {
    badges: Dictionary<BadgeType[]>
}

async function add(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    let id = interaction.options.getString("id", true);
    id = id.trim();

    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({ content: `Error adding badge to friend code or pid "${id}": ${err}` });
        return;
    }

    const pid = resolvePidFromString(id);
    const fc = pidToFc(pid);
    const badge: BadgeType = interaction.options.getInteger("badge", true);
    const badgeName = BadgeType[badge];

    const response = await fetch(`${leaderboardUrl}/api/moderation/badges/add`, {
        method: "POST",
        body: JSON.stringify({
            pid: pid.toString(),
            badge: badge,
        }),
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.wfcSecret}`
        }
    });

    if (!response.ok) {
        await interaction.reply({
            content: `Failed to add badge ${badgeName} to friend code "${fc}": error ${response.status}`
        });
        return;
    }
    else {
        const badgeResponse: BadgeManageResponse = await response.json();

        if (!badgeResponse.success) {
            await interaction.reply({
                content: `Failed to add badge ${badgeName} to friend code "${fc}": error ${badgeResponse.message}`
            });
            return;
        }

        await interaction.reply({
            content: `Successfully added badge ${badgeName} to friend code "${fc}"\nThis player's badges are: ${badgeResponse.badges.map(badge => BadgeType[badge]).join(", ")}`
        });
    }
}

async function remove(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    let id = interaction.options.getString("id", true);
    id = id.trim();

    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({ content: `Error removing badge from friend code or pid "${id}": ${err}` });
        return;
    }

    const pid = resolvePidFromString(id);
    const fc = pidToFc(pid);
    const badge: BadgeType = interaction.options.getInteger("badge", true);
    const badgeName = BadgeType[badge];

    const response = await fetch(`${leaderboardUrl}/api/moderation/badges/remove`, {
        method: "POST",
        body: JSON.stringify({
            pid: pid.toString(),
            badge: badge,
        }),
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.wfcSecret}`
        }
    });

    if (!response.ok) {
        await interaction.reply({
            content: `Failed to remove badge ${badgeName} from friend code "${fc}": error ${response.status}`
        });
        return;
    }
    else {
        const badgeResponse: BadgeManageResponse = await response.json();

        if (!badgeResponse.success) {
            await interaction.reply({
                content: `Failed to remove badge ${badgeName} from friend code "${fc}": error ${badgeResponse.message}`
            });
            return;
        }

        let badgeString: string;
        if (!badgeResponse.badges || badgeResponse.badges.length == 0)
            badgeString = "None";
        else {
            badgeString = badgeResponse.badges
                .map(badge => BadgeType[badge])
                .join(", ");
        }

        await interaction.reply({
            content: `Successfully removed badge ${badgeName} from friend code "${fc}"\nThis player's badges are: ${badgeString}`
        });
    }
}

async function list(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const id = interaction.options.getString("id");

    // Get all players' badges
    if (id == null || id.length == 0)
        await list_all(interaction);
    else
        await listSingle(interaction, id);
}

interface BadgeListState {
    Badges: Dictionary<BadgeType[]>,
    Idx: number;
    Embeds: EmbedBuilder[],
}

const stateByMessageID: Dictionary<BadgeListState> = {};

async function list_all(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    // await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const response = await fetch(`${leaderboardUrl}/api/badges/all`);

    if (!response.ok) {
        await interaction.reply({
            content: `Failed to fetch all badges: error ${response.status}`
        });
        return;
    }

    const batchResponse: BatchBadgeResponse = await response.json();
    const keys = Object.keys(batchResponse.badges);

    if (keys.length == 0)
        await interaction.reply({content: "No badges exist for any players"});

    const row = new ActionRowBuilder()
        .addComponents(
            Buttons.start.setDisabled(true),
            Buttons.back.setDisabled(true),
            Buttons.forward.setDisabled(false),
            Buttons.end.setDisabled(false)
        );

    const [embed, err] = await fetchStatsEmbed(keys[0], StatsSectionFlag.BADGES);
    if (err) {
        const fc = pidToFc(parseInt(keys[0]));
        await interaction.reply({
            content: `Failed to fetch embed for player ${fc}: ${err}`
        });

        return;
    }

    const res = await interaction.reply({
        embeds: [embed!],
        components: [row as unknown as APIMessageTopLevelComponent],
    });

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
        Badges: batchResponse.badges,
        Idx: 0,
        Embeds: [embed!],
    };
}

async function handleButton(buttonInteraction: ButtonInteraction<CacheType>): Promise<void> {
    const state = stateByMessageID[buttonInteraction.message.id];
    const keys = Object.keys(state.Badges);

    let newidx = -1;
    const maxidx = keys.length - 1;

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
            Buttons.start.setDisabled(newidx == 0),
            Buttons.back.setDisabled(newidx == 0),
            Buttons.forward.setDisabled(newidx == maxidx),
            Buttons.end.setDisabled(newidx == maxidx)
        );

    let embed = state.Embeds[state.Idx];

    if (!embed) {
        const [newEmbed, err] = await fetchStatsEmbed(keys[state.Idx], StatsSectionFlag.BADGES);

        if (err) {
            const fc = pidToFc(parseInt(keys[state.Idx]));
            await buttonInteraction.update({
                content: `Failed to fetch embed for player ${fc}: ${err}`,
                components: [row as unknown as APIMessageTopLevelComponent]
            });
            return;
        }

        embed = newEmbed!;
        state.Embeds[state.Idx] = embed;
    }

    await buttonInteraction.update({
        embeds: [embed],
        components: [row as unknown as APIMessageTopLevelComponent],
    });
}

async function listSingle(interaction: ChatInputCommandInteraction<CacheType>, id: string): Promise<void> {
    // Get only a single player's badge
    id = id.trim();
    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({ content: `Error retrieving badges for friend code or pid "${id}": ${err}` });
        return;
    }

    const pid = resolvePidFromString(id);
    const fc = pidToFc(pid);

    const response = await fetch(`${leaderboardUrl}/api/badges/by_pid/${pid}`);

    if (!response.ok) {
        await interaction.reply({
            content: `Failed to fetch badges for friend code ${fc}: error ${response.status}`
        });
        return;
    }

    const badges: BadgeType[] = (await response.json() as BadgeResponse).badges;
    let badgesString: string;
    if (badges.length == 0)
        badgesString = "None";
    else
        badgesString = badges.map(badge => BadgeType[badge]).join(", ");

    await interaction.reply({
        content: `${fc}: ${badgesString}`
    });
}

export default {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("badge")
        .setDescription("Manage player badges")
        .addSubcommand(subcommand => subcommand.setName("add")
            .setDescription("Add a badge to a user")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid to add a badge to")
                .setRequired(true))
            .addIntegerOption(option => option.setName("badge")
                .setDescription("the badge to add")
                .setChoices(BadgeOpts)
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove a badge from a user")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid remove a badge from")
                .setRequired(true))
            .addIntegerOption(option => option.setName("badge")
                .setDescription("the badge to remove")
                .setChoices(BadgeOpts)
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List badges for one or all players")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid to list badges of")))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
        case "add":
            await add(interaction);
            break;
        case "remove":
            await remove(interaction);
            break;
        case "list":
            await list(interaction);
            break;
        }
    }
};
