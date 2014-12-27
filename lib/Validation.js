var validator = require("validator");
var _ = require("lodash");

function Validation() {}

Validation.validateData = function(data) {

    var errors = [];
    if (!validator.isInt(data.type)) {
        errors.push("Data Type ID is not a valid integer: " + data.type);
    }
    if (data.acquisitionDate && !validator.isDate(data.acquisitionDate)) {
        errors.push("Acquisition Date is not a valid date: " + data.acquisitionDate);
    }
    if (data.tags && !_.isArray(data.tags)) {
        errors.push("Tags is not a valid array: " + data.tags);
    }
    if (!data.metadata || _.isEmpty(data.metadata)) {
        errors.push("Metadata are missing (null or empty).");
    }
    if (!validator.isJSON(JSON.stringify(data.metadata))) {
        errors.push("Metadata is not a valid JSON: " + data.metadata);
    }
    if (data.parentSubject && !validator.isInt(data.parentSubject)) {
        errors.push("Parent Subject ID is not a valid integer: " + data.parentSubject);
    }
    if (data.parentSample && !validator.isInt(data.parentSample)) {
        errors.push("Parent Sample ID is not a valid integer: " + data.parentSample);
    }
    if (data.parentData && !validator.isInt(data.parentData)) {
        errors.push("Parent Data ID is not a valid integer: " + data.parentData);
    }
    return errors.length ? errors : null;


};
module.exports = Validation; 
