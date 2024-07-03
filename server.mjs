import http from "http";
import fs from "fs";
import multiparty from "multiparty";
import path from "path";
import { promisify } from "util";

const __dirname = import.meta.dirname;
/**
 * Store file temp path
 * @type {Record<string, string[]>}
 */
let g_files = {};
let g_hashes = {};

http
  .createServer((req, res) => {
    console.log("req.url", req.url);

    if (req.url === "/" || req.url.startsWith("/public")) {
      return staticHandler(req, res);
    } else if (/^\/upload\/exists/.test(req.url) && req.method === "GET") {
      return checkFileExistHandler(req, res);
    } else if (/^\/upload/.test(req.url) && req.method === "POST") {
      return uploadHandler(req, res);
    } else {
      return notFoundHandler(req, res);
    }
  })
  .listen(3000, () => {
    console.log("Server running at http://127.0.0.1:3000/");
  });

/**
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function notFoundHandler(req, res) {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.write("Not Found");
  res.end();
}

function staticHandler(req, res) {
  let filename = req.url;
  if (filename === "/") {
    filename = "/public/index.html";
  }
  const file = path.join(__dirname, filename);
  fs.readFile(file, (err, data) => {
    if (err) {
      return notFoundHandler(req, res);
    }
    res.writeHead(200);
    res.write(data);
    res.end();
  });
}

/**
 *
 * @param {string} uri
 */
function getSearchParams(uri) {
  const params = {};
  const query = uri.split("?")[1];
  query.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    params[key] = value;
  });
  return params;
}

/**
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function checkFileExistHandler(req, res) {
  const params = getSearchParams(req.url);
  const hash = params.hash;
  if (hash in g_hashes) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify({ exist: true, uri: g_hashes[hash] }));
    res.end();
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify({ exist: false }));
    res.end();
  }
}

function uploadHandler(req, res) {
  if (
    req.method === "POST" &&
    req.headers["content-type"].startsWith("multipart/form-data")
  ) {
    const form = new multiparty.Form();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.log(err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        return;
      }

      const name = fields.name[0];
      const idx = Number(fields.idx[0]);
      const total = Number(fields.total[0]);
      const hash = fields.hash[0];
      g_files[name] ??= Array(total);
      g_files[name][idx] = files.file[0].path;
      const newFileName = hash + path.extname(name);
      g_hashes[hash] = path.join("/files/", newFileName);

      if (idx === total - 1) {
        await joinFileWithStream(g_files[name], newFileName);
      }
      // Process fields and files
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: "true",
          url: `/files/${newFileName}`,
        })
      );
    });
  } else {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
  }
}

const uplaodFolder = path.join(__dirname, "upload/");

const mkdir = promisify(fs.mkdir);
async function ensureUploadFolderExists() {
  try {
    await mkdir(uplaodFolder, { recursive: true });
  } catch (e) {
    console.log(e);
  }
}

/**
 *
 * @param {string[]} fileList
 * @param {string} destFileName
 */
async function joinFileWithStream(fileList, destFileName) {
  await ensureUploadFolderExists();
  const destFile = path.join(uplaodFolder, destFileName);
  const writeStream = fs.createWriteStream(destFile);

  function pipeNextFile(index) {
    if (index >= fileList.length) {
      writeStream.end();
      console.log("files have been joined successfullly");
      return;
    }
    const readStream = fs.createReadStream(fileList[index]);
    readStream.pipe(writeStream, { end: false });
    readStream.on("end", () => {
      delete g_files[destFileName];
      pipeNextFile(index + 1);
    });
  }
  pipeNextFile(0);
}
