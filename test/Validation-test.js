var expect = require("chai").expect;
var Validation = require('./../lib/Validation.js');

describe("Validation", function() {

    describe("validateData", function() {

        it("should return no error message with a valid Data instance", function() {
            var validData = {
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
            var errors = Validation.validateData(validData);
            if (errors && errors.length) {
                errors.forEach(function(error) { console.log(error); });
            }
            expect(errors).to.be.null;

        });
    });

});

