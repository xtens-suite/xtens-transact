var validator = require("validator");
var _ = require("lodash");

function Validation() {}

Validation.INVALID_DATA_ID = "Data Type ID is not a valid integer: ";
Validation.INVALID_DATE = "Acquisition Date is not a valid date: ";
Validation.INVALID_TAG = "Tags is not a valid array: ";
Validation.MISSING_METADATA = "Metadata are missing (null or empty)";
Validation.INVALID_METADATA = "Metadata is not a valid JSON: ";
Validation.INVALID_PARENT_SUBJECT_ID = "Parent Subject ID is not a valid integer: ";
Validation.INVALID_PARENT_SAMPLE_ID = "Parent Sample ID is not a valid integer: ";
Validation.INVALID_PARENT_DATA_ID = "Parent Data ID is not a valid integer: ";

Validation.MISSING_BIOBANK_CODE = "Biobank Code is missing for sample";
Validation.INVALID_DONOR = "Sample Donor ID is not a valid integer: ";
Validation.MISSING_BIOBANK_ID = "Biobank ID is not a valid integer: ";


/**
 * @description Utility function for Data instance validation
 */
Validation.validateData = function(data) {

    var errors = [];
    if (!validator.isInt(data.type)) {
        errors.push(Validation.INVALID_DATA_ID + data.type);
    }
    if (data.date && !validator.isDate(data.date)) {
        errors.push(Validation.INVALID_DATE + data.date);
    }
    if (data.tags && !_.isArray(data.tags)) {
        errors.push(Validation.INVALID_TAG + data.tags);
    }
    if (!data.metadata || _.isEmpty(data.metadata)) {
        errors.push(Validation.MISSING_METADATA);
    }
    if (!validator.isJSON(JSON.stringify(data.metadata)) || !_.isObject(data.metadata)) {
        errors.push(Validation.INVALID_METADATA + data.metadata);
    }
    if (data.parentSubject && !validator.isInt(data.parentSubject)) {
        errors.push(Validation.INVALID_PARENT_SUBJECT_ID + data.parentSubject);
    }
    if (data.parentSample && !validator.isInt(data.parentSample)) {
        errors.push(Validation.INVALID_PARENT_SAMPLE_ID + data.parentSample);
    }
    if (data.parentData && !validator.isInt(data.parentData)) {
        errors.push(Validation.INVALID_PARENT_DATA_ID + data.parentData);
    }
    return errors.length ? errors : null;

};

/**
 * @description Sample instance validation
 */
Validation.validateSample = function(sample) {

    var errors = [];

    if (!sample.biobankCode) {
        errors.push(Validation.MISSING_BIOBANK_CODE);
    }
    if (!sample.metadata || _.isEmpty(sample.metadata)) {
        errors.push(Validation.MISSING_METADATA);
    }
    if (!validator.isJSON(JSON.stringify(sample.metadata)) || !_.isObject(sample.metadata)) {
        errors.push(Validation.INVALID_METADATA + data.metadata);
    }
    if (sample.biobank && !validator.isInt(sample.biobank)) {
        errors.push(Validation.INVALID_BIOBANK_ID + sample.biobank);
    }
    if (sample.donor && !validator.isInt(sample.donor)) {
        errors.push(Validation.INVALID_DONOR_ID + data.parentSubject);
    }
    if (sample.parentSample && !validator.isInt(sample.parentSample)) {
        errors.push(Validation.INVALID_PARENT_SAMPLE_ID + data.parentSample);
    }

    return errors.length ? errors : null;

};

module.exports = Validation; 
