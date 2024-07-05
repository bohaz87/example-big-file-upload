import koa from "koa";
import { default as serveStatic } from "koa-static";
import Router from "koa-router";
import fs from "fs";
import multiparty from "multiparty";
import path from "path";
import { promisify } from "util";

const __dirname = import.meta.dirname;
const uplaodFolder = path.join(__dirname, "upload/");
/**
 * Store file temp path
 * @type {Record<string, string[]>}
 */
let g_files = {};
/**
 * Store file hashes
 *
 * key is the file hash
 *
 * value is the file uri
 *
 * @type {Record<string, string>}
 */
let g_hashes = {};

const app = new koa();
const router = new Router();

app.use(serveStatic(path.join(__dirname, "public")));

router.get("/upload/exists", (ctx, _next) => {
  const hash = ctx.query.hash;
  if (hash in g_hashes) {
    ctx.body = { exist: true, uri: g_hashes[hash] };
  } else {
    ctx.body = { exist: false };
  }
});

router.post("/upload", (ctx) => {
  if (ctx.is("multipart/form-data")) {
    const form = new multiparty.Form();
    const { promise, resolve, reject } = Promise.withResolvers();
    form.parse(ctx.req, async (err, fields, files) => {
      if (err) {
        console.log(err);
        ctx.throw(500, "Parse request failed");
        reject();
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
      ctx.type = "json";
      ctx.body = {
        success: "true",
        url: `/files/${newFileName}`,
      };
      resolve();
    });
    return promise;
  } else {
    ctx.throw(405, "Method Not Allowed");
  }
});

const mkdir = promisify(fs.mkdir);
function ensureUploadFolderExists() {
  return mkdir(uplaodFolder, { recursive: true });
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
  const { promise, resolve, reject } = Promise.withResolvers();

  function pipeNextFile(index) {
    if (index >= fileList.length) {
      writeStream.end();
      resolve();
      return;
    }
    const readStream = fs.createReadStream(fileList[index]);
    readStream.pipe(writeStream, { end: false });
    readStream.on("end", () => {
      delete g_files[destFileName];
      pipeNextFile(index + 1);
    });
    readStream.on("error", (err) => {
      delete g_files[destFileName];
      reject(err);
    });
  }
  pipeNextFile(0);
  return promise;
}

app.on("error", (error) => {
  console.log(error);
});

app.use(router.routes());
app.listen(3000, () => {
  console.log("Server running at http://127.0.0.1:3000/");
});
