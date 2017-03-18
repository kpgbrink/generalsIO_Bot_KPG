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
        this.mountains = new Set();
        this.playerIndex = playerIndex;
        
        this.gotToZero = false;
    }

    update (cities, map, generals, width, height, size, armies, terrain) {
        const currentNow = Date.now();
        if (this.lastDecision !== undefined) {
            const socketDelta = currentNow - this.lastDecision;
            if (socketDelta < 10) {
                console.warn(`got socket interval of ${socketDelta} (likely means that data was waiting when we last wrote!)`);
            }
        }
        
        // update map variable
        this.cities = cities;
        this.map = map;
        this.width = width;
        this.height = height
        this.size = size;
        this.armies = armies;
        this.terrain = terrain;
        this.addGenerals(generals);
        terrain.forEach((t, i) => {
            if (t === TILE_MOUNTAIN) {
                this.mountains.add(i);
            }
        });
        
        console.log('cities', this.cities);
        
        
        // find army index
        this.maxArmyIndex = this.getMaxArmyIndex();
        
        // add new indices
        this.addIndices(this.maxArmyIndex);
        console.log('gottozero', this.gotToZero);
        this.gotToZero = this.gotToZero || this.maxArmyIndex === 0;
        if (!this.gotToZero) {
            const path = this.shortestPath(this.maxArmyIndex, 0);
            if (path && path.length) {
                this.indices = [path.shift()];
            }
        }
        console.log(this.indices);
        
        // get index move randomly
        // TODO make it smarter
        this.endIndex = this.getEndIndex();


        // store past 3 indices
        this.pastIndex.push(this.maxArmyIndex);
        
        
        // move to index
        console.log('attack', this.maxArmyIndex, this.endIndex);

        this.lastDecision = Date.now();
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
        for (const i of this.getNeighbors(index)) {
            console.log('adding index', i);
            this.addIndex(i);
        }
        console.log('indices', this.indices);
        //console.log('done');
     }
    
    getNeighbors(i) {
        return [
            i + 1,
            i - 1,
            i + this.width,
            i - this.width,
        ].filter(potentialNeighbor => this.checkInsideMapReal(i, potentialNeighbor));
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
        return this.checkMoveableReal(this.maxArmyIndex, index);
    }
    
    checkMoveableReal(from, to) {
        return this.checkInsideMapReal(from, to)
        && this.checkCityTakeable(to)
        && !this.isMountain(to);
    }
    
    checkInsideMap (index) {
        return this.checkInsideMapReal(this.maxArmyIndex, index);
    }
    
    checkInsideMapReal(from, to) {
        // TODO. This is done very wrong. Redo this!
        
        // check if goes over
        const fromRow = this.getRow(from);
        const toRow = this.getRow(to);
        
        if (Math.abs(from-to) == 1) {
            // console.log('toRow from Row', toRow, fromRow);
            return toRow == fromRow;
        }
        if (Math.abs(from-to) == this.width) {
            // console.log('movCol, height', toRow, this.height);
            return toRow >= 0 && toRow < this.height;
        }
        throw new Error(`Assertion that ${to} is a neighbor of ${from} failed (fromRow=${fromRow}, toRow=${toRow})`);
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
    
    isMountain (index) {
        //console.log('terrain', this.terrain);
        //console.log('terrrrrrrrrrrrrrrrrrrrrrr', this.terrain[index]);
        return this.mountains.has(index);
    }
    
    getCol (index) {
        return index % this.width;
    }
    
    getRow (index) {
        // console.log('getRow', index/this.width);
        return Math.floor(index/this.width);
    }

    /**
     * Returns an array indicating the positions to move to to get to b.
     * Excludes a and includes b. If there is no path between these locations
     * or b is otherwise inaccessible, returns null.
     *
     * options:
     * - test function (a, b): returns true if the move is allowed. Defaults to checking checkMoveableReal
     * - visit function (i, distance): passed an index and its distance from a. Called for a.
     */
    shortestPath(a, b, options) {
        options = Object.assign({
            test: (from, to) => this.checkMoveableReal(from, to),
            visit: (i, distance) => {},
        }, options);
        if (a === b) {
            options.visit(a, 0);
            return [];
        }
        
        const pathArray = new Array(this.terrain.length);
        // Mark your original location as -1. 
        pathArray[a] = -1; // -1 means source
        // Initialize queue to contain the initial node.
        const nextQ = [{ index: a, distance: 0, }];
        
        // While there are things in the Q, process it.
        while (nextQ.length) {
            const visiting = nextQ.shift();
            options.visit(visiting.index, visiting.distance);
            // Mark all unvisited visitable neighbors of this node
            // as being most quickly accessed through the node we're
            // visiting. Do not walk into mountains.
            for (const neighbor of this.getNeighbors(visiting.index).filter(i => options.test(visiting.index, i))) {
                if (pathArray[neighbor] !== undefined) {
                    // This neighbor has been visited already. Skip.
                    continue;
                }
                
                // Mark the neighbor's source as our visiting node and
                // add to the nextQ.
                pathArray[neighbor] = visiting.index;
                nextQ.push({
                    index: neighbor,
                    distance: visiting.distance + 1,
                });
                
                if (neighbor === b) {
                    // We found the target! Trace back to origin!
                    const path = [];
                    for (let previous = neighbor; previous !== -1; previous = pathArray[previous]) {
                        path.unshift(previous);
                    }
                    // Remove a from the path.
                    path.shift();
                    console.log('found path', path);
                    return path;
                }
            }
        }
        return null;
    }
    
}
