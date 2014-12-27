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
        var data = _.omit(dataObj, 'files');
        // var data = {};
        // we must check if this is required 
        /*
        _.each(dataObj, function(value, key) {
            if(value) {
                data[key.toUnderscore()] = value;
            }
        }); */
        var idData = null;
        
        return knex.transaction(function(trx) {
            console.log ("KnexStrategy.createData - creating new data instance...");
            // TODO validate data before
            
            // save the new Data entity
            return knex.returning('id').insert({
                'type': data.type,
                'tags': JSON.stringify(data.tags),
                'notes': data.notes,
                'metadata': data.metadata,
                'acquisition_date': data.acquisitionDate,
                'parent_subject': data.parentSubject,
                'parent_sample': data.parentSample,
                'parent_data': data.parentData,
                'created_at': new Date(),
                'updated_at': new Date()
            }).into('data').transacting(trx)

            // store files on the FileSystem of choice (e.g. iRODS) in their final collection
            .then(function(id) {
                idData = id[0];
                console.log("KnexStrategy.createData - data instance created with ID: " + idData);
                return BluebirdPromise.map(files, function(file) {
                    console.log("KnexStrategy.createData - handling file: " + file.uri);
                    return fileSystemManager.storeFileAsync(file.name, dataTypeName, idData);
                });
            })

            // insert the DataFile instances on the database
            .then(function(results) {
                console.log("KnexStrategy.createData - inserting files..");
                return knex.returning('id').insert(
                    _.each(files, function(file) { _.extend(file, { 'created_at': new Date(), 'updated_at': new Date()}); })
                ).into('data_file').transacting(trx);
            })

            // create the associations between the Data instance and the DataFile instances
            .then(function(idFiles) {
                console.log(idFiles);
                console.log("KnexStrategy.createData - creating associations...");
                return BluebirdPromise.map(idFiles, function(idFile) {
            
                    return knex.insert({'data_files': idData, 'datafile_data': idFile }).into('data_files__datafile_data').transacting(trx);

                });
            }); 
        }) // Knex supports implicit commit/rollback
        .then(function(inserts) {
            console.log(inserts.length + " new items saved");
            return idData;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createData - error caught");
            console.log(error);
        });

    }

};

module.exports = KnexStrategy;
