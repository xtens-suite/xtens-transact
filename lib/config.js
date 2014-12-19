var IrodsRestStrategy = require('xtens-fs').IrodsRestStrategy;
var FileSystemManager = require('xtens-fs').FileSystemManager;

/**
 *  @description XTENS-transact configuration parameters
 */
module.exports = {
    
    fileSystemManager: new FileSystemManager(new IrodsRestStrategy)

}
