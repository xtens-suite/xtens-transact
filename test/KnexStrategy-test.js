var expect = require('chai').expect;
var KnexStrategy = require('./../lib/KnexStrategy.js');

/* a test connection according to sails format */
var connection = {
    adapter: 'sails-postgresql',
    host: 'localhost',
    port: 8432,
    user: 'userpg',
    password: 'pwpg',
    database: 'xtens',
    pool: true,
    ssl: false,
    schema: true
};

// test data object
var dataObj = {
    files: [
        {uri: "/path/to/file01.ext"},
        {name: "/another/path/to/file02.ext"},
        {uri: "/yet/another/path/to/file03.ext"}
    ],
    type: 1,
    acquisitionDate: new Date(),
    tags: ["test", "knex test"],
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
            var strategy = new KnexStrategy(connection);
            expect(strategy.knex).to.exist;
            expect(strategy.knex).to.have.property('select');
            expect(strategy.knex).to.have.property('insert');
            expect(strategy.knex).to.have.property('update');
        });

    });

    describe('#dataCreate', function() {

        var strategy = new KnexStrategy(connection);

        it("# should create the proper query strategy", function() {
        
        });
    
    });

});
