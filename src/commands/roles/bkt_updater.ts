import { Command } from "#src/commands/shared/command.js";
import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export const command: Command = makeRoleCommand(
    "bkt_updater",
    "BKT Updater",
    PermissionBit.BKT_UPDATER,
    PermissionBit.ADMIN,
);
