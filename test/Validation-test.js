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
                    "attribute1": { "value": ["test value"]},
                    "attribute2": { "value": [1.0], "unit": ["s"]}
                },
                parentData: undefined,
                parentSample: undefined,
                parentSubject: 1
            };
            var errors = Validation.validateData(validData);
            expect(errors).to.be.null;
            delete validData.files;
            delete validData.acquisitionDate;
            errors = Validation.validateData(validData);
            expect(errors).to.be.null;
            delete validData.tags;
            errors = Validation.validateData(validData);
            expect(errors).to.be.null;
            
        });

        it("should return an error message for date not valid", function() {
            var unformattedDateData = {
                type: 2,
                acquisitionDate: "11/122/198",
                tags: ["tag", "another tag"],
                notes: "let me test you with knex",
                metadata: {
                    "attribute1": { "value": ["test value"]},
                    "attribute2": { "value": [1.0], "unit": ["s"]}
                },
                parentData: undefined,
                parentSample: undefined,
                parentSubject: 1
            };
            var errors = Validation.validateData(unformattedDateData);
            expect(errors).to.have.length(1);
            console.log(errors[0]);
            expect(errors[0]).to.have.string(Validation.INVALID_DATE);
        });

        it("should return an error message for date not valid", function() {
            var invalidTagsData = {
                type: 2,
                acquisitionDate: new Date(),
                tags: "tag",
                notes: "let me test you with knex",
                metadata: {
                    "attribute1": { "value": ["test value"]},
                    "attribute2": { "value": [1.0], "unit": ["s"]}
                },
                parentData: undefined,
                parentSample: undefined,
                parentSubject: 1
            };
            var errors = Validation.validateData(invalidTagsData);
            expect(errors).to.have.length(1);
            console.log(errors[0]);
            expect(errors[0]).to.have.string(Validation.INVALID_TAG);
            invalidTagsData.tags = {1: "tag", 2: "another tag"};
            errors = Validation.validateData(invalidTagsData);
            expect(errors).to.have.length(1);
            console.log(errors[0]);
            expect(errors[0]).to.have.string(Validation.INVALID_TAG);

        });
        
        it("should return an error message for missing and/or invalid metadata", function() {
            var invalidMetadataData = {
                type: 2,
                acquisitionDate: new Date(),
                tags: ["tag"],
                notes: "let me test you with knex",
                parentData: undefined,
                parentSample: undefined,
                parentSubject: 1
            };
            var errors = Validation.validateData(invalidMetadataData);
            expect(errors).to.have.length(2);
            console.log(errors[0]);
            expect(errors[0]).to.have.string(Validation.MISSING_METADATA);
            expect(errors[1]).to.have.string(Validation.INVALID_METADATA);
            invalidMetadataData.metadata = {};
            errors = Validation.validateData(invalidMetadataData);
            console.log(errors[0]);
            expect(errors).to.have.length(1);
            expect(errors[0]).to.have.string(Validation.MISSING_METADATA);
            invalidMetadataData.metadata = "metadata string";
            errors = Validation.validateData(invalidMetadataData);
            expect(errors).to.have.length(1);
            expect(errors[0]).to.have.string(Validation.INVALID_METADATA);
        });
    });

});

