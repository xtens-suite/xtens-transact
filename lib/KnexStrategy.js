var BluebirdPromise = require('bluebird');
var FileSystemManager = require('xtens-fs').FileSystemManager;
var _ = require("lodash");

/**
 *  @description from camelCase to under_score
 */
String.prototype.toUnderscore = function(){
	return this.replace(/([A-Z])/g, function($1){return "_"+$1.toLowerCase();});
};

var clientMap = {
    'sails-postgresql': 'pg',
    'sails-mysql': 'mysql'
};

function KnexStrategy(dbConnection, fsConnection) {
    if (!dbConnection || !dbConnection.adapter) {
        throw new Error("You must specify a valid connection (according to sails.js connection format)");
    }
    this.fileSystemManager = new FileSystemManager(fsConnection);

    this.knex = require('knex')({
        client: clientMap[dbConnection.adapter],
        connection: {
            host: dbConnection.host,
            port: dbConnection.port,
            user: dbConnection.user,
            password: dbConnection.password,
            database: dbConnection.database
        }
    });
}

KnexStrategy.prototype = {

    createData: function(dataObj) {
        var knex = this.knex; 
        var fileSystemManager = BluebirdPromise.promisifyAll(this.fileSystemManager);
        var files = _.cloneDeep(dataObj.files);
        delete dataObj.files;
        // var data = _.omit(dataObj, 'files');
        var data = {};
        // we must check if this is required
        _.each(dataObj, function(value, key) {
            if(value) {
                data[key.toUnderscore()] = value;
            }
        });
        console.log("KnexStrategy.createData - data: " + data);
        knex.transaction(function(txt) {
            // validate data before
            // save the new data entity
            knex.insert(data).into('data').transacting(trx).then(function(idData) {
                console.log("KnexStrategy.createData - createdData" + idData);
                /* LET'S TEST THIS LATER ON

                var dataTypeName = data.type && data.type.name;
                //register all files on irods at the desired location
                BluebirdPromise.map(files, function(file) {
                    console.log("KnexStrategy.createData - handling file " + file.uri);
                    // TODO how to integrate file system management in the transaction
                    // fileSystemManager.storeFile(file.name, dataTypeName, idData);
                }).then(function() {
                    console.log("KnexStrategy.createData - inserting files..");
                    return knex.insert(files).into('data_file').transacting(trx);
                }).then(function(idFiles) {

                    return BluebirdPromise.map(idFiles, function(idFile) {

                        return knex.insert({'data_files': idData, 'datafile_data': idFile }).into('data_files__datafile_data').transacting(trx);

                    }); 

                });
               */

            })
            .then(trx.commit)
            .catch(function(error) {
                console.log("KnexStrategy.createData - error caught, rolling back... ");
                trx.rollback();
            });
        })
        .then(function(inserts) {
            console.log(inserts.length + " new items saved");
        })
        .catch(function(error) {
            // nothing was inserted, no rollback required
            console.log(error);
        });

    }

};

module.exports = KnexStrategy;
