import { Command } from "#src/commands/shared/command.js";
import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export const command: Command = makeRoleCommand(
    "mod",
    "Moderator",
    PermissionBit.MODERATOR,
    PermissionBit.ADMIN,
);
