'use strict';

var io = require('socket.io-client');

var socket = io('http://botws.generals.io');

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
	var user_id = 'this_is_super_secret_dont_copy_kpg';
	var username = 'Bot_kpg';

	// Set the username for the bot.
	// This should only ever be done once. See the API reference for more details.
	socket.emit('set_username', user_id, username);

	// Join a custom game and force start immediately.
	// Custom games are a great way to test your bot while you develop it because you can play against your bot!
	var custom_game_id = 'kpgbrinks';
	socket.emit('join_private', custom_game_id, user_id);
	socket.emit('set_force_start', custom_game_id, true);
	console.log('Joined custom game at http://bot.generals.io/games/' + encodeURIComponent(custom_game_id));

	// When you're ready, you can have your bot join other game modes.
	// Here are some examples of how you'd do that:

	// Join the 1v1 queue.
	// socket.emit('join_1v1', user_id);

	// Join the FFA queue.
	// socket.emit('play', user_id);

	// Join a 2v2 team.
	// socket.emit('join_team', 'team_name', user_id);
});

// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
var TILE_EMPTY = -1;
var TILE_MOUNTAIN = -2;
var TILE_FOG = -3;
var TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.

// Game data.
var playerIndex;
var generals; // The indicies of generals we have vision of.
var cities = []; // The indicies of cities we have vision of.
var map = [];

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

socket.on('game_start', function(data) {
	// Get ready to start playing the game.
	playerIndex = data.playerIndex;
	var replay_url = 'http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id);
	console.log('Game starting! The replay will be available after the game at ' + replay_url);
});


// --------------------------------- IMOV
class iMov {
    constructor () {
        this.pastPosition = 0;
        this.indices = [];
    }

    update (cities, map, generals, width, height, size, armies, terrain) {
        // update map variable
        this.cities = cities;
        this.map = map;
        this.generals = generals;
        this.width = width;
        this.height = height
        this.size = size;
        this.armies = armies;
        this.terrain = terrain;
        
        console.log('cities', this.cities);
        
        
        
        // find army index
        this.maxArmyIndex = this.getMaxArmyIndex();
        
        // add new indices
        this.addIndices(this.maxArmyIndex);
        console.log(this.indices);
        
        // get index move randomly
        // TODO make it smarter
        this.endIndex = this.getEndIndex();


        // store past index
        this.pastIndex = this.maxArmyIndex;
        // move to index
        console.log('attack', this.maxArmyIndex, this.endIndex);
        socket.emit('attack', this.maxArmyIndex, this.endIndex);
    }

    addIndex (index) { 
        if(this.checkMoveable(index)) {
            console.log('yes');
            this.indices.push(index);
        }
    }
        
    addIndices (index) { 
        console.log('adding indices');
        this.indices = [];
        this.addIndex(index+1);
        this.addIndex(index-1);
        this.addIndex(index+this.width);
        this.addIndex(index-this.width);
        console.log('done');
     }
     
     getEndIndex () {
        let newIndices = this.indices;
        if (this.indices.length > 1) {
            newIndices = newIndices.filter((value) => { return value != this.pastIndex });
        } 

        return newIndices[Math.floor(Math.random()*newIndices.length)]; 
    }
     
    getMaxArmyIndex () {
        let arr = this.armies;
        let terrain = this.terrain;
        if (arr.length === 0) {
            return -1;
        }
        var max = arr[0];
        var maxIndex = 0;

        for (var i = 1; i < arr.length; i++) {
            if (arr[i] > max && terrain[i] === playerIndex) {
                maxIndex = i;
                max = arr[i];
            }
        }
        this.armySize = max;
        return maxIndex;
    }
    
    checkMoveable (index) {
        console.log('inside map', this.checkInsideMap(index));
        console.log('checkMountain', this.checkMountain(index));
        console.log('checkCityTakable', this.checkCityTakeable(index));
        console.log('add it? : ', this.checkInsideMap(index) && 
        this.checkCityTakeable(index) &&
        this.checkMountain(index));
        return this.checkInsideMap(index) && 
        this.checkCityTakeable(index) &&
        this.checkMountain(index);
    }
    
    checkInsideMap (index) {
        return (this.map[index] != undefined);
    }
    
    checkCityTakeable (index) {
        for (let city in cities) {
            if (city == index) {
                return this.armySize > 60;
            }
        }
        return true;
    }
    
    checkMountain (index) {
        //console.log('terrain', this.terrain);
        console.log('terrrrrrrrrrrrrrrrrrrrrrr', this.terrain[index]);
        return (this.terrain[index] != TILE_MOUNTAIN );
    }
}






// --------------------------------------------------------------------------
var indexMove = new iMov();

socket.on('game_update', function(data) {
	// Patch the city and map diffs into our local variables.
	cities = patch(cities, data.cities_diff);
	map = patch(map, data.map_diff);
	generals = data.generals;

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
    
    indexMove.update(cities, map, generals, width, height, size, armies, terrain);
    
    
    
    // notes:
    // terrain:
    // -4 mountain
    
    
    // Kris's simple tactic
    // 1. Find tile with most units
    // 2. Move from that position
    // 3. Prioritize empty spaces
    // 4. If a city can be captured then take it

    
    
    
    
    /*
    if (false) {
        // Make a random move.
        while (true) {
            // Pick a random tile.
            var index = Math.floor(Math.random() * size);

            // If we own this tile, make a random move starting from it.
            if (terrain[index] === playerIndex) {
                var row = Math.floor(index / width);
                var col = index % width;
                var endIndex = index;

                var rand = Math.random();
                if (rand < 0.25 && col > 0) { // left
                    endIndex--;
                } else if (rand < 0.5 && col < width - 1) { // right
                    endIndex++;
                } else if (rand < 0.75 && row < height - 1) { // down
                    endIndex += width;
                } else if (row > 0) { //up
                    endIndex -= width;
                } else {
                    continue;
                }

                // Would we be attacking a city? Don't attack cities.
                if (cities.indexOf(endIndex) >= 0) {
                    continue;
                }

                socket.emit('attack', index, endIndex);
                break;
            }
        }
    }*/
    
});

function leaveGame() {
	socket.emit('leave_game');
}

socket.on('game_lost', leaveGame);

socket.on('game_won', leaveGame);