/**
 * @author Massimiliano Izzo
 * @description this handler works as a context for the transaction strategy
 *  
 */
var KnexStrategy = require("./KnexStrategy.js");

function TransactionHandler(strategy, connection, fileSystemConnection) {
    if (!strategy) {
        strategy = new KnexStrategy(connection, fileSystemConnection);
    }
    this.setStrategy(strategy);    
}

TransactionHandler.prototype = {
    
    setStrategy: function(strategy) {
        this.strategy = strategy;
    },

    createDataType: function(dataType) {
        return this.strategy.createDataType(dataType);
    },

    updateDataType: function(dataType) {
        return this.strategy.updateDataType(dataType);
    },

    createData: function(data, dataTypeName) {
        return this.strategy.createData(data, dataTypeName);
    },

    updateData: function(data) {
        return this.strategy.updateData(data);
    },

    createSample: function(sample, sampleTypeName) {
        return this.strategy.createSample(sample, sampleTypeName);
    },

    updateSample: function(sample) {
        return this.strategy.updateSample(sample);
    },

    createSubject: function(subject, subjectTypeName) {
        return this.strategy.createSubject(subject, subjectTypeName);
    },

    updateSubject: function(subject) {
        return this.strategy.updateSubject(subject);
    },

    putMetadataFieldsIntoEAV: function(idDataType, metadataField) {
        return this.strategy.putMetadataFieldsIntoEAV(idDataType, metadataField);
    },

    putMetadataValuesIntoEAV: function(data, eavValueTableMap) {
        console.log("TransactionHandler.putMetadataValuesIntoEAV - here we are! " + data.id);
        return this.strategy.putMetadataValuesIntoEAV(data, eavValueTableMap);
    }

};

module.exports = TransactionHandler;
