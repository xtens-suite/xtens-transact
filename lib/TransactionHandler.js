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
    }

};

module.exports = TransactionHandler;
