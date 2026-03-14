// M2TWEOP Complete Lua API Reference
// Sourced from: https://eop-labs.github.io/M2TWEOP-library/_static/LuaLib/index.html

export const EOP_EVENTS = [
  { name: 'onPluginLoad', description: 'Called once when the EOP plugin loads. Use for setup like setting limits.', params: [], example: `function onPluginLoad()\n  M2TWEOP.unlockGameConsoleCommands()\n  M2TWEOP.setAncillariesLimit(16)\n  M2TWEOP.setMaxBgSize(100)\n  M2TWEOP.setReligionsLimit(50)\n  M2TWEOP.setBuildingChainLimit(40)\nend` },
  { name: 'onTurnStart', description: 'Fired at the start of each faction turn.', params: [{ name: 'eventData', type: 'table', desc: 'Contains faction and turn info' }], example: `function onTurnStart(eventData)\n  local faction = eventData.faction\n  -- your code here\nend` },
  { name: 'onTurnEnd', description: 'Fired at the end of each faction turn.', params: [{ name: 'eventData', type: 'table', desc: 'Contains faction and turn info' }], example: `function onTurnEnd(eventData)\nend` },
  { name: 'onBattleStarted', description: 'Fired when a battle begins.', params: [{ name: 'eventData', type: 'table', desc: 'Battle data' }], example: `function onBattleStarted(eventData)\nend` },
  { name: 'onBattleEnded', description: 'Fired when a battle ends.', params: [{ name: 'eventData', type: 'table', desc: 'Battle result data' }], example: `function onBattleEnded(eventData)\nend` },
  { name: 'onGeneralAssaultsGeneral', description: 'Fired when a general attacks another general in battle.', params: [{ name: 'attacker', type: 'characterStruct', desc: 'The attacking general' }, { name: 'defender', type: 'characterStruct', desc: 'The defending general' }], example: `function onGeneralAssaultsGeneral(attacker, defender)\n  if hasTrait(attacker, "Brave") then\n    -- attacker is brave\n  end\nend` },
  { name: 'onCharacterTurnStart', description: 'Fired at the start of a character\'s turn.', params: [{ name: 'eventData', type: 'table', desc: 'Character event data' }], example: `function onCharacterTurnStart(eventData)\n  local char = eventData.character\nend` },
  { name: 'onCharacterTurnEnd', description: 'Fired at the end of a character\'s turn.', params: [{ name: 'eventData', type: 'table', desc: 'Character event data' }], example: `function onCharacterTurnEnd(eventData)\nend` },
  { name: 'onSettlementTurnStart', description: 'Fired at the start of turn processing for a settlement.', params: [{ name: 'eventData', type: 'table', desc: 'Settlement event data' }], example: `function onSettlementTurnStart(eventData)\n  local settlement = eventData.settlement\nend` },
  { name: 'onSettlementTurnEnd', description: 'Fired at the end of turn processing for a settlement.', params: [{ name: 'eventData', type: 'table', desc: 'Settlement event data' }], example: `function onSettlementTurnEnd(eventData)\nend` },
  { name: 'onCharacterSacked', description: 'Fired when a character is sacked/dismissed.', params: [{ name: 'eventData', type: 'table', desc: 'Sacked character data' }], example: `function onCharacterSacked(eventData)\nend` },
  { name: 'onCharacterCreated', description: 'Fired when a new character is created.', params: [{ name: 'eventData', type: 'table', desc: 'New character data' }], example: `function onCharacterCreated(eventData)\nend` },
  { name: 'onCharacterKilled', description: 'Fired when a character dies.', params: [{ name: 'eventData', type: 'table', desc: 'Killed character data' }], example: `function onCharacterKilled(eventData)\nend` },
  { name: 'onBuildingCreated', description: 'Fired when a building finishes construction.', params: [{ name: 'eventData', type: 'table', desc: 'Building and settlement data' }], example: `function onBuildingCreated(eventData)\n  local settlement = eventData.settlement\n  local building = eventData.building\nend` },
  { name: 'onBuildingDestroyed', description: 'Fired when a building is destroyed.', params: [{ name: 'eventData', type: 'table', desc: 'Building and settlement data' }], example: `function onBuildingDestroyed(eventData)\nend` },
  { name: 'onSettlementCaptured', description: 'Fired when a settlement is captured.', params: [{ name: 'eventData', type: 'table', desc: 'Attacker, defender, settlement data' }], example: `function onSettlementCaptured(eventData)\n  local winner = eventData.winnerFaction\n  local loser = eventData.loserFaction\nend` },
  { name: 'onFactionDestroyed', description: 'Fired when a faction is completely eliminated.', params: [{ name: 'eventData', type: 'table', desc: 'Destroyed faction data' }], example: `function onFactionDestroyed(eventData)\nend` },
  { name: 'onUiClick', description: 'Fired on a UI element click (if registered).', params: [{ name: 'eventData', type: 'table', desc: 'UI event data' }], example: `function onUiClick(eventData)\nend` },
  { name: 'onImGuiRender', description: 'Called every frame — use to render ImGUI windows/widgets.', params: [], example: `function onImGuiRender()\n  imgui.Begin("My Window")\n  imgui.Text("Hello from EOP!")\n  imgui.End()\nend` },
];

export const EOP_API = [
  // ─── M2TWEOP Core ────────────────────────────────────────────────────────────
  { ns: 'M2TWEOP', name: 'getModPath', sig: 'M2TWEOP.getModPath()', returns: 'string', desc: 'Returns the path to the current mod folder.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'getPluginPath', sig: 'M2TWEOP.getPluginPath()', returns: 'string', desc: 'Returns the path to the EOP plugin folder.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'getGameVersion', sig: 'M2TWEOP.getGameVersion()', returns: 'string', desc: 'Returns the current game version string.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'toggleConsole', sig: 'M2TWEOP.toggleConsole()', returns: 'void', desc: 'Toggles the in-game EOP console.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'toggleDeveloperMode', sig: 'M2TWEOP.toggleDeveloperMode()', returns: 'void', desc: 'Toggles developer/debug mode.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'reloadScript', sig: 'M2TWEOP.reloadScript()', returns: 'void', desc: 'Hot-reloads the Lua plugin script without restarting.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'restartLua', sig: 'M2TWEOP.restartLua()', returns: 'void', desc: 'Fully restarts the Lua environment.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'saveGame', sig: 'M2TWEOP.saveGame(path)', returns: 'void', desc: 'Saves the game to the specified path.', params: [{ name: 'path', type: 'string', desc: 'Save file path' }], category: 'Core' },
  { ns: 'M2TWEOP', name: 'loadGame', sig: 'M2TWEOP.loadGame(path)', returns: 'void', desc: 'Loads a save game from the specified path.', params: [{ name: 'path', type: 'string', desc: 'Save file path' }], category: 'Core' },
  { ns: 'M2TWEOP', name: 'logGame', sig: 'M2TWEOP.logGame(message)', returns: 'void', desc: 'Writes a message to the game log.', params: [{ name: 'message', type: 'string', desc: 'Message to log' }], category: 'Core' },
  { ns: 'M2TWEOP', name: 'setPerfectSpy', sig: 'M2TWEOP.setPerfectSpy(set)', returns: 'void', desc: 'Enables or disables perfect spy (full map visibility).', params: [{ name: 'set', type: 'boolean', desc: 'true = enable' }], category: 'Core' },
  { ns: 'M2TWEOP', name: 'getLocalFactionID', sig: 'M2TWEOP.getLocalFactionID()', returns: 'number', desc: 'Returns the local player\'s faction ID.', category: 'Core' },
  { ns: 'M2TWEOP', name: 'condition', sig: 'M2TWEOP.condition(condition, eventData)', returns: 'boolean', desc: 'Evaluates a vanilla M2TW condition string in Lua context.', params: [{ name: 'condition', type: 'string', desc: 'Vanilla condition string' }, { name: 'eventData', type: 'table', desc: 'Event context data' }], category: 'Core' },
  // ─── Engine Limits ───────────────────────────────────────────────────────────
  { ns: 'M2TWEOP', name: 'setAncillariesLimit', sig: 'M2TWEOP.setAncillariesLimit(newLimit)', returns: 'void', desc: 'Sets the maximum number of ancillaries a character can hold.', params: [{ name: 'newLimit', type: 'number', desc: 'New max ancillaries (default: 8)' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setMaxBgSize', sig: 'M2TWEOP.setMaxBgSize(newSize)', returns: 'void', desc: 'Sets the maximum bodyguard unit size.', params: [{ name: 'newSize', type: 'number', desc: 'New max BG size' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setEDUUnitsSize', sig: 'M2TWEOP.setEDUUnitsSize(minSize, maxSize)', returns: 'void', desc: 'Sets the min/max unit sizes for EDU units.', params: [{ name: 'minSize', type: 'number', desc: 'Minimum soldiers' }, { name: 'maxSize', type: 'number', desc: 'Maximum soldiers' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setBuildingChainLimit', sig: 'M2TWEOP.setBuildingChainLimit(limit)', returns: 'void', desc: 'Sets the maximum number of building chains.', params: [{ name: 'limit', type: 'number', desc: 'New building chain limit' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setReligionsLimit', sig: 'M2TWEOP.setReligionsLimit(newLimit)', returns: 'void', desc: 'Sets the maximum number of religions.', params: [{ name: 'newLimit', type: 'number', desc: 'New religion limit (max 50)' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setGuildCooldown', sig: 'M2TWEOP.setGuildCooldown(turns)', returns: 'void', desc: 'Sets guild cooldown in turns.', params: [{ name: 'turns', type: 'number', desc: 'Cooldown turns' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setConversionLvlFromCastle', sig: 'M2TWEOP.setConversionLvlFromCastle(castleLvl, convertToLvl)', returns: 'void', desc: 'Sets what castle level converts to which city level.', params: [{ name: 'castleLvl', type: 'number', desc: 'Castle level' }, { name: 'convertToLvl', type: 'number', desc: 'Target city level' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setConversionLvlFromCity', sig: 'M2TWEOP.setConversionLvlFromCity(cityLvl, convertToLvl)', returns: 'void', desc: 'Sets what city level converts to which castle level.', params: [{ name: 'cityLvl', type: 'number', desc: 'City level' }, { name: 'convertToLvl', type: 'number', desc: 'Target castle level' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'setEquipmentCosts', sig: 'M2TWEOP.setEquipmentCosts(equipmentType, newCost)', returns: 'void', desc: 'Changes the cost of a weapon/armour equipment type.', params: [{ name: 'equipmentType', type: 'string', desc: 'Equipment type name' }, { name: 'newCost', type: 'number', desc: 'New cost value' }], category: 'Limits' },
  { ns: 'M2TWEOP', name: 'unlockGameConsoleCommands', sig: 'M2TWEOP.unlockGameConsoleCommands()', returns: 'void', desc: 'Unlocks all vanilla console commands.', category: 'Limits' },
  // ─── Map / World ─────────────────────────────────────────────────────────────
  { ns: 'M2TWEOP', name: 'isTileFree', sig: 'M2TWEOP.isTileFree(X, Y)', returns: 'boolean', desc: 'Returns true if the map tile at (X,Y) is unoccupied.', params: [{ name: 'X', type: 'number', desc: 'Tile X' }, { name: 'Y', type: 'number', desc: 'Tile Y' }], category: 'Map' },
  { ns: 'M2TWEOP', name: 'getGameTileCoordsWithCursor', sig: 'M2TWEOP.getGameTileCoordsWithCursor()', returns: 'number, number', desc: 'Returns the tile X,Y under the mouse cursor.', category: 'Map' },
  { ns: 'M2TWEOP', name: 'getTileRegionID', sig: 'M2TWEOP.getTileRegionID(x, y)', returns: 'number', desc: 'Returns the region ID of the map tile at (x,y).', params: [{ name: 'x', type: 'number', desc: 'Tile X' }, { name: 'y', type: 'number', desc: 'Tile Y' }], category: 'Map' },
  { ns: 'M2TWEOP', name: 'getTileVisibility', sig: 'M2TWEOP.getTileVisibility(faction, xCoord, yCoord)', returns: 'boolean', desc: 'Returns whether the tile is visible to the faction.', params: [{ name: 'faction', type: 'factionStruct', desc: 'Faction to check' }, { name: 'xCoord', type: 'number', desc: 'X' }, { name: 'yCoord', type: 'number', desc: 'Y' }], category: 'Map' },
  { ns: 'M2TWEOP', name: 'getRegionOwner', sig: 'M2TWEOP.getRegionOwner(regionID)', returns: 'factionStruct', desc: 'Returns the faction that owns the given region.', params: [{ name: 'regionID', type: 'number', desc: 'Region ID' }], category: 'Map' },
  { ns: 'M2TWEOP', name: 'CalculateTileMovementCost', sig: 'M2TWEOP.CalculateTileMovementCost(originX, originY, targetX, targetY)', returns: 'number', desc: 'Calculates movement cost between two tiles.', params: [{ name: 'originX', type: 'number', desc: 'Origin X' }, { name: 'originY', type: 'number', desc: 'Origin Y' }, { name: 'targetX', type: 'number', desc: 'Target X' }, { name: 'targetY', type: 'number', desc: 'Target Y' }], category: 'Map' },
  // ─── Faction / Religion / Culture ────────────────────────────────────────────
  { ns: 'M2TWEOP', name: 'getReligionName', sig: 'M2TWEOP.getReligionName(index)', returns: 'string', desc: 'Returns the name of a religion by index.', params: [{ name: 'index', type: 'number', desc: 'Religion index' }], category: 'Faction' },
  { ns: 'M2TWEOP', name: 'getReligionCount', sig: 'M2TWEOP.getReligionCount()', returns: 'number', desc: 'Returns the total number of religions.', category: 'Faction' },
  { ns: 'M2TWEOP', name: 'getCultureName', sig: 'M2TWEOP.getCultureName(index)', returns: 'string', desc: 'Returns the name of a culture by index.', params: [{ name: 'index', type: 'number', desc: 'Culture index' }], category: 'Faction' },
  { ns: 'M2TWEOP', name: 'getClimateName', sig: 'M2TWEOP.getClimateName(index)', returns: 'string', desc: 'Returns the name of a climate by index.', params: [{ name: 'index', type: 'number', desc: 'Climate index' }], category: 'Faction' },
  { ns: 'M2TWEOP', name: 'getReligion', sig: 'M2TWEOP.getReligion(name)', returns: 'religionStruct', desc: 'Returns a religion struct by name.', params: [{ name: 'name', type: 'string', desc: 'Religion name' }], category: 'Faction' },
  { ns: 'M2TWEOP', name: 'getCultureID', sig: 'M2TWEOP.getCultureID(name)', returns: 'number', desc: 'Returns the ID of a culture by name.', params: [{ name: 'name', type: 'string', desc: 'Culture name' }], category: 'Faction' },
  { ns: 'M2TWEOP', name: 'getClimateID', sig: 'M2TWEOP.getClimateID(name)', returns: 'number', desc: 'Returns the ID of a climate by name.', params: [{ name: 'name', type: 'string', desc: 'Climate name' }], category: 'Faction' },
  // ─── Game State ──────────────────────────────────────────────────────────────
  { ns: 'M2TWEOP', name: 'getOptions1', sig: 'M2TWEOP.getOptions1()', returns: 'table', desc: 'Returns the first options bitfield table.', category: 'GameState' },
  { ns: 'M2TWEOP', name: 'getOptions2', sig: 'M2TWEOP.getOptions2()', returns: 'table', desc: 'Returns the second options bitfield table.', category: 'GameState' },
  { ns: 'M2TWEOP', name: 'getCampaignDifficulty1', sig: 'M2TWEOP.getCampaignDifficulty1()', returns: 'number', desc: 'Returns the campaign difficulty setting (AI).', category: 'GameState' },
  { ns: 'M2TWEOP', name: 'getCampaignDifficulty2', sig: 'M2TWEOP.getCampaignDifficulty2()', returns: 'number', desc: 'Returns the campaign difficulty setting (battle).', category: 'GameState' },
  { ns: 'M2TWEOP', name: 'getCampaignDb', sig: 'M2TWEOP.getCampaignDb()', returns: 'campaignDbStruct', desc: 'Returns the campaign database struct.', category: 'GameState' },
  { ns: 'M2TWEOP', name: 'getCampaignDbExtra', sig: 'M2TWEOP.getCampaignDbExtra()', returns: 'campaignDbExtraStruct', desc: 'Returns the extended campaign database struct.', category: 'GameState' },
  { ns: 'M2TWEOP', name: 'getSettlementInfoScroll', sig: 'M2TWEOP.getSettlementInfoScroll()', returns: 'settlementInfoStruct', desc: 'Returns the currently open settlement info scroll data.', category: 'GameState' },
  // ─── Texture ─────────────────────────────────────────────────────────────────
  { ns: 'M2TWEOP', name: 'loadTexture', sig: 'M2TWEOP.loadTexture(path)', returns: 'number', desc: 'Loads a texture and returns its ID.', params: [{ name: 'path', type: 'string', desc: 'Path to texture file' }], category: 'Texture' },
  { ns: 'M2TWEOP', name: 'unloadTexture', sig: 'M2TWEOP.unloadTexture(id)', returns: 'void', desc: 'Unloads a previously loaded texture by ID.', params: [{ name: 'id', type: 'number', desc: 'Texture ID' }], category: 'Texture' },
  { ns: 'M2TWEOP', name: 'toggleUnitsBMapHighlight', sig: 'M2TWEOP.toggleUnitsBMapHighlight()', returns: 'void', desc: 'Toggles the battle map unit highlight overlay.', category: 'Texture' },
  { ns: 'M2TWEOP', name: 'getBattleCamCoords', sig: 'M2TWEOP.getBattleCamCoords()', returns: 'number, number, number', desc: 'Returns the current battle camera X, Y, Z coordinates.', category: 'Texture' },
  // ─── stratmap.game ───────────────────────────────────────────────────────────
  { ns: 'stratmap.game', name: 'callConsole', sig: 'stratmap.game.callConsole(command, args)', returns: 'void', desc: 'Executes a console command with arguments.', params: [{ name: 'command', type: 'string', desc: 'Console command name' }, { name: 'args', type: 'string', desc: 'Command arguments' }], category: 'Stratmap' },
  { ns: 'stratmap.game', name: 'getFactionsCount', sig: 'stratmap.game.getFactionsCount()', returns: 'number', desc: 'Returns the total number of factions.', category: 'Stratmap' },
  { ns: 'stratmap.game', name: 'getFaction', sig: 'stratmap.game.getFaction(Index)', returns: 'factionStruct', desc: 'Returns a factionStruct by index.', params: [{ name: 'Index', type: 'number', desc: 'Faction index' }], category: 'Stratmap' },
  { ns: 'stratmap.game', name: 'getGuild', sig: 'stratmap.game.getGuild(index)', returns: 'guildStruct', desc: 'Returns a guild struct by index.', params: [{ name: 'index', type: 'number', desc: 'Guild index' }], category: 'Stratmap' },
  { ns: 'stratmap.game', name: 'createCharacterByString', sig: 'stratmap.game.createCharacterByString(type, Faction, age, name, name2, subFaction, portrait_custom, xCoord, yCoord)', returns: 'characterStruct', desc: 'Creates a new character on the strategy map.', params: [{ name: 'type', type: 'string', desc: 'Character type e.g. "general"' }, { name: 'Faction', type: 'string', desc: 'Faction name' }, { name: 'age', type: 'number', desc: 'Starting age' }, { name: 'name', type: 'string', desc: 'First name' }, { name: 'name2', type: 'string', desc: 'Last name' }, { name: 'subFaction', type: 'string', desc: 'Sub-faction' }, { name: 'portrait_custom', type: 'string', desc: 'Portrait path' }, { name: 'xCoord', type: 'number', desc: 'X coordinate' }, { name: 'yCoord', type: 'number', desc: 'Y coordinate' }], category: 'Stratmap' },
  // ─── stratmap.camera ─────────────────────────────────────────────────────────
  { ns: 'stratmap.camera', name: 'move', sig: 'stratmap.camera.move(xCoord, yCoord)', returns: 'void', desc: 'Smoothly moves the strategy camera to coordinates.', params: [{ name: 'xCoord', type: 'number', desc: 'X' }, { name: 'yCoord', type: 'number', desc: 'Y' }], category: 'Camera' },
  { ns: 'stratmap.camera', name: 'jump', sig: 'stratmap.camera.jump(xCoord, yCoord)', returns: 'void', desc: 'Instantly jumps the strategy camera to coordinates.', params: [{ name: 'xCoord', type: 'number', desc: 'X' }, { name: 'yCoord', type: 'number', desc: 'Y' }], category: 'Camera' },
  { ns: 'stratmap.camera', name: 'zoom', sig: 'stratmap.camera.zoom(distance)', returns: 'void', desc: 'Sets the camera zoom distance.', params: [{ name: 'distance', type: 'number', desc: 'Zoom distance' }], category: 'Camera' },
  // ─── stratmap.objects ────────────────────────────────────────────────────────
  { ns: 'stratmap.objects', name: 'addModelToGame', sig: 'stratmap.objects.addModelToGame(path, modelId)', returns: 'void', desc: 'Registers a .fbx model with a given ID for use on the map.', params: [{ name: 'path', type: 'string', desc: 'Path to .fbx model' }, { name: 'modelId', type: 'string', desc: 'Unique model identifier' }], category: 'Models' },
  { ns: 'stratmap.objects', name: 'startDrawModelAt', sig: 'stratmap.objects.startDrawModelAt(modelId, x, y, sizeMultiplier)', returns: 'void', desc: 'Starts rendering a registered model at map coordinates.', params: [{ name: 'modelId', type: 'string', desc: 'Model ID' }, { name: 'x', type: 'number', desc: 'X' }, { name: 'y', type: 'number', desc: 'Y' }, { name: 'sizeMultiplier', type: 'number', desc: 'Scale (1.0 = normal)' }], category: 'Models' },
  { ns: 'stratmap.objects', name: 'stopDrawModel', sig: 'stratmap.objects.stopDrawModel(modelId)', returns: 'void', desc: 'Stops rendering the specified model.', params: [{ name: 'modelId', type: 'string', desc: 'Model ID to stop' }], category: 'Models' },
  { ns: 'stratmap.objects', name: 'setModel', sig: 'stratmap.objects.setModel(xCoord, yCoord, modelId, modelId2)', returns: 'void', desc: 'Places a model on a specific tile.', params: [{ name: 'xCoord', type: 'number', desc: 'X' }, { name: 'yCoord', type: 'number', desc: 'Y' }, { name: 'modelId', type: 'string', desc: 'Day model ID' }, { name: 'modelId2', type: 'string', desc: 'Night model ID' }], category: 'Models' },
  { ns: 'stratmap.objects', name: 'replaceTile', sig: 'stratmap.objects.replaceTile(label, xCoord, yCoord, filename, weather, dayTime)', returns: 'void', desc: 'Replaces a map tile with a custom tile asset.', params: [{ name: 'label', type: 'string', desc: 'Unique label' }, { name: 'xCoord', type: 'number', desc: 'X' }, { name: 'yCoord', type: 'number', desc: 'Y' }, { name: 'filename', type: 'string', desc: 'Tile asset path' }, { name: 'weather', type: 'number', desc: 'Weather type' }, { name: 'dayTime', type: 'number', desc: 'Day/night (0/1)' }], category: 'Models' },
  { ns: 'stratmap.objects', name: 'addCharacterCas', sig: 'stratmap.objects.addCharacterCas(skeleton, caspath, shadowcaspath, typename, texturepath, scale)', returns: 'void', desc: 'Adds a custom .cas character model to the game.', params: [{ name: 'skeleton', type: 'string', desc: 'Skeleton type' }, { name: 'caspath', type: 'string', desc: 'Path to .cas model' }, { name: 'shadowcaspath', type: 'string', desc: 'Shadow .cas path' }, { name: 'typename', type: 'string', desc: 'Type name' }, { name: 'texturepath', type: 'string', desc: 'Texture path' }, { name: 'scale', type: 'number', desc: 'Scale' }], category: 'Models' },
  // ─── ImGUI ───────────────────────────────────────────────────────────────────
  { ns: 'imgui', name: 'Begin', sig: 'imgui.Begin(title)', returns: 'boolean', desc: 'Opens an ImGUI window. Always call imgui.End() after.', params: [{ name: 'title', type: 'string', desc: 'Window title' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'End', sig: 'imgui.End()', returns: 'void', desc: 'Ends an ImGUI window block started by imgui.Begin().', category: 'ImGUI' },
  { ns: 'imgui', name: 'Text', sig: 'imgui.Text(text)', returns: 'void', desc: 'Renders a text label.', params: [{ name: 'text', type: 'string', desc: 'Text content' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'TextColored', sig: 'imgui.TextColored(r, g, b, a, text)', returns: 'void', desc: 'Renders text with RGBA colour.', params: [{ name: 'r', type: 'number', desc: '0-1' }, { name: 'g', type: 'number', desc: '0-1' }, { name: 'b', type: 'number', desc: '0-1' }, { name: 'a', type: 'number', desc: '0-1' }, { name: 'text', type: 'string', desc: 'Text' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'Button', sig: 'imgui.Button(label)', returns: 'boolean', desc: 'Renders a button. Returns true when clicked.', params: [{ name: 'label', type: 'string', desc: 'Button label' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'Checkbox', sig: 'imgui.Checkbox(label, value)', returns: 'boolean, boolean', desc: 'Renders a checkbox. Returns changed, new value.', params: [{ name: 'label', type: 'string', desc: 'Label' }, { name: 'value', type: 'boolean', desc: 'Current state' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'SliderFloat', sig: 'imgui.SliderFloat(label, value, min, max)', returns: 'boolean, number', desc: 'Float slider. Returns changed, new value.', params: [{ name: 'label', type: 'string', desc: 'Label' }, { name: 'value', type: 'number', desc: 'Current value' }, { name: 'min', type: 'number', desc: 'Min' }, { name: 'max', type: 'number', desc: 'Max' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'SliderInt', sig: 'imgui.SliderInt(label, value, min, max)', returns: 'boolean, number', desc: 'Integer slider. Returns changed, new value.', params: [{ name: 'label', type: 'string', desc: 'Label' }, { name: 'value', type: 'number', desc: 'Current value' }, { name: 'min', type: 'number', desc: 'Min' }, { name: 'max', type: 'number', desc: 'Max' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'InputText', sig: 'imgui.InputText(label, value, bufSize)', returns: 'boolean, string', desc: 'Text input field. Returns changed, new value.', params: [{ name: 'label', type: 'string', desc: 'Label' }, { name: 'value', type: 'string', desc: 'Current text' }, { name: 'bufSize', type: 'number', desc: 'Max buffer size' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'SameLine', sig: 'imgui.SameLine()', returns: 'void', desc: 'Places the next widget on the same line.', category: 'ImGUI' },
  { ns: 'imgui', name: 'Separator', sig: 'imgui.Separator()', returns: 'void', desc: 'Draws a horizontal separator line.', category: 'ImGUI' },
  { ns: 'imgui', name: 'Image', sig: 'imgui.Image(textureId, width, height)', returns: 'void', desc: 'Renders a loaded texture as an image widget.', params: [{ name: 'textureId', type: 'number', desc: 'Texture ID from M2TWEOP.loadTexture()' }, { name: 'width', type: 'number', desc: 'Width px' }, { name: 'height', type: 'number', desc: 'Height px' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'SetNextWindowSize', sig: 'imgui.SetNextWindowSize(width, height)', returns: 'void', desc: 'Sets the size of the next window before imgui.Begin().', params: [{ name: 'width', type: 'number', desc: 'Width' }, { name: 'height', type: 'number', desc: 'Height' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'SetNextWindowPos', sig: 'imgui.SetNextWindowPos(x, y)', returns: 'void', desc: 'Sets the position of the next window.', params: [{ name: 'x', type: 'number', desc: 'X position' }, { name: 'y', type: 'number', desc: 'Y position' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'CollapsingHeader', sig: 'imgui.CollapsingHeader(label)', returns: 'boolean', desc: 'Collapsible section header. Returns true if open.', params: [{ name: 'label', type: 'string', desc: 'Header label' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'BeginTabBar', sig: 'imgui.BeginTabBar(id)', returns: 'boolean', desc: 'Starts a tab bar group.', params: [{ name: 'id', type: 'string', desc: 'Unique tab bar ID' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'EndTabBar', sig: 'imgui.EndTabBar()', returns: 'void', desc: 'Ends a tab bar group.', category: 'ImGUI' },
  { ns: 'imgui', name: 'BeginTabItem', sig: 'imgui.BeginTabItem(label)', returns: 'boolean', desc: 'Adds a tab item. Returns true if selected.', params: [{ name: 'label', type: 'string', desc: 'Tab label' }], category: 'ImGUI' },
  { ns: 'imgui', name: 'EndTabItem', sig: 'imgui.EndTabItem()', returns: 'void', desc: 'Ends a tab item.', category: 'ImGUI' },
];

export const API_CATEGORIES = ['All', 'Core', 'Limits', 'Map', 'Faction', 'GameState', 'Texture', 'Stratmap', 'Camera', 'Models', 'ImGUI'];

export const IMGUI_SNIPPETS = [
  {
    label: 'Basic Window',
    desc: 'A simple ImGUI window with text',
    code: `function onImGuiRender()
  imgui.SetNextWindowSize(300, 200)
  imgui.Begin("My Window")
  imgui.Text("Hello from EOP!")
  imgui.Separator()
  if imgui.Button("Click Me") then
    M2TWEOP.logGame("Button clicked!")
  end
  imgui.End()
end`,
  },
  {
    label: 'Faction Info Panel',
    desc: 'Display faction count and names',
    code: `function onImGuiRender()
  imgui.Begin("Factions")
  local count = stratmap.game.getFactionsCount()
  imgui.Text("Total factions: " .. count)
  imgui.Separator()
  for i = 0, count - 1 do
    local f = stratmap.game.getFaction(i)
    if f then
      imgui.Text(f.name)
    end
  end
  imgui.End()
end`,
  },
  {
    label: 'Debug Overlay',
    desc: 'Show mouse tile coords in an overlay',
    code: `function onImGuiRender()
  imgui.SetNextWindowPos(10, 10)
  imgui.Begin("Debug##overlay")
  local x, y = M2TWEOP.getGameTileCoordsWithCursor()
  imgui.Text("Tile X: " .. tostring(x))
  imgui.Text("Tile Y: " .. tostring(y))
  local fid = M2TWEOP.getLocalFactionID()
  imgui.Text("Player faction: " .. tostring(fid))
  imgui.End()
end`,
  },
  {
    label: 'Slider + Limit Setter',
    desc: 'Live-adjust ancillary limit with a slider',
    code: `local ancLimit = 8

function onImGuiRender()
  imgui.Begin("Limit Tuner")
  local changed, newVal = imgui.SliderInt("Ancillaries Limit", ancLimit, 1, 32)
  if changed then
    ancLimit = newVal
    M2TWEOP.setAncillariesLimit(ancLimit)
  end
  imgui.End()
end`,
  },
];

export const DEFAULT_PLUGIN_SCRIPT = `-- luaPluginScript.lua
-- M2TWEOP Lua Plugin Script
-- Place this file at: <mod>/eopData/eopScripts/luaPluginScript.lua

function onPluginLoad()
  -- Called once when EOP loads. Good place for limit settings.
  M2TWEOP.unlockGameConsoleCommands()
  -- M2TWEOP.setAncillariesLimit(16)
  -- M2TWEOP.setMaxBgSize(100)
  -- M2TWEOP.setReligionsLimit(50)
  -- M2TWEOP.setBuildingChainLimit(40)
  -- M2TWEOP.setGuildCooldown(3)
  M2TWEOP.logGame("[Plugin] Loaded successfully!")
end

function onTurnStart(eventData)
  -- Runs at the start of every faction's turn
end

function onBattleStarted(eventData)
  -- Runs when a battle begins
end

-- Uncomment to enable an ImGUI debug window:
-- function onImGuiRender()
--   imgui.Begin("Debug")
--   imgui.Text("Turn running!")
--   imgui.End()
-- end
`;

export const DEFAULT_IMGUI_SCRIPT = `-- imgui_overlay.lua
-- Example ImGUI overlay for M2TWEOP
-- Merge this logic into luaPluginScript.lua

function onImGuiRender()
  imgui.SetNextWindowSize(320, 240)
  imgui.Begin("EOP Debug Panel")

  if imgui.CollapsingHeader("Game Info") then
    local fid = M2TWEOP.getLocalFactionID()
    imgui.Text("Local faction ID: " .. tostring(fid))
    local ver = M2TWEOP.getGameVersion()
    imgui.Text("Game version: " .. ver)
  end

  if imgui.CollapsingHeader("Map") then
    local x, y = M2TWEOP.getGameTileCoordsWithCursor()
    imgui.Text("Cursor tile: " .. tostring(x) .. ", " .. tostring(y))
  end

  if imgui.Button("Reload Script") then
    M2TWEOP.reloadScript()
  end
  imgui.SameLine()
  if imgui.Button("Toggle Console") then
    M2TWEOP.toggleConsole()
  end

  imgui.End()
end
`;