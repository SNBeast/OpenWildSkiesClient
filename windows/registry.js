'use strict'

module.exports = {
    modifyRegistry: modifyRegistry
}

var path = require('path')
var child_process = require('child_process')

var WILDSKIES_REGISTRY_PATH = 'HKCU\\Software\\HTTYD\\WildSkies'
var KEY = 'Directory'
var TYPE = 'REG_SZ'

function modifyRegistry () {
    if (process.platform !== 'win32') {
        return {
            success: true,
            errorMessage: ''
        }
    }
    // create the entry, overwriting if necessary
    var pluginDirectory = path.join(__dirname, 'WebPlayer')
    var res = child_process.spawnSync('reg', ['add', WILDSKIES_REGISTRY_PATH, '/f', '/v', KEY, '/t', TYPE, '/d', pluginDirectory])
    return {
        success: res.status === 0,
        errorMessage: res.stderr ? res.stderr.toString() : 'No message on stderr'
    }
}
