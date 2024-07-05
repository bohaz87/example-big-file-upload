// eslint-disable-next-line no-undef
importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js"
);
onmessage = (event) => {
  const slices = event.data;
  getHash(slices).then((hash) => {
    postMessage(hash);
  });
};

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
