'use strict';

const functions = require('firebase-functions');
const mkdirp = require('mkdirp-promise');
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const PNG_EXTENSION = '.png';

exports.imageToPNG = functions.storage.object().onChange(event => {

    const object = event.data;
    const filePath = object.name;
    const baseFileName = path.basename(filePath, path.extname(filePath));
    const fileDir = path.dirname(filePath);
    const PNGFilePath = path.normalize(path.format({dir: fileDir, name: baseFileName, ext: PNG_EXTENSION}));
    const tempLocalFile = path.join(os.tmpdir(), filePath);
    const tempLocalDir = path.dirname(tempLocalFile);
    const tempLocalPNGFile = path.join(os.tmpdir(), PNGFilePath);
  
    // Verifica si el elemento subido al Storage es una imagen.
    if (!object.contentType.startsWith('image/')) {
      console.log('No es imagen.');
      return;
    }
  
    // Verifica si la imagen ya es un PNG.
    if (object.contentType.startsWith('image/png')){
      console.log('Es un PNG.');
      return;
    }
  
    // El evento se activo por un borrado o movida del elemento.
    if (object.resourceState === 'not_exists') {
      console.log('El elemento fue borrado.');
      return;
    }
  
    const bucket = gcs.bucket(object.bucket);
    // Crea una ruta temporal donde el archivo sera guardado temporalmente.
    return mkdirp(tempLocalDir).then(() => {
      // Descarga un archivo desde el bucket.
      return bucket.file(filePath).download({destination: tempLocalFile});
    }).then(() => {
      console.log('El archivo ha sido descargado a',
          tempLocalFile);
      // convierte la imagen a PNG usando ImageMagic
      return spawn('convert', [tempLocalFile, tempLocalPNGFile]);
    }).then(() => {
      console.log('La imagen en PNG ha sido creada ', tempLocalPNGFile);
      // Subiendo la imagen PNG
      return bucket.upload(tempLocalPNGFile, {destination: PNGFilePath});
    }).then(() => {
      console.log('imagen nueva subida a ', PNGFilePath);
      // Liberamos el espacio de los archivos temporales.
      fs.unlinkSync(tempLocalPNGFile);
      fs.unlinkSync(tempLocalFile);
    });
  });
  