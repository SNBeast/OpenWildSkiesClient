var app = require("app"); // Module to control application life.
var fs = require("fs-extra");
var os = require("os");
var dialog = require("dialog");
var BrowserWindow = require("browser-window");
var ChildProcess = require("child_process");
var shell = require("shell");
var path = require('path')

var mainWindow = null;
var initialPageLoad = false;

app.commandLine.appendSwitch("--enable-npapi");

function ensureUnity(callback) {
    if (process.platform == "win32") {
        var utilsdir = process.env.npm_node_execpath
            ? app.getAppPath() + "\\build\\utils"
            : __dirname + "\\..\\..\\utils";

        // verify
        var dllpath =
            app.getPath("appData") +
            "\\..\\LocalLow\\Unity\\WebPlayer\\player\\3.x.x\\webplayer_win.dll";

        if (fs.existsSync(dllpath)) {
            var buff = fs.readFileSync(dllpath);
            var hash = require("crypto")
                .createHash("md5")
                .update(buff)
                .digest("hex");
            if (hash == "33ffd00503b206260b0c273baf7e122e") {
                return callback(); // it's here, no need to install
            }
        }

        // run the installer silently
        var child = ChildProcess.spawn(utilsdir + "\\UnityWebPlayer.exe", [
            "/quiet",
            "/S",
        ]);
        child.on("exit", function () {
            console.log("Unity Web Player installed successfully.");
            return callback();
        });
    } else if (process.platform == "darwin") {
        // We just bundle in the plugin.
        return callback();
    } else {
        // Unity Web Player doesn't support other platforms, so good luck!
        return callback();
    }
}

// Quit when all windows are closed.
app.on("window-all-closed", function () {
    if (process.platform != "darwin") app.quit();
});

app.on("ready", function () {
    var prefs = { 'plugins': true, 'extra-plugin-dirs': [path.join(__dirname, "plugins")] };

    if (process.platform != "darwin") {
        // Check just in case the user forgot to extract the zip.
        zip_check = app.getPath("exe").includes(os.tmpdir());
        if (zip_check) {
            errormsg =
                "It has been detected that OpenWildSkiesClient is running from the TEMP folder.\n\n" +
                "Please extract the entire Client folder to a location of your choice before starting OpenWildSkiesClient.";
            dialog.showErrorBox("Error!", errormsg);
            return;
        }
    }

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: process.platform == "darwin" ? 900 : 906,
        height: process.platform == "darwin" ? 622 : 629,
        show: false,
        "web-preferences": prefs,
    });
    mainWindow.setMinimumSize(640, 480);

    ensureUnity(showMainWindow);

    mainWindow.on("closed", function () {
        mainWindow = null;
    });
});

function showMainWindow() {
    mainWindow.loadUrl("file://" + __dirname + "/client/index.html#" + encodeURIComponent(app.getPath("userData")));

    // Reduces white flash when opening the program
    mainWindow.webContents.on("did-finish-load", function () {
        mainWindow.show();
        //mainWindow.webContents.openDevTools()
    });

    mainWindow.webContents.on("plugin-crashed", function () {
        dialog.showErrorBox(
            "Error!",
            "Unity Web Player has crashed. Please re-open the application."
        );
        mainWindow.destroy();
        app.quit();
    });

    mainWindow.webContents.on("will-navigate", function (evt, url) {
        evt.preventDefault();

        if (!url.startsWith(config["game-url"])) {
            shell.openExternal(url);
        } else {
            mainWindow.loadUrl(url);
            initialPageLoad = true;
        }
    });

    mainWindow.webContents.on("did-fail-load", function () {
        if (!initialPageLoad) {
            dialog.showErrorBox(
                "Error!",
                "Could not load page."
            );
            mainWindow.destroy();
            app.quit();
        }
    });
}
