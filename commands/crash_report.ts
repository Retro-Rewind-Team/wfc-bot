import { AutocompleteInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, Locale, MessageFlags, SlashCommandBuilder } from "discord.js";
import { processCrashdump } from "./crashdump_shared.js";
import { getChannels } from "../config.js";
import { exit } from "process";
import { getColor } from "../utils.js";
import { Dictionary } from "../dictionary.js";

const sheetsUrl = "https://docs.google.com/spreadsheets/d/1kas1J6RcIePcaRRxtTluPZm8C8kydpaoQBtRg15M-zM/export?format=tsv&gid=1003203252#gid=1003203252";

const prefixRegex: RegExp = new RegExp(/\\c{[a-z0-9]*}([a-zA-Z0-9 ]*)\\c{off}/);
const channels = getChannels();

const Options = {
    File: "file",
    Mode: "mode",
    CC: "cc",
    Character: "character",
    Vehicle: "vehicle",
    Track: "track",
    MyStuff: "mystuff",
    Context: "context",
};

enum WeightClass {
    LightWeight,
    MediumWeight,
    HeavyWeight,
    Any,
};

const Characters: Dictionary<WeightClass> = {
    ["Baby Mario"]: WeightClass.LightWeight,
    ["Baby Luigi"]: WeightClass.LightWeight,
    ["Baby Peach"]: WeightClass.LightWeight,
    ["Baby Daisy"]: WeightClass.LightWeight,
    ["Toad"]: WeightClass.LightWeight,
    ["Toadette"]: WeightClass.LightWeight,
    ["Koopa Troopa"]: WeightClass.LightWeight,
    ["Dry Bones"]: WeightClass.LightWeight,
    ["Mario"]: WeightClass.MediumWeight,
    ["Luigi"]: WeightClass.MediumWeight,
    ["Peach"]: WeightClass.MediumWeight,
    ["Daisy"]: WeightClass.MediumWeight,
    ["Yoshi"]: WeightClass.MediumWeight,
    ["Birdo"]: WeightClass.MediumWeight,
    ["Diddy Kong"]: WeightClass.MediumWeight,
    ["Bowser Junior"]: WeightClass.MediumWeight,
    ["Wario"]: WeightClass.HeavyWeight,
    ["Waluigi"]: WeightClass.HeavyWeight,
    ["Donkey Kong"]: WeightClass.HeavyWeight,
    ["Bowser"]: WeightClass.HeavyWeight,
    ["King Boo"]: WeightClass.HeavyWeight,
    ["Rosalina"]: WeightClass.HeavyWeight,
    ["Funky Kong"]: WeightClass.HeavyWeight,
    ["Dry Bowser"]: WeightClass.HeavyWeight,
    ["Mii Outfit A"]: WeightClass.Any,
    ["Mii Outfit B"]: WeightClass.Any,
    ["None"]: WeightClass.Any,
};

const Vehicles: Dictionary<WeightClass> = {
    ["Standard Kart S"]: WeightClass.LightWeight,
    ["Booster Seat"]: WeightClass.LightWeight,
    ["Mini Beast"]: WeightClass.LightWeight,
    ["Cheep Charger"]: WeightClass.LightWeight,
    ["Tiny Titan"]: WeightClass.LightWeight,
    ["Blue Falcon"]: WeightClass.LightWeight,
    ["Standard Bike S"]: WeightClass.LightWeight,
    ["Bullet Bike"]: WeightClass.LightWeight,
    ["Bit Bike"]: WeightClass.LightWeight,
    ["Quacker"]: WeightClass.LightWeight,
    ["Magikruiser"]: WeightClass.LightWeight,
    ["Jet Bubble"]: WeightClass.LightWeight,
    ["Standard Kart M"]: WeightClass.MediumWeight,
    ["Classic Dragster"]: WeightClass.MediumWeight,
    ["Wild Wing"]: WeightClass.MediumWeight,
    ["Super Blooper"]: WeightClass.MediumWeight,
    ["Daytripper"]: WeightClass.MediumWeight,
    ["Sprinter"]: WeightClass.MediumWeight,
    ["Standard Bike M"]: WeightClass.MediumWeight,
    ["Mach Bike"]: WeightClass.MediumWeight,
    ["Sugarscoot"]: WeightClass.MediumWeight,
    ["Zip Zip"]: WeightClass.MediumWeight,
    ["Sneakster"]: WeightClass.MediumWeight,
    ["Dolphin Dasher"]: WeightClass.MediumWeight,
    ["Standard Kart L"]: WeightClass.HeavyWeight,
    ["Offroader"]: WeightClass.HeavyWeight,
    ["Flame Flyer"]: WeightClass.HeavyWeight,
    ["Piranha Prowler"]: WeightClass.HeavyWeight,
    ["Jetsetter"]: WeightClass.HeavyWeight,
    ["Honeycoupe"]: WeightClass.HeavyWeight,
    ["Standard Bike L"]: WeightClass.HeavyWeight,
    ["Flame Runner"]: WeightClass.HeavyWeight,
    ["Wario Bike"]: WeightClass.HeavyWeight,
    ["Shooting Star"]: WeightClass.HeavyWeight,
    ["Spear"]: WeightClass.HeavyWeight,
    ["Phantom"]: WeightClass.HeavyWeight,
    ["None"]: WeightClass.Any,
};

interface LocaleInfo {
    PercComplete: string | null,
    DiscordLocale: string,
    NodeJSLocale: Intl.Locale,
    Tracks: string[]
}

const DiscordLocaleToSheetLang: Dictionary<string> = {
    [`${Locale.EnglishUS}`]: "Common/English",
    [`${Locale.Japanese}`]: "Japanese",
    [`${Locale.French}`]: "French",
    [`${Locale.German}`]: "German",
    [`${Locale.Dutch}`]: "Dutch",
    [`${Locale.SpanishLATAM}`]: "Spanish(NTSC)",
    [`${Locale.SpanishES}`]: "Spanish (EU)",
    [`${Locale.Finnish}`]: "Finnish",
    [`${Locale.Italian}`]: "Italian",
    [`${Locale.Korean}`]: "Korean",
    [`${Locale.Russian}`]: "Russian",
    [`${Locale.Turkish}`]: "Turkish",
    [`${Locale.Czech}`]: "Czech",
    [`${Locale.PortugueseBR}`]: "Portuguese",
    [`${Locale.ChineseCN}`]: "Chinese (Simplified)",
};

const SheetLangToLocaleInfo: Dictionary<LocaleInfo> = {
    ["Common/English"]: {
        PercComplete: null,
        DiscordLocale: Locale.EnglishUS,
        NodeJSLocale: new Intl.Locale("en-US"),
        Tracks: [],
    },
    ["Japanese"]: {
        PercComplete: null,
        DiscordLocale: Locale.Japanese,
        NodeJSLocale: new Intl.Locale("ja-JP"),
        Tracks: [],
    },
    ["French"]: {
        PercComplete: null,
        DiscordLocale: Locale.French,
        NodeJSLocale: new Intl.Locale("fr-FR"),
        Tracks: [],
    },
    ["German"]: {
        PercComplete: null,
        DiscordLocale: Locale.German,
        NodeJSLocale: new Intl.Locale("de-DE"),
        Tracks: [],
    },
    ["Dutch"]: {
        PercComplete: null,
        DiscordLocale: Locale.Dutch,
        NodeJSLocale: new Intl.Locale("nl-NL"),
        Tracks: [],
    },
    ["Spanish (NTSC)"]: {
        PercComplete: null,
        DiscordLocale: Locale.SpanishLATAM,
        NodeJSLocale: new Intl.Locale("es-419"),
        Tracks: [],
    },
    ["Spanish (EU)"]: {
        PercComplete: null,
        DiscordLocale: Locale.SpanishES,
        NodeJSLocale: new Intl.Locale("es-ES"),
        Tracks: [],
    },
    ["Finnish"]: {
        PercComplete: null,
        DiscordLocale: Locale.Finnish,
        NodeJSLocale: new Intl.Locale("fi-FI"),
        Tracks: [],
    },
    ["Italian"]: {
        PercComplete: null,
        DiscordLocale: Locale.Italian,
        NodeJSLocale: new Intl.Locale("it-IT"),
        Tracks: [],
    },
    ["Korean"]: {
        PercComplete: null,
        DiscordLocale: Locale.Korean,
        NodeJSLocale: new Intl.Locale("ko-KR"),
        Tracks: [],
    },
    ["Russian"]: {
        PercComplete: null,
        DiscordLocale: Locale.Russian,
        NodeJSLocale: new Intl.Locale("ru-RU"),
        Tracks: [],
    },
    ["Turkish"]: {
        PercComplete: null,
        DiscordLocale: Locale.Turkish,
        NodeJSLocale: new Intl.Locale("tr-TR"),
        Tracks: [],
    },
    ["Czech"]: {
        PercComplete: null,
        DiscordLocale: Locale.Czech,
        NodeJSLocale: new Intl.Locale("cs-CZ"),
        Tracks: [],
    },
    ["Portuguese"]: {
        PercComplete: null,
        // We actually have euro portuguese but this is the only one supported by the discord api
        DiscordLocale: Locale.PortugueseBR,
        NodeJSLocale: new Intl.Locale("pt-PT"),
        Tracks: [],
    },
    ["Chinese (Simplified)"]: {
        PercComplete: null,
        DiscordLocale: Locale.ChineseCN,
        NodeJSLocale: new Intl.Locale("zh-CN"),
        Tracks: [],
    },
};

function a(b: string) {
    return { name: b, value: b };
}

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("crash_report")
        .setDescription("Submit a crashdump to the developers")
        .addAttachmentOption(option => option.setName(Options.File)
            .setDescription("The crash.pul file")
            .setRequired(true))
        .addStringOption(option => option.setName(Options.Mode)
            .setDescription("The mode you were playing in. Select None if you were not in a mode.")
            .setChoices(
                a("Regular Worldwide"),
                a("Retro Versus Worldwide"),
                a("Custom Versus Worldwide"),
                a("Retro 200cc Worldwide"),
                a("Custom 200cc Worldwide"),
                a("Retro Online Timetrials"),
                a("Custom Online Timetrials"),
                a("Froom KO Mode"),
                a("Froom Timetrials Mode"),
                a("Froom Extended Teams Mode"),
                a("None"))
            .setRequired(true))
        .addStringOption(option => option.setName(Options.CC)
            .setDescription("The CC you were playing in. Select None if you had no set CC. Important for frooms.")
            .setChoices(
                a("100CC"),
                a("150CC"),
                a("200CC"),
                a("500CC"),
                a("None"))
            .setRequired(true))
        .addStringOption(option => option.setName(Options.Character)
            .setDescription("The character you were playing with. Select None if you did not select a character.")
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption(option => option.setName(Options.Vehicle)
            .setDescription("The vehicle you were playing with. Select None if you did not select a vehicle.")
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption(option => option.setName(Options.Track)
            .setDescription("The track you were playing on. Select None if you were not in a race.")
            .setAutocomplete(true)
            .setRequired(true))
        .addBooleanOption(option => option.setName(Options.MyStuff)
            .setDescription("Do you have mystuff enabled?")
            .setRequired(true))
        .addStringOption(option => option.setName(Options.Context)
            .setDescription("An explanation of the crash. Please include the events leading up to the crash.")
            .setRequired(true)),

    init: async function() {
        console.log("Fetching course listing...");

        const res = await fetch(sheetsUrl);

        if (!res.ok) {
            console.error(`Failed to fetch course listing. ${res.status}, ${res.statusText}`);
            exit(1);
        }

        const text = await res.text();
        const lines = text.split("\n");


        const langs = lines[1].split("\t");
        const percs = lines[0].split("\t");
        // The Common/English column has the total count rather than the percentage
        percs[2] = "100.0%";

        for (let i = 2; i < langs.length; i++) {
            const lang = langs[i];

            if (lang == "")
                continue;

            if (!SheetLangToLocaleInfo[lang]) {
                console.log(`Skipping column with language ${lang}!`);
                continue;
            }

            const perc = percs[i];
            console.log(`Perc for language ${lang} is ${perc}`);

            SheetLangToLocaleInfo[lang].PercComplete = perc;
        }

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split("\t");

            for (let j = 2; j < cols.length; j++) {
                const lang = langs[j];
                if (lang == "" || !SheetLangToLocaleInfo[lang])
                    continue;

                let consolePrefix;
                if (lang == "Japanese")
                    consolePrefix = cols[1];
                else
                    consolePrefix = cols[0];

                let track: string;
                if (!consolePrefix || consolePrefix.length == 0)
                    track = cols[j];
                else {
                    const matches = consolePrefix.match(prefixRegex);

                    if (!matches || matches.length < 2)
                        track = cols[j];
                    else
                        track = `${matches[1]} ${cols[j]}`;
                }

                SheetLangToLocaleInfo[lang].Tracks.push(track);
            }
        }

        console.log(`Fetched track listing: ${SheetLangToLocaleInfo["Common/English"].Tracks.length} tracks!`);
    },

    autocomplete: async function(interaction: AutocompleteInteraction<CacheType>) {
        const focused = interaction.options.getFocused(true);
        let choices: string[] = [];

        switch (focused.name) {
        case Options.Character: {
            const vehicle = interaction.options.getString(Options.Vehicle);

            if (!vehicle || !Object.keys(Vehicles).includes(vehicle) || Vehicles[vehicle] == WeightClass.Any)
                choices = Object.keys(Characters);
            else
                choices = Object.keys(Characters).filter(character => Characters[character] == Vehicles[vehicle]);

            break;
        }
        case Options.Vehicle: {
            const character = interaction.options.getString(Options.Character);

            if (!character || !Object.keys(Characters).includes(character) || Characters[character] == WeightClass.Any)
                choices = Object.keys(Vehicles);
            else
                choices = Object.keys(Vehicles).filter(vehicle => Vehicles[vehicle] == Characters[character]);

            break;
        }
        case Options.Track: {
            // Only match locales with full completion, because having a mix of
            // english and nonenglish tracks would be hard to use...
            const match = Object.values(SheetLangToLocaleInfo)
                .filter(linfo => linfo.PercComplete == "100.0%" && linfo.DiscordLocale == interaction.locale);

            if (match.length != 0)
                choices = match[0].Tracks;
            else
                choices = SheetLangToLocaleInfo["Common/English"].Tracks;

            const sheetLang = DiscordLocaleToSheetLang[interaction.locale]
                ?? DiscordLocaleToSheetLang[Locale.EnglishUS];
            const nodeLocale = SheetLangToLocaleInfo[sheetLang].NodeJSLocale
                ?? SheetLangToLocaleInfo["Common/English"].NodeJSLocale;

            const englishLocale = SheetLangToLocaleInfo["Common/English"];

            // Needs to be mapped into this format first since the idx won't be
            // preserved after filtering... annoying
            const mapped = choices.map((choice, idx) => ({
                name: choice,
                value: englishLocale.Tracks[idx]
            }));

            let filtered;

            if (focused.value.length > 0) {
                filtered = mapped.filter(choice =>
                    choice.name.toLocaleLowerCase(nodeLocale)
                        .includes(focused.value.toLocaleLowerCase(nodeLocale)));
            }
            else
                filtered = mapped;

            await interaction.respond(filtered.slice(0, Math.min(filtered.length, 25)));
            return;
        }
        }

        // No locale support for other options.
        let filtered;

        if (focused.value.length > 0)
            filtered = choices.filter(choice =>
                choice.toLowerCase().includes(focused.value.toLowerCase()));
        else
            filtered = choices;

        const mapped = filtered
            .slice(0, Math.min(filtered.length, 25))
            .map(choice =>
                ({ name: choice, value: choice }));

        await interaction.respond(mapped);
    },

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const binaryAttachment = interaction.options.getAttachment(Options.File, true);
        const binaryResponse = await fetch(binaryAttachment.url);

        if (!binaryResponse.ok) {
            await interaction.reply({
                content: `Error fetching payload attachment: ${binaryResponse.status}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const buffer = Buffer.from(await binaryResponse.arrayBuffer());

        const [code, out, err] = await processCrashdump(buffer);

        if (code != 0) {
            await interaction.reply({
                content: `\`\`\`${err}\`\`\``,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        async function validate(fieldName: string, option: string, set: string[]): Promise<boolean> {
            if (set.includes(option))
                return true;

            await interaction.reply({
                content: `Invalid option provided for ${fieldName}: ${option}. Please only enter values present in the autocomplete!`,
                flags: MessageFlags.Ephemeral,
            });
            return false;
        }

        const member = interaction.member as GuildMember | null;
        const mode = interaction.options.getString(Options.Mode, true);
        const cc = interaction.options.getString(Options.CC, true);
        const character = interaction.options.getString(Options.Character, true);
        const vehicle = interaction.options.getString(Options.Vehicle, true);
        const track = interaction.options.getString(Options.Track, true);
        const context = interaction.options.getString(Options.Context, true);
        const mystuff = interaction.options.getBoolean(Options.MyStuff, true);

        if (!await validate(Options.Character, character, Object.keys(Characters))
            || !await validate(Options.Vehicle, vehicle, Object.keys(Vehicles))
            || !await validate(Options.Track, track, Object.values(SheetLangToLocaleInfo["Common/English"].Tracks)))
            return;

        const response = await interaction.reply({
            content: "Thanks for submitting your crashdump!"
        });

        const embed = new EmbedBuilder()
            .setColor(getColor())
            .setTitle(`Crash Report from ${member?.displayName ?? "Unknown"}`)
            .addFields(
                { name: "Server", value: interaction.guild!.name },
                { name: "Reporter", value: `<@${member?.id ?? "Unknown"}>` },
                { name: "Report Location", value: `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${response.id}` },
                { name: "Mode", value: mode },
                { name: "CC", value: cc },
                { name: "Character", value: character },
                { name: "Vehicle", value: vehicle },
                { name: "Track", value: track },
                { name: "Context", value: context },
                { name: "MyStuff", value: mystuff ? "Enabled" : "Disabled" },
            );

        const message = await channels.crashReport.send({
            content: out,
            embeds: [embed],
        });

        // Since both messages can't be sent simultaneously, this one is edited
        // with the location of the full report.
        console.log(`Crashdump submitted to ${message?.url}`);
        await interaction.editReply({
            content: `Thanks for submitting your crashdump! Your response and the full stacktrace is available here: ${message?.url}`,
        });
    }
};
