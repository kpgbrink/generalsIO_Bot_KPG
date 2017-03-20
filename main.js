'use strict';

const iMov = require('./imov');

const gameType = 1;

const db = require('./db.js');
const fs = require('fs');
const io = require('socket.io-client');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');
const socket = io('http://botws.generals.io');

const user_id = '23j023dd3';
const username = '[Bot]RandomKPG';

const randInt = function (min, max) {
    return Math.floor(Math.random() * (max+1 - min) + min);
}

socket.on('disconnect', function() {
	console.error('Disconnected from server.');
	process.exit(1);
});

socket.on('connect', function() {
	console.log('Connected to server.');

	/* Don't lose this user_id or let other people see it!
	 * Anyone with your user_id can play on your bot's account and pretend to be your bot.
	 * If you plan on open sourcing your bot's code (which we strongly support), we recommend
	 * replacing this line with something that instead supplies the user_id via an environment variable, e.g.
	 * var user_id = process.env.BOT_USER_ID;
	 */


	// Set the username for the bot.
	// This should only ever be done once. See the API reference for more details.
	socket.emit('set_username', user_id, username);

    startGame();

});


var startGame = function () {
    // Join a custom game and force start immediately.
	// Custom games are a great way to test your bot while you develop it because you can play against your bot!
    if (gameType == 0) {
        var custom_game_id = 'kpgbrinks';
        socket.emit('join_private', custom_game_id, user_id);
        socket.emit('set_force_start', custom_game_id, true);
        console.log('Joined custom game at http://bot.generals.io/games/' + encodeURIComponent(custom_game_id));
    }
	// When you're ready, you can have your bot join other game modes.
	// Here are some examples of how you'd do that:

	// Join the 1v1 queue.
    if (gameType == 1) {
        console.log('Joining 1 v 1');
        socket.emit('join_1v1', user_id);
    }

	// Join the FFA queue.
    if (gameType == 2) {
        console.log('Joining FFA');
	   socket.emit('play', user_id);
    }

	// Join a 2v2 team.
	//socket.emit('join_team', 'team_name', user_id);
}


/* Returns a new array created by patching the diff into the old array.
 * The diff formatted with alternating matching and mismatching segments:
 * <Number of matching elements>
 * <Number of mismatching elements>
 * <The mismatching elements>
 * ... repeated until the end of diff.
 * Example 1: patching a diff of [1, 1, 3] onto [0, 0] yields [0, 3].
 * Example 2: patching a diff of [0, 1, 2, 1] onto [0, 0] yields [2, 0].
 */
function patch(old, diff) {
	var out = [];
	var i = 0;
	while (i < diff.length) {
		if (diff[i]) {  // matching
			Array.prototype.push.apply(out, old.slice(out.length, out.length + diff[i]));
		}
		i++;
		if (i < diff.length && diff[i]) {  // mismatching
			Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
			i += diff[i];
		}
		i++;
	}
	return out;
}

var replay_url = '';

var lastGameStartMessage;
var lastParameters;
var indexMove;
var lastStartDate;
socket.on('game_start', function(data) {
    lastGameStartMessage = data;
	// Get ready to start playing the game.
    // homeDefenseRadius, bozoFrameCountThing, startWait, pastIndicesMax

    lastParameters = Object.freeze({
        homeDefenseRadius: randInt(1,20),
        bozoFrameCountMax: randInt(0, 40),
        startWait: randInt(0, 20),
        pastIndicesMax: randInt(0,1000),
    });
    lastStartDate = new Date();
    indexMove = new iMov(socket, data.playerIndex, lastParameters);
                         // homeDefenseRadius, bozoFrameCountThing, startWait, pastIndicesMax
    indexMove.printSpecialVariables();
	replay_url = 'http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id);
	console.log('Game starting! The replay will be available after the game at ' + replay_url);
});


// --------------------------------------------------------------------------

// Game data.
var cities = []; // The indicies of cities we have vision of.
var map = [];
socket.on('game_update', function(data) {
	// Patch the city and map diffs into our local variables.
	cities = patch(cities, data.cities_diff);
	map = patch(map, data.map_diff);

	// The first two terms in |map| are the dimensions.
	var width = map[0];
	var height = map[1];
	var size = width * height;

	// The next |size| terms are army values.
	// armies[0] is the top-left corner of the map.
	var armies = map.slice(2, size + 2);

	// The last |size| terms are terrain values.
	// terrain[0] is the top-left corner of the map.
	var terrain = map.slice(size + 2, size + 2 + size);

    indexMove.update(cities, data.generals, width, height, size, armies, terrain);

    console.log(replay_url);

    // notes:
    // terrain:
    // -4 mountain


    // Kris's simple tactic
    // 1. Find tile with most units
    // 2. Move from that position
    // 3. Prioritize empty spaces
    // 4. If a city can be captured then take it


});

function leaveGame(outcome) {
    indexMove.printSpecialVariables();
    if (outcome == 1) {
        console.log('I WON THE GAME');
    } else {
        console.log('I LOST THE GAME');
    }
    storeData(outcome);

	socket.emit('leave_game');
    startGame();
}

socket.on('game_lost', () => leaveGame(0));

socket.on('game_won', () => leaveGame(1));

function storeData(outcome) {
    db.then(db => {
        const insertPromise = new Promise((resolve, reject) => db.results.insert({
            gameStart: lastGameStartMessage,
            parameters: lastParameters,
            outcome: outcome,
            startDate: lastStartDate,
            endDate: new Date(),
        }, ex => ex ? reject(ex) : resolve())).then(() => {
            doExport();
        });
    });
}

let lastExportPromise = Promise.resolve();
doExport();
function doExport() {
    lastExportPromise = lastExportPromise.then(() => db).then(db => {
        console.log('beginning export');

        const summaryPromise = new Promise((resolve, reject) => db.results.group([], {}, {count: 0, winPercentage: 0}, "function (obj, prev) { prev.count++; prev.winPercentage = prev.winPercentage * (prev.count - 1)/prev.count + obj.outcome/prev.count; }", (ex, result) => ex ? reject(ex) : resolve(result))).then(result => {
            // Result has winPercentage in it.
            console.log(result);
            return result;
        }, ex => {
            console.log('query unsuccessful');
            console.error(ex);
        });
        const lastHundredGamesPromise = new Promise((resolve, reject) => db.results.find(null, {
            limit: 100,
            sort: [['endDate', -1]],
        }).toArray((ex, result) => ex ? reject(ex) : resolve(result))).then(result => {
            // Got 100 recent things ordered descending by end date.
            // Now summarize.
            return {
                summary: {
                    winPercentage: result.reduce((acc, val) => acc + val.outcome, 0)/result.length,
                },
                lastHundred: result,
            };
        }, ex => {
            console.error(ex);
        });

        console.log('continuing export');
        return summaryPromise.then(summary => {
            return lastHundredGamesPromise.then(lastHundredGames => {
                return {
                    summary: summary,
                    lastHundredGames: lastHundredGames,
                };
            });
        });
    }).then(dataToExport => new Promise((resolve, reject) => {
        const exportPath = path.join(__dirname, 'data', 'export.json');
        const exportPathTemp = exportPath + '~';
        console.log(`removing ${exportPathTemp}`);
        rimraf(exportPathTemp, {glob: false}, ex => {
            console.log('got', ex);
            if (ex) return reject(ex);

            console.log(`exporting to ${exportPathTemp}`);
            fs.writeFile(exportPathTemp, JSON.stringify(dataToExport), ex => {
                if (ex) return reject(ex);

                console.log(`renaming ${exportPathTemp} to ${exportPath}`);
                fs.rename(exportPathTemp, exportPath, ex => {
                    if (ex) return reject(ex);

                    resolve();
                });
            });
        });
    }), ex => {
        console.error(ex);
    });
}
