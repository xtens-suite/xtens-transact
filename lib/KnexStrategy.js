var Bluebird = require('bluebird');

var clientMap = {
    'sails-postgresql': 'pg',
    'sails-mysql': 'mysql'
};

function KnexStrategy(connection) {
    if (!connection || !connection.adapter) {
        throw new Error("You must specify a valid connection (according to sails.js connection format)");
    }
    this.knex = require('knex')({
        client: clientMap[connection.adapter],
        connection: {
            host: connection.host,
            port: connection.port,
            user: connection.user,
            password: connection.password,
            database: connection.database
        }
    });
}

KnexStrategy.prototype = {
    
    createData: function(dataObj) {
        var that = this;
        var files = _.cloneDeep(dataObj.files);
        var data = _.omit(dataObj, 'files');
        
        // we must check if this is required
        _.each(data, function(value, key) {
            if (!value) {
                delete data[key];
            }
        });

        this.knex.transaction(function(txt) {
            // save the new data entity
            that.knex.insert(data).into('data').transacting(trx).then(function(idData) {
           
                that.knex.insert(data.files).into('data_file').transacting(trx).then(function(idFiles) {
                   
                   return Bluebird.map(idFiles, function(idFile) {
                       
                      return that.knex.insert({data_files: idData, datafile_data: idFile }).into('data_files__datafile_data').transacting(trx);

                   }); 

                });
            
            })
            .then(trx.commit)
            .catch(trx.rollback);
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
