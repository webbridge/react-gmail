# react-gmail

React library for using gmail api : https://developers.google.com/gmail/api

## install

You can use npm `npm install --save react-gmail` or yarn `yarn add react-gmail`

## use

For using gmail API you need to import instance in your application `import gmailApi from 'react-gmail'`
Repeat **Step 1** from this link: https://developers.google.com/gmail/api/quickstart/js
You also need to create file `gmail.config.json` in root of your application with your config:

```json
{
  "clientId": "<CLIENT_ID>",
  "apiKey": "<API_KEY>",
  "scope": "https://www.googleapis.com/auth/gmail.readonly",
  "discoveryDocs": ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"]
}
```

For get more info about API please check documentation: https://developers.google.com/gmail/api/v1/reference

## methods

##### getProfile

For getting profile info:

```javascript
 /**
   * @param {string} userId
   * @returns {Promise} Object: { emailAddress, messagesTotal, threadsTotal , historyId }
   */
  getProfile(userId = "me").then(...)
```

##### getMessageIds

For getting message ids:

```javascript
 /**
   * @param {boolean} unread
   * @param {integer} maxResults
   * @param {string} userId
   * @returns {Promise} Array: [ {id, threadId} ]
   */
  getMessageIds(unread = false, maxResults = 10, userId = "me").then(...)
```

##### getMessages

For getting message data:

```javascript
 /**
   * @param {[string] | string} ids
   * @param {string} userId
   * @returns {Promise} [{id, labelIds, snippet, internalDate, payload}] | {...}
   */
  getMessages(ids, userId = "me").then(...)
```

##### listenSign

For listening your sign status

```javascript
/**
 * Method for update your sign if it was changed
 * @param {*} callback function for updating sign status
 */
listenSign(callback);
```

For getting message data:

```javascript
 /**
   * @param {[string] | string} ids
   * @param {string} userId
   * @returns {Promise} [{id, labelIds, snippet, internalDate, payload}] | {...}
   */
  getMessages(ids, userId = "me").then(...)
```

##### getArrayOfIds

For converting object to array of ids _(using for prepare array of ids for getMessages method)_:

```javascript
/**
 * @param {object} data getMessageIds response
 */
getArrayOfIds(data);
```

##### normalizeData

For normalizing data _(using with response of getMessages method)_:

```javascript
/**
 * @param {array | object} data getMessages response
 * @returns {array | object}
 */
normalizeData(data);
```

##### getBody

For getting body from getMessages response _(also decoding from base64)_:

```javascript
/**
 * @param {array | object} data getMessages response
 * @returns {object} text, html
 */
getBody(data);
```

##### getMetaFromHeaders

For getting important info (`"From", "Date", "Subject"` headers object) from getMessage response:

```javascript
/**
 * @param {object} data getMessageIds headers response
 */
getMetaFromHeaders(data);
```

## examples

##### getMessages

```javascript
import React from 'react'
import gmailApi from 'react-api'

class SomeComponent extends React.Component {
    state = {
        messages: []
    }

    getMessages = () => {
        gmailApi.getMessagesIds().then((resIds) => {
            gmailApi.getMessages(gmailApi.getArrayOfIds(resIds)).then((resMessages) => {
                this.setState({messages: resMessages})
            }
        }
    }

    render() {
        const {messages} = this.state
        return (
            <div>
                <button onCLick={this.getMessages}>Get Messages</button>
                <ul>
                {messages.map((message) => (
                    <li key="message.result.id">
                        {message.result.snippet}
                    </li>
                )
                </ul>
            </div>
        )
    }
}
```

##### getProfile

```javascript
gmailApi.getProfile().then(resProfile => {
  this.setState({ profile: resProfile.result });
});
```

##### listenSign

```javascript
import React from "react";
import gmailApi from "react-api";

class SomeComponent extends React.Component {
  state = {
    sign: gmailApi.sign
  };

  componentDidMount() {
    gmailApi.listenSign(this.signUpdate);
  }

  signUpdate = sign => {
    this.setState({ sign });
  };

  render() {
    return (
      <div>
        <p> Sign status: {this.state.sign} </p>
      </div>
    );
  }
}
```

## customize

For customizing signIn & signOut you can use `handleSignIn` and `handleSignOut` methods:

```javascript
import React from "react";
import gmailApi from "react-api";

class SomeComponent extends React.Component {
  state = {
    sign: gmailApi.sign
  };

  componentDidMount() {
    gmailApi.listenSign(this.signUpdate);
  }

  signUpdate = sign => {
    this.setState({ sign });
  };

  handleSignIn = () => {
    gmailApi.handleSignIn().then(() => {
      console.log("handleSignIn");
    });
  };

  handleSignOut = () => {
    gmailApi.handleSignOut().then(() => {
      console.log("handleSignOut");
    });
  };

  render() {
    return (
      <div>
        <button onCLick={this.handleSignIn}>SignIn Google</button>
        <button onCLick={this.handleSignOut}>SignOut Google</button>
        <p> Sign status: {this.state.sign} </p>
      </div>
    );
  }
}
```
