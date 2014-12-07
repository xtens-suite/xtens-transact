/*
 * @author Massimiliano Izzo
 * @description this handler works as a context for the transaction strategy
 *  
 */

function TransactionHandler(connection, strategy) {

}

TransactionHandler.prototype = {
    
    setStrategy: function(strategy) {
        this.strategy = strategy;
    }

};

module.exports = TransactionHandler;
