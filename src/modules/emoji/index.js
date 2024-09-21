#!/usr/bin/env node

require("dotenv").config(); //dotenv file

const moment = require("moment-timezone");

const Misskey = require("./modules/misskey"); //export module
const MentionHandler = require("./src/mentionHandler");

const stream = new Misskey(process.env.URI, process.env.TOKEN); //login to bot(url, api key)

const VISIBILITY = ["public", "home", "followers", "specified"];

let emojis = []; //init emoji array
let isReconnect = false; //init reconnect flag
let timer = null;
let maxNoteTextLength = 7000;

const mentionHandler = new MentionHandler(stream, emojis);

console.log(`[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Bot Started`);

stream.on("ws:connected", async () => {
  //misskey ws connection
  console.log("Bot is ready");
  //if (!isReconnect) {
  //stream.send(
  //`絵文字追加通知Botが起動しました。\nuser ${stream.me?.name}(${stream.me?./username})`,
  //"public",
  //false
  //); //start up notify
  //}

  console.log(
    `[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Bot Connected`
  );

  console.log("---------- INFO ----------");
  console.log("Node.js:", process.version);
  console.log("inReconnect:", isReconnect);
  console.log("maxNoteTextLength:", maxNoteTextLength);
  console.log("---------- ---------------");

  isReconnect = false;
  const api = await stream.getEmojis(); //get emoji list from api
  emojis = api; //override emoji array
  mentionHandler.emoji(emojis);
  console.log(
    `[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Emojis Count: ${
      emojis.length
    }`
  );

  timer = setInterval(async () => await runner(), 3600000); // run every 15 minutes
});

stream.on("ws:disconnected", () => {
  console.log(
    `[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Bot Disconnected`
  );
  isReconnect = true;
  clearInterval(timer);
  reconnectHandler(); //reconnect handler
});

stream.on("mention", (msg) => {
  console.log(
    `[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Mention Handled by ${
      msg.body?.user?.username
    }`
  );
  mentionHandler.push(msg.body);
}); //mention handler

const getDifference = (arr1, arr2) =>
  arr2.filter((obj2) => !arr1.some((obj1) => obj2.url === obj1.url)); //diff function

async function runner() {
  console.log(
    `[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Runnner Started`
  );

  // ログで maxNoteTextLength を確認する
  console.log(`[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] maxNoteTextLength: ${maxNoteTextLength}`);

  // updater
  const api = await stream.getEmojis(); //get emoji list from api
  const old = emojis; //old emoji array

  emojis = api; //override emoji array
  mentionHandler.emoji(emojis);

  const diff = getDifference(old, emojis); //diff old/new emojis

  if (diff.length > 0) {
    //if diff length
    console.log(
      `[LOG - ${moment().format("yyyy-MM-DD hh:mm:ss")}] Emoji Added: ${
        diff.length
      }`
    );

    const added_emojis = diff.map(
      (emoji) =>
        `$[x2 :${emoji.name}:]\`:${emoji.name}:\` カテゴリ名：${emoji.category} ライセンス：${emoji.license}`
    ); //added emoji list

    const maxLengthSplited = splitArrayByMaxLength(
      added_emojis,
      maxNoteTextLength
    );

    let note = null;

    for (let index = 0; index < maxLengthSplited.length; index++) {
      const element = maxLengthSplited[index];
      const text = element.join("\n");

      note = note
        ? await note.reply(
            `${text}`,
            `絵文字が追加されたっぽいかも～(${index + 1}/${
              maxLengthSplited.length
            })`
          )
        : await stream.send(
            `${text}`,
            VISIBILITY[0],
            true,
            `絵文字が追加されたっぽいかも～(${index + 1}/${
              maxLengthSplited.length
            })`
          );
    }
  }
}

function reconnectHandler() {
  //reconnect handler
  console.log("[Bot] Reconnecting in 15sec...");
  setTimeout(async () => await stream.connect(), 15000); //reconnect to 15sec
}

function splitArrayByMaxLength(array, maxLength) {
  const result = [];
  let currentChunk = [];

  for (const str of array) {
    const currentLength = currentChunk.join("").length + str.length;

    if (currentLength <= maxLength) {
      currentChunk.push(str);
    } else {
      result.push(currentChunk);
      currentChunk = [str];
    }
  }

  if (currentChunk.length > 0) {
    result.push(currentChunk);
  }

  return result;
}

process.on("unhandledRejection", console.error); //error handler
process.on("uncaughtException", console.error); //error handler
