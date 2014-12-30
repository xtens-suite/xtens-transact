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

    createData: function(data, dataTypeName) {
        return this.strategy.createData(data, dataTypeName);
    },

    updateData: function(data) {
        return this.strategy.updateData(data);
    },

    createSample: function(sample, sampleTypeName) {
        return this.strategy.createSample(sample, sampleTypeName);
    },

    createSubject: function(subject, subjectTypeName) {
        return this.strategy.createSubject(subject, subjectTypeName);
    }

};

module.exports = TransactionHandler;
