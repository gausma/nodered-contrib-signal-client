# nodered-contrib-signal-client
[Signal](https://signal.org) communicator client nodes to use the more secure messenger in Node-RED.

This is a third-party effort, and is NOT a part of the official [Signal](https://signal.org) project or any other project of [Open Whisper Systems](https://whispersystems.org).

# Installation
[![NPM](https://nodei.co/npm/nodered-contrib-signal-client.png?downloads=true)](https://nodei.co/npm/nodered-contrib-signal-client/)

You can install the nodes using node-red's "Manage palette" in the side bar.

Or run the following command in the root directory of your Node-RED installation

    npm install nodered-contrib-signal-client --save

# Dependencies
The nodes are tested with `Node.js v14.15.3` and `Node-RED v1.2.6`.
 - [@gausma/libsignal-service-javascript](https://github.com/gausma/nodered-contrib-signal-client)
 - [node-localstorage](https://github.com/lmaccherone/node-localstorage)
 - [bytebuffer](https://github.com/protobufjs/bytebuffer.js)

# Changelog
Changes can be followed [here](/CHANGELOG.md).

# Usage
## Registration
A Registration is required so that you can communicate via Signal. Registering an account takes place in two phases:

### Request a registration code
First, you'll request a registration code from the Signal server that you are authorized to use this number. The registration code can be queried through special nodes: request-sms or request-voice

<img src="images/RegistrationRequestNodes.png" title="Request Nodes" />

The configuration of a Signal Communicator registration takes place in an account. An Account is tied to a phone number. When experimenting you probably want to get a temporary phone number via an online service like Google Voice rather than clobbering the keys for your own phone.

The password is an arbitrary string used for authentication against the Signal API. It will be registered with the Signal servers as part of the registration process.

The registration data determined are saved in the Node-RED settings. A directory is created within your Node-RED settings. The directory must be unique across all accounts. You can find the directory in "$HOME/.node-red" (Linux: /home/USER/.node-red/signal,  Windows: C:\Users\USER\.node-red\signal)

Live Server: For safety, a Signal staging server (testing server) can be used  while you carry out your experiments. This means that it will only send and receive messages from other clients using the staging server! 

<img src="images/RegistrationRequestSMSConfiguration.png" title="Request SMS Configuration" />

__Interface__
| I/O      | Execution          | Message Properties | Type   | Description     |
| :------- | :----------------- | :----------------- | :----- | :-------------- |
| Input    | Injection button   | -                  | -      | -               |
| Output 1 | Successful request | payload            | string | Success message |
| Output 2 | Error on request   | payload            | string | Failure message |

### Confirm the registration code
You'll receive an SMS message or a voice call with an registration code at the number your specified. Use the code to register your account with the Signal service:

<img src="images/RegistrationRegister.png" title="Registration" />

Select the account for which the registration code was requested. Enter the registration code as received (format: "nnn-nnn" or "nnnnnn")

<img src="images/RegistrationRegisterConfiguration.png" title="Registration Configuration" />

__Don't forget to "Deploy" after configure the single nodes!__

__A "Deploy" or Node-RED restart is also necessary if the account for a receiver node is changed - especially after registration. This will restart all receive nodes with the actual configuration.__

__Success messages are not displayed in the "Debug messages" sidebar. You can connect a debug node to output 1 for this. 
This is not necessary for error messages. These are always output in the sidebar and in the log.__

__Interface__
| I/O      | Execution          | Message Properties | Type   | Description     |
| :------- | :----------------- | :----------------- | :----- | :-------------- |
| Input    | Injection button   | -                  | -      | -               |
| Output 1 | Successful request | payload            | string | Success message |
| Output 2 | Error on request   | payload            | string | Failure message |

## Sending a message
The "send" node is used to send a message.

<img src="images/SendNode.png" title="Send node" />

A previously registered account is selected as sender. The recipient's telephone number is configured for receiving the message.

The "Verbose Logging" checkbox is activated for extended log outputs in the Node-RED log. The logs are not shown in the "Debug messages" sidebar.

<img src="images/SendNodeConfiguration.png" title="Send node configuration" />

The message to be sent is transferred in the payload as string when the node is executed. A simple flow can look like this:

<img src="images/SendFlow1.png" title="Send flow 1" />

__Interface__
| I/O      | Execution       | Message Properties     | Type   | Description                 |
| :------- | :-------------- | :--------------------- | :----- | :-------------------------- |
| Input    | Send message    | payload.content        | string | Message to send             |
| Output 1 | Successful sent | payload.receiverNumber | string | The receiver's phone number |
|          |                 | payload.content        | string | Sent message                |
| Output 2 | Error on sent   | payload                | object | Failure message object      |

## Reveiving a message
The "receive" node is used to receive a message.

<img src="images/ReceiveNode.png" title="Receive node" />

A previously registered account is selected as receiver.

The "Verbose Logging" checkbox is activated for extended log outputs in the Node-RED log. The logs are not  shown in the "Debug messages" sidebar.

<img src="images/ReceiveNodeConfiguration.png" title="Receive node configuration" />

The received message is contained in the payload of the output. A simple flow can look like this:

<img src="images/ReceiveFlow1.png" title="Receive flow 1" />

__To avoid problems ensure that you connect maximal one receiver node to one account.__

__Interface__
| I/O      | Execution          | Message Properties   | Type   | Description                        |
| :------- | :----------------- | :------------------- | :----- | :--------------------------------- |
| Input    | -                  | -                    | -      | -                                  |
| Output 1 | Successful receive | payload.content      | string | Received message content           |
|          |                    | payload.senderNumber | string | The sender's phone number          |
|          |                    | payload.senderUuid   | string | The sender's unique identification |
|          |                    | originalMessage      | string | Original received object from the underlying library [@gausma/libsignal-service-javascript](https://github.com/gausma/nodered-contrib-signal-client) |
| Output 2 | Error on receive   | payload              | object | Failure message object             |

# Examples

---
Remark: All example flows can be found in the examples folder of this package. In Node-RED they can be imported via the import function (hambuger menu). Select the examples directly from the "Examples" vertical tab menue.
---

## 1 Registration flow
The registration code is requested either by the request-sms node or the request-voice node. The transmitted registration code is entered in the register node and the registration is carried out.

To display the success message you can connect a debug message to output 1. This is not necessary for error messages. These are always output in the sidebar and in the log.

<img src="images/Example01.png" title="Example 01" />

Example: 01_registration

## 2 Simple receive
Use a Receive node to receive a message from your friend. A message that is sent to the configured account is displayed as a debug message. The telephone number and the id of the seder are also logged.

<img src="images/Example02.png" title="Example 02" />

Example: 02_simple-receive

## 3 Simple send
You can send a message to your friend with the send node. In the example, the message is created by an inject node and thus the send node is triggered. The message is output in the debug node as confirmation.

<img src="images/Example03.png" title="Example 03" />

Example: 03_simple-send

## 4 Simple echo
A simple flow: the received message is returned to the sender. This flow represents the basis for a command flow and can be expanded accordingly. See further examples.

<img src="images/Example04.png" title="Example 04" />

Example: 04_simple-echo


# License
[<img src="https://www.gnu.org/graphics/gplv3-127x51.png" alt="GPLv3" >](http://www.gnu.org/licenses/gpl-3.0.html)

nodered-contrib-signal-client is a free software project licensed under the GNU General Public License v3.0 (GPLv3) by Martin Gaus.
