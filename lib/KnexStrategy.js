var BluebirdPromise = require('bluebird');
var FileSystemManager = require('xtens-fs').FileSystemManager;
var Validation = require('./Validation.js');
var _ = require("lodash");

/**
 * @description Invalid Format error
 */
function InvalidFormatError(message) {
    this.name = "InvalidFormatError";
    this.message = (message || "");
}
InvalidFormatError.prototype = Error.prototype;

/**
 * @description Transaction error
 */
function TransactionError(message) {
    this.name = "TransactionError";
    this.message = (message || "");
}
TransactionError.prototype = Error.prototype;

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
    this.fileSystemManager = BluebirdPromise.promisifyAll(new FileSystemManager(fsConnection));

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
     * @description transactional Data creation with File Upload to the File System (e.g iRODS)
     */
    createData: function(dataObj, dataTypeName) {
        var knex = this.knex; 
        var fileSystemManager = this.fileSystemManager;
        var files = _.cloneDeep(dataObj.files);
        delete dataObj.files;
        var data = _.omit(dataObj, 'files');
        var idData = null;

        // server-side validation
        var errors = Validation.validateData(data);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        }

        // transaction-safe data creation
        return knex.transaction(function(trx) {
            console.log ("KnexStrategy.createData - creating new data instance...");
            console.log("KnexStrategy.createData - acquisition Date: " + data.date);

            // save the new Data entity
            return knex.returning('id').insert({
                'type': data.type,
                'tags': JSON.stringify(data.tags),
                'notes': data.notes,
                'metadata': data.metadata,
                'acquisition_date': data.date,
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
                    return fileSystemManager.storeFileAsync(file, idData, dataTypeName);
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
            throw new TransactionError("Transaction could not be completed. Please try again");
        });

    },

    /**
     * @description transactional Sample creation with File upload to the File System (e.g. iRODS)
     */
    createSample: function(sample, sampleTypeName) {
        var knex = this.knex;
        var fileSystemManager = this.fileSystemManager;
        var files = _.cloneDeep(sample.files);
        delete sample.files;
        var idSample = null;

        // server-side validation
        var errors = Validation.validateSample(sample);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        }

        // transaction-safe sample creation
        return knex.transaction(function(trx) {
            console.log ("KnexStrategy.createSample - creating new sample instance...");

            // fing the greatest (i.e. the last) inserted biobank_code for that biobank
            // TODO test this thing 
            return knex.max('biobank_code').from('sample')
            .where('biobank', '=', sample.biobank).andWhereNull('parent_data').transacting(trx)

            // store the new Sample entity
            .then(function(maxBiobankCode) {
                var nextCode = '0' + (_.parseInt(maxBiobankCode)+1);
                console.log('nextCode: ' + nextCode);
                var sampleCode = nextCode || sample.biobankCode || '080001';          
                return knex.returning('id').insert({
                    'biobank_code': sampleCode,
                    'type': sample.type,
                    'biobank': sample.biobank,
                    'parent_subject': sample.donor,
                    'parent_sample': sample.parentSample,
                    'metadata': sample.metadata,
                    'created_at': new Date(),
                    'updated_at': new Date()
                }).into('sample').transacting(trx);
            })

            // store the files in the filesystem of choice
            .then(function(id) {
                idSample = id[0];
                console.log("KnexStrategy.createSample - sample instance created with ID: " + idSample);
                return BluebirdPromise.map(files, function(file) {
                    console.log("KnexStrategy.createSample - handling file: " + file.uri);
                    return fileSystemManager.storeFileAsync(file, idSample, sampleTypeName);
                });
            })

            // insert the DataFile instances on the database
            .then(function(results) {
                console.log("KnexStrategy.createSample - inserting files..");
                return knex.returning('id').insert(
                    _.each(files, function(file) { _.extend(file, { 'created_at': new Date(), 'updated_at': new Date()}); })
                ).into('data_file').transacting(trx);
            })

            // create the associations between the Sample instance and the DataFile instances
            .then(function(idFiles) {
                console.log(idFiles);
                console.log("KnexStrategy.createData - creating associations...");
                return BluebirdPromise.map(idFiles, function(idFile) {
                    return knex.insert({'sample_files': idSample, 'datafile_samples': idFile }).into('datafile_samples__sample_files').transacting(trx);
                });
            });

        }) // Knex supports implicit commit/rollback
        .then(function(inserts) {
            console.log(inserts.length + " new items saved");
            return idSample;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createSample - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        }); 

    },

    /**
     *  @description  transactional Subject creation
     */
    createSubject: function(subject, subjectTypeName) {
        var knex = this.knex;
        var fileSystemManager = this.fileSystemManager;
        var projects = _.cloneDeep(sample.projects);
        delete subject.projects;
        var idSubject = null;

        // server-side validation
        var errors = Validation.validateSubject(subject);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        }

        return knex.transaction(function(trx) {
            console.log ("KnexStrategy.createSubject - creating new sample instance...");

            return knex.raw('SELECT currval() FROM subject_id_seq').transacting(trx)
            
            // create the new Subject entity
            .then(function(lastId) {
                var subjCode = 'SUBJ-' + (lastId+1);
                console.log("KnexStrategy.createSubject - subject code: " + subjCode);     
                return knex.returning('id').insert({
                    'code': subjCode,
                    'sex': subject.sex || 'N.D.',
                    'type': subject.type,
                    'tags': JSON.stringify(subject.tags),
                    'notes': subject.notes,
                    'metadata': subject.metadata,
                    'personal_info': subject.personalInfo,
                    'created_at': new Date(),
                    'updated_at': new Date()
                }).into('subject').transacting(trx);
            })

            // create all the Subject-Project associations
            .then(function(id) {
                idSubject = id[0];
                console.log("KnexStrategy.createSubject - creating associations with projects...");
                return BluebirdPromise.map(projects, function(project) {
                    return knex.insert({'project_subjects': project, 'subject_projects': idSubject})
                    .into('project_subjects__subject_projects').transacting(trx);
                });
            });

        }) // Knex supports implicit commit/rollback
        .then(function(inserts) {
            console.log(inserts.length + " new items saved");
            return idSubject;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createSample - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        });

    }

};

module.exports = KnexStrategy;
