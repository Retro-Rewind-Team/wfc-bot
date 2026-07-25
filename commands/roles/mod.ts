import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export default makeRoleCommand(
    "mod",
    "Moderator",
    PermissionBit.MODERATOR,
    PermissionBit.ADMIN,
);
