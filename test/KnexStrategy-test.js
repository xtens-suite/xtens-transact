var expect = require('chai').expect;
var sinon = require('sinon');
var KnexStrategy = require('./../lib/KnexStrategy.js');
var FileSystemManager = require('xtens-fs').FileSystemManager;


/* a test connection according to sails format */
var dbConnection = require('./../config/local.js').connection;
var fsConnection = require('./../config/local.js').fsConnection;

// test data object
var dataObj = {
    files: [
        {uri: "/path/to/file01.ext"},
        {uri: "/another/path/to/file02.ext"},
        {uri: "/yet/another/path/to/file03.ext"}
    ],
    type: 2,
    acquisitionDate: new Date(),
    tags: ["tag", "another tag"],
    notes: "let me test you with knex",
    metadata: {
        attribute1: { value: ["test value"]},
        attribute2: { value: [1.0], unit: ["s"]}
    },
    parentData: undefined,
    parentSample: undefined,
    parentSubject: 1
};

describe('KnexStrategy', function() {

    describe('#constructor', function() {

        
        it ("should create a new knex object with the proper connection", function() {
            var strategy = new KnexStrategy(dbConnection, fsConnection);
            expect(strategy.knex).to.exist;
            expect(strategy.knex).to.have.property('select');
            expect(strategy.knex).to.have.property('insert');
            expect(strategy.knex).to.have.property('update');
        });

    });

    describe('#createData', function() {

        var strategy = new KnexStrategy(dbConnection, fsConnection);
        
        before(function() {
            return strategy.knex('data').truncate()
            .then(function() {
                strategy.knex("data_file").truncate();
            }).then(function() {
                console.log("tables truncated");
            });
        });

        it("# should create the proper query strategy", function() {
            var mock = sinon.mock(FileSystemManager.prototype);
            var dataTypeName = "testDataType";
            /* TODO find a way to mock connections to DB and FileSystem
            return strategy.createData(dataObj, dataTypeName).then(function() {
                console.log("done");
            }).catch(function(err) {
                console.log("error");
            }) ;
           */
        });
    
    });

});
