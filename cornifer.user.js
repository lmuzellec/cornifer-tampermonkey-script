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

  // inject toastify css
  GM_addStyle(GM_getResourceText("TOASTIFY_CSS"));

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

  /**
   * Send a message to Cornifer-server
   * @param {string} type
   * @param {any} data
   */
  const sendToSocket = (type, data) => {
    socket.send(JSON.stringify({ type, data }));
  };

  socket.onopen = () => {
    showToast("Connected to server");
  };

  /**
   * Handle messages from Cornifer-server
   * @param {MessageEvent<string>} event
   * @returns
   */
  socket.onmessage = (event) => {
    /**
     * @type {{type: string, data: any}}
     */
    var message;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      console.error("Invalid JSON from Cornifer");
      return;
    }

    if (!message.type) {
      console.error("No type in message from Cornifer");
      return;
    }

    switch (message.type) {
      case "message":
        console.log("Message from Cornifer: " + message.data);
        // send custom message to iframe
        iframe.contentWindow.postMessage(message.data, "*");
        break;
      case "pong":
        console.debug("Pong from Cornifer");
        break;
      case "error":
        console.error("Error from Cornifer: " + message.data);
        break;
      default:
        console.error("Unknown message from Cornifer");
        break;
    }
  };

  socket.onclose = () => {
    showToastError("Disconnected from Cornifer, retrying in 5s");
    socket.close();
    setTimeout(() => {
      connectSocket();
    }, 5000);
  };

  setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) sendToSocket("ping");
  }, 30000);
}

/**
 * Show a toast message in reddit
 * @param {string} text
 */
function showToast(
  text,
  duration = 5000,
  color = "#000",
  backgroundColor = "#0f0"
) {
  Toastify({
    text,
    duration,
    style: {
      color,
      background: backgroundColor,
    },
  }).showToast();
}

function showToastError(text, duration = 5000) {
  showToast(text, duration, "#fff", "#f00");
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
