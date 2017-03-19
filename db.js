'use strict';

const Db = require('tingodb')().Db;
const mkdirp = require('mkdirp');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'logdb');
module.exports = new Promise((resolve, reject) => mkdirp(dbPath, err => err ? reject(err) : resolve())).then(() => {
    const db = new Db(dbPath, {});

    const collections = [];
    const addCollection = (name, options) => collections.push(new Promise((resolve, reject) => db.createCollection(name, options, (err, collection) => {
        if (err) return reject(err);
        resolve(collection);
    })).then(collection => ({
        name: name,
        collection: collection,
    })));
    addCollection('results', {});
    return Promise.all(collections).then(collections => {
        return Object.freeze(collections.reduce((acc, val) => {
            acc[val.name] = val.collection;
            return acc;
        }, Object.create(null)));
    });
});
