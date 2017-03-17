'use strict';



// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.



module.exports = 
// --------------------------------- IMOV
class iMov {
    constructor (socket, playerIndex) {
        this.socket = socket;
        this.indices = [];
        this.pastIndex = [];
        this.generals = new Set();
        this.playerIndex = playerIndex;
    }

    update (cities, map, generals, width, height, size, armies, terrain) {
        // update map variable
        this.cities = cities;
        this.map = map;
        this.width = width;
        this.height = height
        this.size = size;
        this.armies = armies;
        this.terrain = terrain;
        this.addGenerals(generals);
        
        console.log('cities', this.cities);
        
        
        // find army index
        this.maxArmyIndex = this.getMaxArmyIndex();
        
        // add new indices
        this.addIndices(this.maxArmyIndex);
        console.log(this.indices);
        
        // get index move randomly
        // TODO make it smarter
        this.endIndex = this.getEndIndex();


        // store past 3 indices
        this.pastIndex.push(this.maxArmyIndex);
        
        // move to index
        console.log('attack', this.maxArmyIndex, this.endIndex);
        
        this.socket.emit('attack', this.maxArmyIndex, this.endIndex);
    }
    
    addGenerals(generals) {
        for (const general of generals) {
            this.generals.add(general);
        }
    }

    addIndex (index) { 
        if(this.checkMoveable(index)) {
            // console.log('yes');
            this.indices.push(index);
        }
    }
        
    addIndices (index) { 
        //console.log('adding indices');
        this.indices = [];
        this.addIndex(index+1);
        this.addIndex(index-1);
        this.addIndex(index+this.width);
        this.addIndex(index-this.width);
        console.log('indices', this.indices);
        //console.log('done');
     }
     
     getEndIndex () {
        let newIndices = this.indices;
         
        let deleteIndex = this.pastIndex.length;
         
        //console.log('checkThis', this.pastIndex[this.deleteIndex-2]);
        while (newIndices.length > 1 && deleteIndex > 0) {
            
            deleteIndex--;
            
            newIndices = newIndices.filter((value) => { 
                if (value == this.pastIndex[deleteIndex]) {
                    console.log('filtering', this.pastIndex[deleteIndex]);
                }
                return value != this.pastIndex[deleteIndex];
            });
        } 
        if (this.pastIndex.length > 500) {
            this.pastIndex.shift();
        }
         
        if (newIndices.length == 0) {
            throw 'Indice should not become 0';
        }
         // console.log('newIndices', newIndices);

        return newIndices[Math.floor(Math.random()*newIndices.length)]; 
    }
     
    getMaxArmyIndex () {
        let arr = this.armies;
        if (arr.length === 0) {
            return -1;
        }
        var max = arr[0];
        var maxIndex = 0;

        for (var i = 1; i < arr.length; i++) {
            if (arr[i] > max && this.terrain[i] === this.playerIndex) {
                maxIndex = i;
                max = arr[i];
            }
        }
        this.armySize = max;
        return maxIndex;
    }
    
    checkMoveable (index) {
        //console.log('inside map', this.checkInsideMap(index));
        //console.log('checkMountain', this.checkMountain(index));
        //console.log('checkCityTakable', this.checkCityTakeable(index));
        //console.log('add it? : ', this.checkInsideMap(index) && 
       // this.checkCityTakeable(index) &&
        //this.checkMountain(index);
        return this.checkInsideMap(index) && 
        this.checkCityTakeable(index) &&
        this.checkMountain(index);
    }
    
    checkInsideMap (index) {
        // TODO. This is done very wrong. Redo this!
        
        // check if goes over
        let fromRow = this.getRow(this.maxArmyIndex);
        let movRow = this.getRow(index);
        
        if (Math.abs(this.maxArmyIndex-index) == 1) {
            // console.log('movRow from Row', movRow, fromRow);
            return movRow == fromRow;
        }
        if (Math.abs(this.maxArmyIndex-index) == this.width) {
            // console.log('movCol, height', movRow, this.height);
            return movRow >= 0 && movRow < this.height;
        }
        
        throw 'Should not try to move there';
    }
    
    checkCityTakeable (index) {
        
        
        for (let city of this.cities) {

            // Check if army big enough to take city
            if (city != index) {
                continue;
            }

            // If city not owned attack it no matter the cost
            if (this.terrain[index] < 0) {
                return this.armySize - 4 > this.armies[city];
            }
        }

        return true;
    }
    
    checkMountain (index) {
        //console.log('terrain', this.terrain);
        //console.log('terrrrrrrrrrrrrrrrrrrrrrr', this.terrain[index]);
        return (this.terrain[index] != TILE_MOUNTAIN );
    }
    
    getCol (index) {
        return index % this.width;
    }
    
    getRow (index) {
        // console.log('getRow', index/this.width);
        return Math.floor(index/this.width);
    }
    
    shortestPath(a, b) {
        let pathArray = new Array(this.terrain.length);
        
    }
    
}
