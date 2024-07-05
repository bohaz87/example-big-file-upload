/**
 * @param {File} file
 * @param {number} SliceSize
 */
function getSlice(file, sliceSize = 50 * 1024 * 1024) {
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
async function upload(file, concurrent = false) {
  const slices = getSlice(file);
  if (concurrent === false) {
    concurrent = 1;
  } else if (concurrent === true) {
    concurrent = slices.length;
  }

  const hash = await getHash(slices);
  const { exist, uri } = await checkFileExist(hash);
  if (exist) {
    console.log("file already exsits, upload success");
    return;
  }

  const total = slices.length;
  let start = 0;
  while (start <= total) {
    await Promise.all(
      slices.slice(start, start + concurrent).map((blob, idx) =>
        uploadSlice(blob, {
          totalSlices: total,
          sliceIndex: start + idx,
          fileName: file.name,
          fileHash: hash,
        })
      )
    );
    start += concurrent;
  }
}

/**
 *  get hash for all slices
 * @param {Blob[]} slices
 */
function getHash(slices) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const fileReader = new FileReader();
  const spark = new SparkMD5.ArrayBuffer();
  let currentChunk = 0;

  fileReader.onload = function (e) {
    console.log("read chunk nr", currentChunk + 1, "of", slices.length);
    spark.append(e.target.result); // Append array buffer
    currentChunk++;

    if (currentChunk < slices.length) {
      loadNext();
    } else {
      console.log("finished loading");
      const hash = spark.end();
      console.info("computed hash", hash); // Compute hash
      resolve(hash);
    }
  };

  fileReader.onerror = function (err) {
    console.err("oops, something went wrong.");
    reject(err);
  };

  function loadNext() {
    fileReader.readAsArrayBuffer(slices[currentChunk]);
  }

  loadNext();
  return promise;
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
