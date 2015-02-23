var BluebirdPromise = require('bluebird');
var FileSystemManager = require('xtens-fs').FileSystemManager;
var Validation = require('./Validation.js');
var _ = require("lodash");

/**
 * @private
 * @description evaluate whether the metadata field has a measure unit. Only numeric values are allowed a unit. 
 * @return {boolean} - true if the metadata field has unit
 */
function isUnitAllowed(field, fieldInstance) {
    // if its not numeric return false
    if (field.field_type !== 'Integer' && field.field_type !== 'Float') return false;
    if (!field.has_unit) return false;
    if (field.unit || _.isArray(field.units)) return true;
    return false;
}

/**
 * @private
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
     * @method
     * @name createDataType
     * @description transactional DataType creation
     */
    createDataType: function(dataType) {
        var knex = this.knex;
        var idDataType;
        
        // server-side validation
        var errors = Validation.validateDataType(dataType);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        }

        return knex.transaction(function(trx) {
            
            return knex.returning('id').insert({
                'name': dataType.name,
                'model': dataType.model,
                'schema': dataType.schema,
                'created_at': new Date(),
                'updated_at': new Date()
            }).into('data_type').transacting(trx)

            .then(function(ids) {
                idDataType = ids[0];
                return BluebirdPromise.map(dataType.parents, function(idParent) {
                    // NOTE: for some reason the column nomenclature is inverted here (must be preserved for Sails associations to work)
                    return knex.returning('id').insert({
                        'datatype_parents': idDataType,
                        'datatype_children': idParent
                    }).into('datatype_children__datatype_parents').transacting(trx);
                });
            });

        })

        .then(function(createdAssociation) {
            return idDataType;
        })
        
        .catch(function(error) {
            throw new TransactionError("error while creating the new DataType");
        });

    },

    /**
     * @method
     * @name updateDataType
     * @description transactional DataType creation
     *
     */
    updateDataType: function(dataType) {
        var knex = this.knex;
        
        // server-side validation
        var errors = Validation.validateDataType(dataType);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        } 

        return knex.transaction(function(trx) {
            
            return knex.where('id','=',dataType.id).update({
                'name': dataType.name,
                'schema': dataType.schema,
                'updated_at': new Date()
            },'id').transacting(trx)
            
            // find all the existing associations
            .then(function(idUpdated) {
                return knex('datatype_parents__datatype_children').where('datatype_parent', dataType.id).transacting(trx);
            })

            .then(function(foundDTAssociations) {

                return BluebirdPromise.map(dataType.parents, function(idParent) {
                    
                    // if the associations exists, leave it alone
                    if (_.findWhere(foundDTAssociations, {'datatype_children': idParent})) {
                        console.log("KnexStrategy.updateDataType - child-parent association found: " + dataType.id + "-" + idParent);
                        return;
                    }

                    // otherwise insert a new association (no support for deleting associations is currently provided for consistency)
                    else {
                        return knex.returning('id').insert({
                            'datatype_parents': idDataType,
                            'datatype_children': idParent
                        }).into('datatype_children__datatype_parents').transacting(trx);
                    }

                });
            
            });

        })

        .then(function(createdAssociation) {
            return dataType.id;
        })
        
        .catch(function(error) {
            throw new TransactionError("error while updating the existing DataType: " + dataType.id);
        });

    },

    /**
     * @method
     * @name createData
     * @description transactional Data creation with File Upload to the File System (e.g iRODS)
     * @param {Object} data - an xtens-app Data entity
     * @param {string} dataTypeName - the name of the DataType (used only for file storage)
     * @return idData the ID of the newly created Data
     */
    createData: function(data, dataTypeName) {
        var knex = this.knex; 
        var fileSystemManager = this.fileSystemManager;
        var files = data.files ? _.cloneDeep(data.files) : [];
        delete data.files;
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
            .then(function(ids) {
                idData = ids[0];
                console.log("KnexStrategy.createData - data instance created with ID: " + idData);
                return BluebirdPromise.map(files, function(file) {
                    console.log("KnexStrategy.createData - handling file: " + file.uri);
                    return fileSystemManager.storeFileAsync(file, idData, dataTypeName);
                });
            })

            // insert the DataFile instances on the database
            .then(function(results) {
                if (results.length) {   // if there are files store their URIs on the database
                    console.log("KnexStrategy.createData - inserting files..");
                    return knex.returning('id').insert(
                        _.each(files, function(file) { _.extend(file, { 'created_at': new Date(), 'updated_at': new Date()}); })
                    ).into('data_file').transacting(trx);
                }
                else {  // else return an empty array
                    return [];
                }
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
            console.log("KnexStrategy.createData: transaction committed for new Data: " + idData);
            return idData;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createData - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        });

    },


    /**
     * @method
     * @name updateData
     * @description transactional Data update. Files should not be changed after creation (at least in the current implementation are not)
     */
    updateData: function(data) {
        var knex = this.knex;

        // server-side validation
        var errors = Validation.validateData(data);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        }

        // transaction-safe Data update
        return knex.transaction(function(trx) {

            return knex('data').where('id','=',data.id).update({
                // NOTE: should I also update parent_subject, parent_sample and/or parent_data? Should it be proper/safe?
                'tags': JSON.stringify(data.tags),
                'notes': data.notes,
                'acquisition_date': data.date,
                'metadata': data.metadata,
                'updated_at': new Date()
            },'id').transacting(trx);

        })
        .then(function(idUpdated) {
            var idData = idUpdated[0];
            console.log("KnexStrategy.updateData: transaction committed updating Data with ID: " + idData);
            return idData;
        })
        .catch(function(error){
            console.log("KnexStrategy.updateData - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        });
    },

    /**
     * @method 
     * @name createSample
     * @description transactional Sample creation with File upload to the File System (e.g. iRODS)
     */
    createSample: function(sample, sampleTypeName) {
        var knex = this.knex;
        var fileSystemManager = this.fileSystemManager;
        var files = sample.files ? _.cloneDeep(sample.files) : [];
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
            .whereNull('parent_sample').andWhere('biobank', '=', sample.biobank).transacting(trx)

            // store the new Sample entity
            .then(function(maxBiobankCode) {
                maxBiobankCode = _.parseInt(maxBiobankCode);
                var nextCode = _.isNaN(maxBiobankCode) ? '08001' : '0' + (maxBiobankCode+1);
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
            .then(function(ids) {
                idSample = ids[0];
                console.log("KnexStrategy.createSample - sample instance created with ID: " + idSample);
                return BluebirdPromise.map(files, function(file) {
                    console.log("KnexStrategy.createSample - handling file: " + file.uri);
                    return fileSystemManager.storeFileAsync(file, idSample, sampleTypeName);
                });
            })

            // insert the DataFile instances on the database
            .then(function(results) {
                if (results.length) {   // if there are files store their URIs on the database
                    console.log("KnexStrategy.createSample - inserting files..");
                    return knex.returning('id').insert(
                        _.each(files, function(file) { _.extend(file, { 'created_at': new Date(), 'updated_at': new Date()}); })
                    ).into('data_file').transacting(trx);
                }
                else {      // else just return an empty array
                    return [];  // else return a promise with an empty array;
                }                
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
            console.log("KnexStrategy.createSample: transaction committed for new Sample: " + idSample);
            return idSample;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createSample - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        }); 

    },

    /**
     * @method
     * @name updateSample
     * @description transaction-safe Sample update
     * @param {Object} sample - a Sample entity
     * @return idSample the ID of the updated Sample
     */
    updateSample: function(sample) {
        var knex = this.knex;

        // server-side validation
        var errors = Validation.validateSample(sample);
        if (errors) {
            throw new InvalidFormatError("Validation error:" + errors.join("\n"));
        }

        return knex.transaction(function(trx) {

            return knex('sample').where('id','=',sample.id).update({
                'biobank': sample.biobank,
                'parent_subject': sample.donor,
                'metadata': sample.metadata,
                'updated_at': new Date()
            },'id').transacting(trx);

        })

        .then(function(idUpdated) {
            var idSample = idUpdated[0];
            console.log("KnexStrategy.updateSample: transaction committed updating Data with ID: " + idSample);
            return idSample;
        })
        .catch(function(error){
            console.log("KnexStrategy.updateSample - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        });


    },

    /**
     *  @method
     *  @name createSubject
     *  @description  transactional Subject creation
     */
    createSubject: function(subject, subjectTypeName) {
        var knex = this.knex;
        var idProjects = _.cloneDeep(subject.projects) || [];
        delete subject.projects;
        var idSubject = null;

        // server-side validation
        var errors = Validation.validateSubject(subject);
        if (errors) {
            throw new InvalidFormatError("Validation error: " + errors.join("\n"));
        }

        return knex.transaction(function(trx) {
            console.log ("KnexStrategy.createSubject - creating new subject instance...");

            // create the new PersonalDetails instance (if personalDetails are present)
            return BluebirdPromise.try(function() {
                if (!subject.personalInfo) {
                    return;
                }
                else {
                    return knex.returning('id').insert({
                        'given_name': subject.personalInfo.givenName,
                        'surname': subject.personalInfo.surname,
                        'birth_date': subject.personalInfo.birthDate,
                        'created_at': new Date(),
                        'updated_at': new Date()
                    }).into('personal_details').transacting(trx);
                }
            })

            // get the last inserted SUBJECT id
            .then(function(ids) {
                subject.personalInfo = ids && ids[0];
                return knex.raw('SELECT last_value FROM subject_id_seq').transacting(trx);
            })

            // create the new Subject entity
            .then(function(result) {
                var lastId = result.rows && result.rows[0] && _.parseInt(result.rows[0].last_value);
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
            .then(function(ids) {
                idSubject = ids[0];
                console.log("KnexStrategy.createSubject - creating associations with projects...");
                return BluebirdPromise.map(idProjects, function(idProject) {
                    return knex.insert({'project_subjects': idProject, 'subject_projects': idSubject})
                    .into('project_subjects__subject_projects').transacting(trx);
                });
            });

        }) // Knex supports implicit commit/rollback
        .then(function(inserts) {
            console.log("KnexStrategy.createSubject: transaction committed for new Subject: " + idSubject);
            return idSubject;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createSample - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        });

    },

    /**
     * @method
     * @name updateSubject
     * @description transaction-safe Subject update
     * @param {Object} subject - the Subject entity to be updated
     * @return idSubject
     */
    updateSubject: function(subject) {

        var knex = this.knex, idSubject;
        var idProjects = _.cloneDeep(subject.projects) || [];
        delete subject.projects;

        var errors = Validation.validateSubject(subject);
        if (errors) {
            throw new InvalidFormatError("Validation error: " + errors.join("\n"));
        }

        return knex.transaction(function(trx) {

            // Update or create personal information
            return BluebirdPromise.try(function() {
                console.log("KnexStrategy.updateSubject - trying to create/edit PersonalInfo: " + subject.personalInfo);

                // if no personalInfo is provided just skip this step (no creation/update)
                if (!_.isObject(subject.personalInfo)) {
                    return;
                }

                // you have to create a new personal_details entity (i.e. row)
                else if(!subject.personalInfo.id) {
                    return knex.returning('id').insert({
                        'surname': subject.personalInfo.surname,
                        'given_name': subject.personalInfo.givenName,
                        'bith_date': subject.personalInfo.birthDate
                    }).into('personal_details').transacting(trx);
                }

                // otherwise update personal_details
                else {
                    return knex('personal_details').where('id','=',subject.personalInfo.id).update({
                        'surname': subject.personalInfo.surname,
                        'given_name': subject.personalInfo.givenName,
                        'birth_date': subject.personalInfo.birthDate
                    },'id').transacting(trx);
                }

            })

            // update Subject entity
            .then(function(id) {
                console.log("KnexStrategy.updateSubject - updating Subject...");

                if(id & id[0]) {
                    subject.personalInfo = id[0];
                }
                return knex('subject').where('id', '=', subject.id).update({
                    'tags': JSON.stringify(subject.tags),
                    'notes': subject.notes,
                    'metadata': subject.metadata,
                    'updated_at': new Date()
                },'id').transacting(trx);

            })

            // update Projects if present 
            // first delete all existing Projects
            .then(function(id) {
                console.log("KnexStrategy.updateSubject - dissociating projects for Subject ID: " + id[0]);
                idSubject = id[0];
                return knex('project_subjects__subject_projects').where('subject_projects','=',idSubject).del().transacting(trx);
            })

            // then insert all listed Projects
            .then(function() {
                console.log("KnexStrategy.updateSubject - associating projects for Subject ID: " + idSubject);
                return BluebirdPromise.map(idProjects, function(idProject) {
                    return knex.insert({'project_subjects': idProject, 'subject_projects': idSubject})
                    .into('project_subjects__subject_projects').transacting(trx);
                });
            });

        })
        .then(function() {
            console.log('KnexStrategy.updateSubject - transaction commited for updating subject with ID:' + idSubject);
            return idSubject;
        })
        .catch(function(error) {
            console.log("KnexStrategy.createSample - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Please try again");
        });

    },

    /**
     *  @method 
     *  @name putMetadataFieldsIntoEAV
     *  @description extract the Metadata Fields from the JSON schema and stores each one in a dedicated 
     *              ATTRIBUTE table, for use in an EAV catalogue
     *  @param {integer} idDataType - the identifier of the DataType (i.e. ENTITY)
     *  @param {Array} fields - the array containing all the MetadataFields to be inserted (or updated?)
     *
     */
    putMetadataFieldsIntoEAV: function(idDataType, fields) {

        var knex = this.knex;

        return knex.transaction(function(trx) {

            // for each metadata field
            return BluebirdPromise.map(fields, function(field) {

                // insert the new metadata field
                return knex('eav_attribute').where({
                    'data_type': idDataType,
                    'name': field.name
                }).transacting(trx)

                .then(function(found) {
                    console.log("KnexStrategy.putMetadataFieldsIntoEAV - found for field " + field.name + ": "  + found);
                    if (_.isEmpty(found)) {
                        console.log("KnexStrategy.putMetadataFieldsIntoEAV - inserting field " + field.name);
                        return knex.returning('id').insert({
                            'data_type': idDataType,
                            'name': field.name,
                            'field_type': field.fieldType,
                            'has_unit': field.hasUnit,
                            'created_at': new Date(),
                            'updated_at': new Date()
                        }).into('eav_attribute').transacting(trx);
                    }
                });

            });

        })

        .then(function(insertedIds) {
            console.log('KnexStrategy.putMetadataFieldsIntoEAV - transaction commited for DataType:' + idDataType);
            return _.flatten(insertedIds);
        })

        .catch(function(error) {
            console.log("KnexStrategy.putMetadataFieldsIntoEAV - error caught");
            console.log(error);
            throw new TransactionError("Transaction could not be completed. Some error occurred");
        });
    },


    /**
     * @method
     * @name putMetadataValuesIntoEAV
     * @description extract the metadata values from the "metadata" column of the "data" ("subject" or "sample") entity, 
     * and store it in the appropriate EAV Value(s) table. Five value tables are provided, one for each fundamental data type (text, integer, float,
     * date and boolean) 
     * @param {Object} data -  the Data (Subject, Sample or Generic) that must extracted and loadad in the EAV catalogue
     *
     */
    putMetadataValuesIntoEAV: function(data, eavValueTableMap) {
        
        console.log("KnexStrategy.putMetadataValuesIntoEAV - eavValueTableMap: " + eavValueTableMap);
        var knex = this.knex;
        return knex.transaction(function(trx) {

            return knex('data_type').where({id: data.type}).first('class_template').transacting(trx)

            .then(function(row) {
                
                // identify the table (e.g. data, subject, sample...)
                var entityTable = row.class_template === 'Generic' ? 'data' : row.class_template.toLowerCase().toUnderscore(); // TODO change this row
                console.log("KnexStrategy.putMetadataValuesIntoEAV - entity table is: " + entityTable);
                
                // store each metadata value in the appropriate EAV catalogue
                return BluebirdPromise.map(Object.keys(data.metadata), function(metadataField) {

                    console.log("KnexStrategy.putMetadataValuesIntoEAV - trying to retrieve the metadataField: " + metadataField);
                    // find the attribute 
                    return knex('eav_attribute').where({
                        'data_type': data.type,
                        'name': metadataField
                    }).transacting(trx)

                    // 
                    .then(function(eavAttribute) {
                        if (eavAttribute.length !== 1) {
                            throw new Error("none or more than one attribute was restrieved!!");
                        }
                        eavAttribute = eavAttribute[0];
                        var eavValueTable;
                        console.log("KnexStrategy.putMetadataValuesIntoEAV - eavAttribute: " + eavAttribute);
                        // if the metadata has a single field value, insert it!
                        if (data.metadata[metadataField].value) {
                            console.log("KnexStrategy.putMetadataValuesIntoEAV - field " + metadataField + " is a single attribute");
                            var eavValue = {
                                // 'entity_table': table,
                                'entity': data.id,
                                'attribute': eavAttribute.id,
                                'value': data.metadata[metadataField].value,
                                'created_at': new Date(),
                                'updated_at': new Date()
                            };

                            if (isUnitAllowed(eavAttribute, data.metadata[metadataField])) {
                                console.log ("KnexStrategy.putMetadataValuesIntoEAV - unit allowed for field: " + metadataField);
                                eavValue.unit = data.metadata[metadataField].unit;
                            }
                            eavValueTable = eavValueTableMap[eavAttribute.field_type] + '_' + entityTable;
                            console.log("KnexStrategy.putMetadataValuesIntoEAV - eavAttribute: " + eavAttribute);
                            console.log("KnexStrategy.putMetadataValuesIntoEAV - inserting new value into table " + eavValueTable);
                            return knex.returning('id').insert(eavValue).into(eavValueTable).transacting(trx);
                        }

                        // otherwise it is a loop!!
                        else if (_.isArray(data.metadata[metadataField].values)) {
                            console.log("KnexStrategy.putMetadataValuesIntoEAV - field " + metadataField + " is a loop");
                            var unitAllowed = isUnitAllowed(data.metadata[metadataField], eavAttribute);
                            var eavValues = data.metadata[metadataField].values.map(function(value, index) {
                                var instance = {
                                    'entity': data.id,
                                    'attribute': eavAttribute.id,
                                    'value': value,
                                    'created_at': new Date(),
                                    'updated_at': new Date()
                                };
                                if (unitAllowed) {
                                    console.log ("KnexStrategy.putMetadataValuesIntoEAV - unit allowed for field: " + metadataField);
                                    instance.unit = data.metadata[metadataField].units[index];
                                }
                                return instance;
                            });
                            eavValueTable = eavValueTableMap[eavAttribute.field_type] + '_' + entityTable;
                            console.log("KnexStrategy.putMetadataValuesIntoEAV - inserting new value into table " + eavValueTable);
                            return knex.returning('id').insert(eavValues).into(eavValueTable).transacting(trx);
                        }

                        // something is wrong, throw new error  
                        else {
                            console.log("KnexStrategy.putMetadataValuesIntoEAV - metadata field" + metadataField + 
                                        "missing or it does not possess a valid value");
                        }
                    });

                })

                .then(function(ids) {

                    console.log("KnexStrategy.putMetadataValuesIntoEAV - inserted successfully new metadata value: IDS " + ids);
                    return ids;
                }); 
            })

            .then(function(insertedIds) {
                // console.log('KnexStrategy.putMetadataValuesIntoEAV - inserted values'+ insertedIds);
                return _.flatten(insertedIds);
            })

            .catch(function(error) {
                console.log("KnexStrategy.putMetadataValuesIntoEAV - error caught");
                console.log(error);
                throw new TransactionError("Transaction could not be completed. Some error occurred");
            });

        });

    }

};

module.exports = KnexStrategy;
