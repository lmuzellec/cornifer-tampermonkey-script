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

/**
 * @type {WebSocket}
 */
var socket;
/**
 * @type {HTMLIFrameElement}
 */
var iframe;

/**
 * @type {boolean}
 */
var loadedLocalStorage = false;

/**
 * @type {number}
 */
var increasingTimeout = 1;

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
    'iframe[src*="https://hot-potato.reddit.com/embed"]'
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
   * @param {{type: string, data: any}} message
   */
  const sendToSocket = (message) => {
    socket.send(JSON.stringify(message));
  };

  socket.onopen = () => {
    showToast("Connected to server");
    sendToSocket({ type: "overlays" });
    increasingTimeout = 1;
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
        break;
      case "create":
        showToast("New Overlay created : " + message.data.id);
        iframe.contentWindow.postMessage(message, "*");
        break;
      case "update":
        showToast("Overlay updated : " + message.data.id);
        iframe.contentWindow.postMessage(message, "*");
        break;
      case "overlays":
        showToast("Overlays loaded");
        iframe.contentWindow.postMessage(message, "*");
        loadedLocalStorage = true;
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

  socket.onclose = (event) => {
    if (event.code !== 1000 && !loadedLocalStorage) {
      iframe.contentWindow.postMessage({ type: "loadLocal" }, "*");
      loadedLocalStorage = true;
    }
    showToastError(
      `Disconnected from Cornifer, retrying in ${5 * increasingTimeout}s`
    );
    setTimeout(() => {
      connectSocket();
    }, 5000 * increasingTimeout);
    increasingTimeout = Math.min(increasingTimeout + 1, 12);
  };

  setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN)
      sendToSocket({ type: "ping" });
  }, 30000);

  /**
   * Handle messages from iframe
   * @param {MessageEvent<{type: string, data: any}>} event
   * @returns
   */
  window.onmessage = (event) => {
    if (event.origin !== "https://hot-potato.reddit.com") return;
    const message = event.data;
    if (!message.type) {
      console.error("No type in message from iframe");
      return;
    }

    switch (event.data.type) {
      case "loadedLocalStorage":
        showToast("Overlays loaded from local storage");
        break;
      case "error":
        showToastError(message.data);
        break;
      default:
        break;
    }
  };
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
 * @type {{overlays: {[key: string]: {id: string, x: number, y: number, width: number, height: number, src: string}}, lastUpdate: number}}
 */
var corniferData = {
  overlays: {},
  lastUpdate: 0,
};

/**
 * Main iframe side script
 */

function mainFromIframe() {
  console.log("Cornifer script loaded from iframe");

  connectIframe();
}

function connectIframe() {
  // listen to custom messages from reddit
  /**
   * Handle messages from reddit
   * @param {MessageEvent<{type: string, data: any}>} event
   * @returns
   */
  window.onmessage = (event) => {
    const message = event.data;
    switch (message.type) {
      case "create":
        /**
         * @type {{id: string, x: number, y: number, width: number, height: number, src: string}}
         */
        var createData = message.data;
        {
          const { id, x, y, width, height, src } = createData;
          if (!id || !x || !y || !width || !height || !src) {
            console.error("Invalid create message");
            return;
          }

          if (corniferData.overlays[id]) {
            console.error("Overlay already exists");
            return;
          }

          createOverlay(id, x, y, width, height, src);
          corniferData.lastUpdate = Date.now();
        }
        break;
      case "update":
        /**
         * @type {{id: string, x?: number, y?: number, width?: number, height?: number, src?: string}}
         */
        var updateData = message.data;
        {
          const { id, x, y, width, height, src } = updateData;

          if (!id) {
            console.error("Invalid update message");
            return;
          }

          if (!corniferData.overlays[id]) {
            console.error("Overlay doesn't exist");
            return;
          }

          updateOverlay(updateData.id, x, y, width, height, src);
          corniferData.lastUpdate = Date.now();
        }
        break;
      case "loadLocal":
        message.data = JSON.parse(localStorage.getItem("cornifer-overlays"));
        if (!message.data) {
          window.parent.postMessage(
            { type: "error", data: "No overlays in local storage" },
            "*"
          );
          break;
        }
        window.parent.postMessage({ type: "loadedLocalStorage" }, "*");
      case "overlays":
        /**
         * @type {{overlays: {[id: string]: {id: string, x: number, y: number, width: number, height: number, src: string}}, lastUpdate: number}}
         */
        var overlaysData = message.data;
        if (corniferData.lastUpdate < overlaysData.lastUpdate) {
          for (const overlayId in overlaysData.overlays) {
            const overlay = overlaysData.overlays[overlayId];
            const { id, x, y, width, height, src } = overlay;
            if (!id || !x || !y || !width || !height || !src) {
              console.error("Invalid overlay");
              continue;
            }

            if (corniferData.overlays[id]) {
              // updateOverlay(id, x, y, width, height, src);
            } else {
              createOverlay(id, x, y, width, height, src);
            }
          }
          corniferData.lastUpdate = overlaysData.lastUpdate;
        }
        break;
      default:
        break;
    }

    localStorage.setItem("cornifer-overlays", JSON.stringify(corniferData));
  };
}

/**
 * Create an overlay and add it to the page
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} src
 * @returns {HTMLDivElement}
 */
function createOverlay(id, x, y, width, height, src) {
  const canvasX = x * 50;
  const canvasY = y * 50;
  const canvasWidth = width * 50;
  const canvasHeight = height * 50;
  const div = document.createElement("div");
  div.className = "cornifer-overlay";
  div.id = "cornifer-overlay-" + id;
  div.style = `height:${canvasHeight}px; width:${canvasWidth}px; position: absolute; inset: 0px; transform: translateX(${canvasX}px) translateY(${canvasY}px); background-size: cover; image-rendering: pixelated; background-image: url('${src}'); opacity: 1`;
  document
    .getElementsByTagName("mona-lisa-embed")[0]
    .shadowRoot.children[0].getElementsByTagName("mona-lisa-camera")[0]
    .shadowRoot.children[0].children[0].children[0].appendChild(div);

  corniferData.overlays[id] = {
    id,
    x,
    y,
    width,
    height,
    src,
    element: div,
  };
}

/**
 * Update an overlay if it exists
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} src
 * @returns
 */
function updateOverlay(id, x, y, width, height, src) {
  if (!corniferData.overlays[id]) {
    console.error("Overlay doesn't exist");
    return;
  }

  const overlay = corniferData.overlays[id];

  if (x) {
    overlay.x = x;
    overlay.element.style.transform = `translateX(${x}px)`;
  }
  if (y) {
    overlay.y = y;
    overlay.element.style.transform = `translateY(${y}px)`;
  }
  if (width) {
    overlay.width = width;
    overlay.element.style.width = width + "px";
  }
  if (height) {
    overlay.height = height;
    overlay.element.style.width = height + "px";
  }
  if (src) {
    overlay.src = src;
    overlay.element.style.backgroundImage = `url(${src})`;
  }
}
