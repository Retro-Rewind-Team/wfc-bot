# WFC Bot

Simple discord bot with WiiLink WFC integration. See config.example.json, and put your real config in `config.json`.

### Running
1. `npm i`
2. `npm run build`
3. `npm run start`

### Config options
There are various methods of gating commands to certain users
* Gate access to specific channels and guilds: Place guild and channel ids `allowed-servers` or `allowed-channels`. Make either an empty array and it will remove the associated restrictions.
* Gate access to moderation actions: Moderation actions such as `ban`, `kick`, and `unban` are only visible to the role ID set in `moderation-role`.
