const fs = require('fs');
const download = require('electron-download');
const JSZip = require('jszip'); // the one with easier renaming...
const AdmZip = require('adm-zip'); // and the one with synchronous file reading

const defaultdir = './dist/win-ia32-unpacked/resources/default_app'
const exefile = './dist/win-ia32-unpacked/OpenATBPClient.exe'
const macfile = './dist/OpenATBPClient-1.0.0-x64-mac.zip';
const resources = './dist/win-ia32-unpacked/resources/';
const license = './dist/win-ia32-unpacked/LICENSE.md';
const unityinstaller = './build/webplayer-mini.dmg';
const macicon = './build/icon.icns';
const unitylicense = './build/utils/LICENSE.WEBPLAYER.md';
const unity3xxmac = './build/UnityPlayer3.x.x-x86_64.bundle.zip';

exports.default = function() {
  // remove leftover files from default electron app
  fs.rm(defaultdir, { recursive: true }, (err) => {
    if (err) {
        throw err;
    }
  });
  // patch executable for large address awareness
  fs.open(exefile, "r+", (err, fd) => {
    if(!err) {
        fs.write(
            fd, new Uint8Array([0x22]), 0, 1, 0x166,
            (err) => {
                if(err) {
                    throw err;
                }
                fs.closeSync(fd);
            }
        );
    } else {
        throw err;
    }
  });

  // code from here is our Mac build process

  // the raw way to do a rename, because there's nothing better
  const renameSingle = function (zip, oldPath, newPath) {
    zip.files[oldPath].name = newPath;
    zip.files[oldPath].unsafeOriginalName = newPath;
    zip.files[newPath] = zip.files[oldPath];
    delete zip.files[oldPath];
  };

  const renameFolder = function (zip, oldPath, newPath) {
    if (oldPath.slice(-1) !== "/") {
      oldPath += "/";
    }
    if (newPath.slice(-1) !== "/") {
      newPath += "/";
    }
    zip.filter((_relPath, fileObject) => fileObject.name.slice(0, oldPath.length) === oldPath)
      .forEach(fileObject => renameSingle(zip, fileObject.name, fileObject.name.replace(oldPath, newPath)));
  };

  download({
    version: '0.28.3',
    arch: 'x64',
    platform: 'darwin'
  }, (err, originalZipPath) => {
    if (!err) {
      fs.copyFileSync(originalZipPath, macfile);
      JSZip.loadAsync(fs.readFileSync(macfile)).then(function (zip) {
        zip.file('Electron.app/Contents/Info.plist').async("string").then(function (data) {
          var unityZip = new AdmZip(unity3xxmac);
          unityZip.forEach(fileObject => {
            if (!fileObject.isDirectory) {
              zip.file('Electron.app/Contents/Resources/Stable' + fileObject.entryName, fileObject.getData(), {createFolders: true, unixPermissions: fileObject.attr});
            }
          });

          zip
            .file('Electron.app/Contents/Info.plist', data
              .replace("<key>CFBundleDisplayName</key>\n\t<string>Electron</string>", "<key>CFBundleDisplayName</key>\n\t<string>OpenATBPClient</string>")
              .replace("<key>CFBundleExecutable</key>\n\t<string>Electron</string>", "<key>CFBundleExecutable</key>\n\t<string>OpenATBPClient</string>")
              .replace("<key>CFBundleName</key>\n\t<string>Electron</string>", "<key>CFBundleName</key>\n\t<string>OpenATBPClient</string>")
              .replace("<key>CFBundleIdentifier</key>\n\t<string>com.github.electron</string>", "<key>CFBundleIdentifier</key>\n\t<string>xyz.openatbp.client</string>")
              .replace("<key>CFBundleIconFile</key>\n\t<string>atom.icns</string>", "<key>CFBundleIconFile</key>\n\t<string>atbp-bee.icns</string>")
            )
            .file("webplayer-mini.dmg", fs.readFileSync(unityinstaller))
            .file("LICENSE.WEBPLAYER.md", fs.readFileSync(unitylicense))
            .file("Electron.app/Contents/Resources/atbp-bee.icns", fs.readFileSync(macicon))
            .file("README.txt",
              'Before running OpenATBPClient for the first time, the following two things should be done:\n' +
              '\t1. Install the bundled Unity Web Player (webplayer-mini.dmg), if Unity Web Player is not already installed. (If unsure, OpenATBPClient will tell you if it is not installed.)\n' +
              '\t2. Control-Click -> Open OpenATBPClient and open it to remove its signature warning.\n' +
              '\t\t- If that does not work, run the following command in this directory in Terminal:\n' +
              '\t\t\txattr -r -d com.apple.quarantine OpenATBPClient.app\n\n' +

              'After those are completed, you may move OpenATBPClient wherever you wish (like Applications) and discard the rest of the files.\n'
            );

          fs.readdirSync(resources, {recursive: true}).forEach(filename => {
            if (!fs.lstatSync(resources + filename).isDirectory() && filename != "atom.asar" && filename != "elevate.exe") {
              zip.file("Electron.app/Contents/Resources/" + filename.replaceAll("\\", "/"), fs.readFileSync(resources + filename), {createFolders: true});
            }
          });

          zip
            .remove("version")
            .remove("Electron.app/Contents/Resources/atom.icns")
            .remove("Electron.app/Contents/Resources/default_app")
            .folder(/Electron\.app\/Contents\/Resources\/.*\.lproj/).forEach(fileObject => zip.remove(fileObject.name));

          renameSingle(zip, "Electron.app/Contents/MacOS/Electron", "Electron.app/Contents/MacOS/OpenATBPClient");
          renameSingle(zip, "LICENSE", "LICENSE.electron.txt");
          renameFolder(zip, "Electron.app", "OpenATBPClient.app");

          zip
            .generateNodeStream({compression: 'DEFLATE', type: 'nodebuffer', streamFiles: 'true', platform: 'UNIX'})
            .pipe(fs.createWriteStream(macfile))
            .on('finish', function () {
              // now we need to pack the zip in another zip to bypass a Safari bug
              new JSZip().file('OpenATBPClient-1.0.0-x64-mac.zip', fs.readFileSync(macfile)).file("LICENSE.md", fs.readFileSync(license))
                .generateNodeStream({compression: 'DEFLATE', type: 'nodebuffer', streamFiles: 'true', platform: 'UNIX'})
                .pipe(fs.createWriteStream(macfile))
                .on('finish', function () {
                  console.log("Created Darwin build.");
                });
            });
        });
      });
    } else {
      throw err;
    }
  });
}
