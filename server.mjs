import http from "http";
import fs from "fs";
import multiparty from "multiparty";
import path from "path";
import { promisify } from "util";

const __dirname = import.meta.dirname;

http
  .createServer((req, res) => {
    console.log(req.url);
    if (req.url === "/") {
      fs.readFile("./public/index.html", (err, data) => {
        if (err) {
          res.writeHead(500, String(err));
          res.end();
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write(data);
        res.end();
      });
    } else if (req.url === "/upload") {
      return handleUpload(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.write("Not Found");
      res.end();
    }
  })
  .listen(3000, () => {
    console.log("Server running at http://127.0.0.1:3000/");
  });

let g_fields = {};
function handleUpload(req, res) {
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
      if (idx === 0) {
        g_fields[name] = Array(total);
        g_fields[name][idx] = files.file[0].path;
      } else {
        g_fields[name][idx] = files.file[0].path;
      }

      console.log(g_fields);

      if (idx === total - 1) {
        await joinFileWithStream(g_fields[name], name);
      }
      // Process fields and files
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: "true" }));
    });
    // let data = "";

    // // Collect data chunks
    // req.on("data", (chunk) => {
    //   data += chunk;
    // });

    // req.on("end", () => {
    //   // Parse the multipart/form-data
    //   console.log(data);
    //   res.writeHead(200, { "Content-Type": "application/json" });
    //   res.end(JSON.stringify({ success: "true" }));
    // });
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
    console.log(fileList.length, index);
    const readStream = fs.createReadStream(fileList[index]);
    readStream.pipe(writeStream, { end: false });
    readStream.on("end", () => {
      delete g_fields[destFileName];
      pipeNextFile(index + 1);
    });
  }
  pipeNextFile(0);
}
