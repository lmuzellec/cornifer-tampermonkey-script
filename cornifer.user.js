// ==UserScript==
// @name         Cornifer for place
// @namespace    https://github.com/lmuzellec/cornifer-tampermonkey-script
// @version      1.0.0
// @description  try to take over r/place!
// @author       Louis Muzellec <github.com/lmuzellec>
// @match        https://hot-potato.reddit.com/embed*
// @match        https://www.reddit.com/r/place/*
// @match        https://new.reddit.com/r/place/*
// @connect      lmuzellec.dev
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @require	     https://cdn.jsdelivr.net/npm/toastify-js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// ==/UserScript==

var socket;
var iframe;

/**
 * Start the corresponding script when everything is loaded
 */
window.onload = () => {
  if (window.top !== window.self) {
    // iframe context
    mainFromIframe();
  } else {
    // parent context
    mainFromReddit();
  }
};

/**
 * =============== Scripts to be injected in reddit ===============
 */

/**
 * Main reddit side script
 */
function mainFromReddit() {
  console.log("Cornifer script loaded from reddit");

  // find r/place iframe
  iframe = document.querySelector(
    'iframe[src~="https://hot-potato.reddit.com/embed"]'
  );

  // connect to Cornifer-server
  connectSocket();
}

/**
 * Connect to Cornifer-server over websocket
 */
function connectSocket() {
  socket = new WebSocket("wss://lmuzellec.dev/ws");

  socket.onopen = () => {
    console.log("Connected to Cornifer");
  };

  socket.onmessage = (event) => {
    var data;

    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.log("Error parsing data");
      return;
    }

    switch (data.type) {
      case "message":
        console.log("Message from Cornifer: " + data.message);
        // send custom message to iframe
        iframe.contentWindow.postMessage(data.message, "*");
        break;
      default:
        break;
    }
  };

  socket.onclose = () => {
    console.log("Disconnected from Cornifer");
    socket.close();
    setTimeout(() => {
      connectSocket();
    }, 5000);
  };
}

/**
 * =============== Scripts to be injected in r/place iframe ===============
 */

/**
 * Main iframe side script
 */
function mainFromIframe() {
  console.log("Cornifer script loaded from iframe");

  // listen to custom messages from reddit
  window.onmessage = function (e) {
    if (e.data == "hello") {
      alert("Hello from server!");
    }
  };
}
