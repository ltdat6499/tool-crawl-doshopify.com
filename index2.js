require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");
const _ = require("lodash");
const { stringify } = require("querystring");
const { forEach } = require("lodash");
const csvWriter = require("csv-write-stream");
var writer = csvWriter({ sendHeaders: false });
var csvFilename = __dirname + "/dev.csv";

const env = process.env;

let pageIndex = 0;

const tranformObj = (obj) => {
  let newObj = {};
  for (let key in obj) {
    let newKey = key
      .replace(/\n\s+/g, " ")
      .replace(/\t+|\n+|\r\n+/g, "")
      .trim();
    newKey = _.snakeCase(newKey);
    newObj[newKey] = obj[key];
  }
  return newObj;
};
(async () => {
  if (!fs.existsSync(csvFilename)) {
    writer = csvWriter({ sendHeaders: false });
    writer.pipe(fs.createWriteStream(csvFilename));
    writer.write({
      header1: "id",
      header2: "data",
    });
    writer.end();
  }
  let itemIndex = 0;
  let idx = 0;

  do {
    const res = await axios.get(
      `https://doshopify.com/product-personalizer/personalized.php?from=${idx}`,
      {
        headers: {
          Cookie: env.COOKIE,
        },
      }
    );
    const data = res.data.toString();
    const start = data.indexOf(
      `<tr ><td class="prr"><input type="checkbox" class="pdelete"`
    );
    const end = data.lastIndexOf(`Apply To</a></td></tr>`);
    const str = data.substring(start, end);

    if (!str) {
      return;
    }
    const links = str.match(/id=+\d+&shop_r=1sttheworld.myshopify.com/gi);
    for (const item of links) {
      const resl = await axios.get(
        `https://doshopify.com/product-personalizer/manage.php?${item}`,
        {
          headers: {
            Cookie: env.COOKIE,
          },
        }
      );
      const dt = resl.data.toString();
      const $ = cheerio.load(dt);
      const id = item.match(/\d+/g)[0];

      let dataCrawl = [];
      let tabs = {};
      let tabIndex = 1;
      $("div.tab-pane").each(async (i, context) => {
        tabs = {};
        $(context)
          .find(".form-group")
          .each((i, subContext) => {
            const label = $(subContext).find("label").text();
            if (!label) return;
            let itemData = "";
            const option = $(subContext).find(`option[selected]`).text();
            if (option) {
              if (option.match(/.png|.jpg|.jpeg/g)) {
                itemData = `https://doshopify.com/product-personalizer/${$(
                  subContext
                )
                  .find(`option`)
                  .val()}`;
              } else {
                itemData = option;
              }
            } else {
              const op = $(subContext).find(`option`).val();
              if (op) {
                itemData = op;
              }
            }
            const textarea = $(subContext).find("textarea").val();
            if (textarea) {
              itemData = textarea;
            }
            const input = $(subContext).find("input").val();
            if (input) {
              itemData = input;
            }
            tabs[label] = itemData.trim();
          });
        await dataCrawl.push(tranformObj(tabs));
        tabIndex++;
      });
      itemIndex++;

      writer = csvWriter({ sendHeaders: false });
      writer.pipe(fs.createWriteStream(csvFilename, { flags: "a" }));
      writer.write({
        header1: id,
        header2: JSON.stringify(dataCrawl),
      });
      writer.end();
      console.log("CRAWL " + pageIndex);
      pageIndex++;
    }
    idx += 20;
  } while (idx > -1);
  writer.end();
})();
