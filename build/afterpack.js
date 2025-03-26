const fs = require('fs');
const download = require('electron-download');
const JSZip = require('jszip'); // the one with easier renaming...
const AdmZip = require('adm-zip'); // and the one with synchronous file reading

const defaultdir = './dist/win-ia32-unpacked/resources/default_app'
const exefile = './dist/win-ia32-unpacked/OpenWildSkiesClient.exe'
const macfile = './dist/OpenWildSkiesClient-1.0.0-x64-mac.zip';
const resources = './dist/win-ia32-unpacked/resources/';
const license = './dist/win-ia32-unpacked/LICENSE.md';
const macicon = './build/icon.icns';
const unitylicense = './build/utils/LICENSE.WEBPLAYER.md';
const unity3xxmac = './build/Unity Web Player.plugin.zip';

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
              zip.file('Electron.app/Contents/Resources/plugins/' + fileObject.entryName, fileObject.getData(), {createFolders: true, unixPermissions: fileObject.attr});
            }
          });

          zip
            .file('Electron.app/Contents/Info.plist', data
              .replace("<key>CFBundleDisplayName</key>\n\t<string>Electron</string>", "<key>CFBundleDisplayName</key>\n\t<string>OpenWildSkiesClient</string>")
              .replace("<key>CFBundleExecutable</key>\n\t<string>Electron</string>", "<key>CFBundleExecutable</key>\n\t<string>OpenWildSkiesClient</string>")
              .replace("<key>CFBundleName</key>\n\t<string>Electron</string>", "<key>CFBundleName</key>\n\t<string>OpenWildSkiesClient</string>")
              .replace("<key>CFBundleIdentifier</key>\n\t<string>com.github.electron</string>", "<key>CFBundleIdentifier</key>\n\t<string>xyz.openwildskies.client</string>")
              .replace("<key>CFBundleIconFile</key>\n\t<string>atom.icns</string>", "<key>CFBundleIconFile</key>\n\t<string>wildskies.icns</string>")
            )
            .file("LICENSE.WEBPLAYER.md", fs.readFileSync(unitylicense))
            .file("Electron.app/Contents/Resources/wildskies.icns", fs.readFileSync(macicon))
            .file("README.txt",
              'Before running OpenWildSkiesClient for the first time, Control-Click -> Open OpenWildSkiesClient and open it to remove its signature warning.\n' +
              'If that does not work, run the following command in this directory in Terminal:\n' +
              '\txattr -r -d com.apple.quarantine OpenWildSkiesClient.app\n\n' +

              'After that is completed, you may move OpenWildSkiesClient wherever you wish (like Applications) and discard the rest of the files.\n'
            );

          fs.readdirSync(resources, {recursive: true}).forEach(filename => {
            if (!fs.lstatSync(resources + filename).isDirectory() && filename != "atom.asar" && filename != "elevate.exe") {
              zip.file("Electron.app/Contents/Resources/" + filename.replaceAll("\\", "/"), fs.readFileSync(resources + filename), {createFolders: true});
            }
          });

          zip
            .remove("version")
            .remove("Electron.app/Contents/Resources/atom.icns")
            .remove("Electron.app/Contents/Resources/default_app");

          renameSingle(zip, "Electron.app/Contents/MacOS/Electron", "Electron.app/Contents/MacOS/OpenWildSkiesClient");
          renameSingle(zip, "LICENSE", "LICENSE.electron.txt");
          renameFolder(zip, "Electron.app", "OpenWildSkiesClient.app");

          zip
            .generateNodeStream({compression: 'DEFLATE', type: 'nodebuffer', streamFiles: 'true', platform: 'UNIX'})
            .pipe(fs.createWriteStream(macfile))
            .on('finish', function () {
              // now we need to pack the zip in another zip to bypass a Safari bug
              new JSZip().file('OpenWildSkiesClient-1.0.0-x64-mac.zip', fs.readFileSync(macfile)).file("LICENSE.md", fs.readFileSync(license))
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
