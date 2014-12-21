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
    
    /**
     * @ transactional Data creation with File Upload to iRODS
     */
    createData: function(dataObj, dataTypeName) {
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
        var idData = null;
        
        return knex.transaction(function(trx) {
            console.log ("KnexStrategy.createData - creating new data instance...");
            // validate data before
            // save the new data entity
            return knex.returning('id').insert(_.extend(data, {
                'created_at': new Date(),
                'updated_at': new Date()
            })).into('data').transacting(trx)
            .then(function(id) {
                idData = id[0];
                console.log("KnexStrategy.createData - data instance created with ID: " + idData);
                return BluebirdPromise.map(files, function(file) {
                    console.log("KnexStrategy.createData - handling file: " + file.uri);
                    return fileSystemManager.storeFileAsync(file.name, dataTypeName, idData);
                });
            })
            .then(function(results) {
                console.log("KnexStrategy.createData - inserting files..");
                return knex.returning('id').insert(
                    _.each(files, function(file) { _.extend(file, { 'created_at': new Date(), 'updated_at': new Date()}); })
                ).into('data_file').transacting(trx);
            })
            .then(function(idFiles) {
                console.log(idFiles);
                console.log("KnexStrategy.createData - creating associations...");
                return BluebirdPromise.map(idFiles, function(idFile) {
            
                    return knex.insert({'data_files': idData, 'datafile_data': idFile }).into('data_files__datafile_data').transacting(trx);

                });
            }); 
        })
        .then(function(inserts) {
            console.log(inserts.length + " new items saved");
        })
        .catch(function(error) {
            console.log("KnexStrategy.createData - error caught");
            console.log(error);
        });

    }

};

module.exports = KnexStrategy;
