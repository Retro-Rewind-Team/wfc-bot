# WFC Bot

Simple discord bot with WiiLink WFC integration. See config.example.json, and put your real config in `config.json`.

### Running
1. `npm i`
2. `npm run build`
3. `npm run start`

### Command Line Arguments
Command line arguments can be provided after a `--` in `npm run start`, such as `npm run start -- --refresh-commands`

Available Arguments:  
`--refresh-commands`: Refreshes the slash commands registered on discord  
`--config [config file]`: Provide the config file used and saved to  


### Config options
An example config will be automatically generated if none is provided. See `config.ts`.
