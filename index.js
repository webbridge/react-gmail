import gapi from "./lib/gapi";

const config = require("../../../gmail.config.json");
const metaHeaders = ["From", "Date", "Subject"];

class GmailApi {
  constructor() {
    this.signIn = false;
    try {
      this.initClient = this.initClient.bind(this);
      this.handleError = this.handleError.bind(this);
      this.getMessages = this.getMessages.bind(this);
      this.updateSigninStatus = this.updateSigninStatus.bind(this);
      this.normalizeData = this.normalizeData.bind(this);

      gapi.load("client:auth2", this.initClient);
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * @param {string} userId
   * @returns {Promise} Object: { emailAddress, messagesTotal, threadsTotal , historyId }
   */
  getProfile(userId = "me") {
    if (this.signIn) {
      return gapi.client.gmail.users.getProfile({ userId });
    } else {
      return this.handleError();
    }
  }

  /**
   * @param {boolean} unread
   * @param {integer} maxResults
   * @param {string} userId
   * @returns {Promise} Array: [ {id, threadId} ]
   */
  getMessageIds(unread = false, maxResults = 10, userId = "me") {
    if (this.signIn) {
      let q = "";
      if (!!unread) {
        q = "is:unread";
      }
      return gapi.client.gmail.users.messages.list({ userId, maxResults, q });
    } else {
      return this.handleError();
    }
  }

  /**
   * @param {[string] | string} ids
   * @param {string} userId
   * @returns {Promise} [{id, labelIds, snippet, internalDate, payload}] | {...}
   */
  getMessages(ids, userId = "me") {
    if (this.signIn) {
      if (typeof ids === "string") {
        return gapi.client.gmail.users.messages.get({ userId, id: ids });
      } else {
        return Promise.all(
          ids.map(id => gapi.client.gmail.users.messages.get({ userId, id }))
        );
      }
    } else {
      return this.handleError();
    }
  }

  /**
   * Converting object to array of ids
   * @param {object} data getMessageIds response
   */
  getArrayOfIds(data) {
    if (data.hasOwnProperty("signIn")) return;
    const {
      result: { messages }
    } = data;
    let result = [];
    messages.forEach(message => {
      result.push(message.id);
    });
    return result;
  }

  /**
   * Get headers for preview
   * @param {object} data getMessageIds headers response
   */
  getMetaFromHeaders(data) {
    if (data.hasOwnProperty("signIn")) return;
    let result = {};
    const { headers } = data.result.payload;
    headers.forEach(header => {
      if (metaHeaders.indexOf(header.name) > -1) {
        result[header.name.toLowerCase()] = header.value;
      }
    });
    return result;
  }

  /**
   * Get body and decode
   * @param {array | object} data getMessages response
   * @returns {object} text, html
   */
  getBody(data) {
    if (data.hasOwnProperty("signIn")) return;
    const {
      result: { payload }
    } = data;
    let result = {
      text: "",
      html: ""
    };

    if (payload.hasOwnProperty("parts")) {
      payload.parts.forEach(part => {
        if (part.mimeType === "text/plain") {
          result.text = atob(
            part.body.data.replace(/-/g, "+").replace(/_/g, "/")
          );
        }
      });
    } else {
      if (!!payload.body.size) {
        result.text = atob(
          payload.body.data.replace(/-/g, "+").replace(/_/g, "/")
        );
      }
    }
    return result;
  }

  /**
   *  Normalize data
   * @param {array | object} data getMessages response
   * @returns {array | object}
   */
  normalizeData(data) {
    let result;

    if (Array.isArray(data)) {
      result = data.map(res => {
        console.log(res);

        const { id, snippet } = res.result;
        return {
          ...this.getMetaFromHeaders(res),
          id,
          snippet,
          body: this.getBody(res)
        };
      });
    } else {
      const { id, snippet } = data.result;
      result = {
        ...this.getMetaFromHeaders(data),
        id,
        snippet,
        body: this.getBody(res)
      };
    }
    return result;
  }

  // Update SignIn property
  updateSigninStatus(isSignedIn) {
    this.signIn = isSignedIn;
  }

  // Sign in google account
  handleSigninClick() {
    try {
      gapi.auth2.getAuthInstance().signIn();
    } catch (e) {
      console.log(e);
    }
  }

  // Sign out google account
  handleSignoutClick() {
    try {
      gapi.auth2.getAuthInstance().signOut();
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Error Handler
   * @param {string} message
   */
  handleError(message = "You are not authorised or api not initialized!") {
    return new Promise((_, reject) => {
      reject({
        message,
        signIn: this.signIn
      });
      notification(message);
    });
  }

  // Initialize the API client library
  initClient() {
    try {
      gapi.client.init(config).then(() => {
        gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus);
        this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      });
    } catch (e) {
      console.log(e);
    }
  }
}

// Notification for handleError
const notification = message => {
  const id = "gmail-api-notification-block";
  const textBlockId = "gmail-api-notification-text-block";
  const styles =
    "position: absolute; top: 10px; right: 10px; box-shadow:5px 5px 20px -10px #cecece; z-index: 99999999; padding: 20px; color: #7d7d7d; border-radius: 100px; font-size: 14px; transition: 0.3s;text-align: center";
  const notificationElement = document.getElementById(id);

  if (!notificationElement) {
    const notificationBlock = document.createElement("div");
    notificationBlock.style.cssText = styles;
    notificationBlock.id = id;

    const notificationText = document.createElement("p");
    notificationText.innerText = message;
    notificationText.style.margin = "5px 0";
    notificationText.id = textBlockId;

    const signInButton = document.createElement("button");
    signInButton.innerText = "Sign In";
    signInButton.style.cssText =
      "color: #7d7d7d; background: #fff; border:1px solid #7d7d7d; border-radius: 5px; cursor: pointer; padding: 3px 20px;";
    signInButton.onclick = () => {
      gapi.auth2.getAuthInstance().signIn();
    };

    document.body.appendChild(notificationBlock);
    notificationBlock.appendChild(notificationText);
    notificationBlock.appendChild(signInButton);
    setTimeout(() => {
      notificationBlock.style.opacity = "0";
    }, 5000);
  } else {
    document.getElementById(textBlockId).innerText = message;
    notificationElement.style.opacity = "1";
    setTimeout(() => {
      notificationElement.style.opacity = "0";
    }, 5000);
  }
};

// Instance of GmailApi
let gmailApi;
try {
  gmailApi = new GmailApi();
} catch (e) {
  console.log(e);
}

export default gmailApi;
