/**
 * @param {File} file
 * @param {number} SliceSize
 */
function getSlice(file, sliceSize = 10 * 1024 * 1024) {
  const arr = [];
  let i = 0;
  while (i * sliceSize < file.size) {
    arr.push(file.slice(i * sliceSize, (i + 1) * sliceSize));
    i++;
  }
  return arr;
}

/**
 *
 * @param {Blob} fileSlice
 * @param {number} total
 * @param {number} idx
 * @param {string} name
 * @returns  {Promise<any>}
 */
function uploadSlice(
  fileSlice,
  { totalSlices, sliceIndex, fileName, fileHash }
) {
  const formData = new FormData();
  formData.append("name", fileName);
  formData.append("idx", sliceIndex);
  formData.append("total", totalSlices);
  formData.append("hash", fileHash);
  formData.append("file", fileSlice);
  return fetch("/upload", {
    method: "POST",
    body: formData,
  });
}

/**
 * @param {File} file
 * @param {number|boolean} concurrent
 */
async function upload(file) {
  let slices = getSlice(file);
  document.getElementById("loading").innerText = "正在计算Hash...";
  const hash = await getHash(slices);
  document.getElementById("loading").innerText = "正在检查文件...";
  const { exist, done, indexes, uri } = await checkFileExist(hash);
  if (exist && done) {
    console.log("file already exists, upload success");
    return;
  }
  document.getElementById("loading").innerText = "开始上传...";

  const total = slices.length;
  let start = 0;
  while (start < total) {
    if (indexes && indexes.includes(start)) {
      start++;
      continue;
    }

    await uploadSlice(slices[start], {
      totalSlices: total,
      sliceIndex: start,
      fileName: file.name,
      fileHash: hash,
    });
    // delay for 1 second
    // await new Promise((res) => setTimeout(res, ));
    start++;
  }
}

/**
 *  get hash for all slices
 * @param {Blob[]} slices
 */
function getHash(slices) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker("worker.js");
      worker.postMessage(slices);
      worker.onmessage = (e) => {
        resolve(e.data);
      };
    } catch (e) {
      reject(e);
    }
  });
}

async function checkFileExist(hash) {
  const data = await fetch(`/upload/exists?hash=${hash}`, {}).then((res) =>
    res.json()
  );

  return data;
}

window.onload = function () {
  const inputEl = document.getElementById("file");
  const loadingEl = document.getElementById("loading");

  inputEl.addEventListener("change", async (e) => {
    loadingEl.style.display = "block";
    const file = e.target.files[0];
    if (file) {
      try {
        await upload(file, 1);
      } catch (e) {
        console.log(e);
      } finally {
        loadingEl.style.display = "none";
      }
    }
  });
};
