/**
 * Created by Martin Gaus
 */

const libsignal = require("@gausma/libsignal-service-javascript");
const Storage = require("./LocalSignalProtocolStore.js");
const path = require("path");
const fs = require("fs");

const signalDir = "signal";

module.exports = function(RED) {
    /**
     * Message receiver management
     */
    const messageReceivers = {};

    /**
     * Determine the configuration for production or development purpose
     * @param production Production flag
     * @returns Configuration
     */
    function getConfiguration(production) {
        if (production) {
            return libsignal.config.product;
        }
        return libsignal.config.develop;
    }

    /**
     * Determine the trusted root for production or development purpose
     * @param production Production flag
     * @returns Configuration
     */
    function getServerTrustRoot(production) {
        if (production) {
            return libsignal.serverTrustRoot.product;
        }
        return libsignal.serverTrustRoot.develop;
    }

    /**
     * Helper function for sending a success message for an node with 2 outputs
     * @param node Node
     * @param message Message
     */
    function sendSuccess(node, message) {
        node.log(message);
        const msg = {
            payload: message,
        };
        node.send([msg, null]);
    }

    /**
     * Helper function for sending anerror message for an node with 2 outputs
     * @param node Node
     * @param message Message
     */
    function sendError(node, message) {
        node.error(message);
        const msg = {
            payload: message,
        };
        node.send([null, msg]);
    }

    /**
     * Account configuration node
     * @param config Configuration
     */
    function AccountNode(config) {
        RED.nodes.createNode(this, config);
        this.phoneNumber = config.phoneNumber;
        this.password = config.password;
        this.dataStoreDirectory = config.dataStoreDirectory;
        this.liveServer = config.liveServer;
        this.accountName = config.accountName;

        const dataStoreDirectory = path.join(
            RED.settings.userDir,
            signalDir,
            this.dataStoreDirectory,
        );
        this.protocolStore = new libsignal.ProtocolStore(new Storage(dataStoreDirectory));
        this.protocolStore.load(); // Todo await?
    }
    RED.nodes.registerType("account", AccountNode);

    /**
     * Request a registration object via sms
     * @param config Configuration object
     */
    function RequestSMSNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on("input", async function() {
            this.account = RED.nodes.getNode(config.account);
            if (
                this.account &&
                this.account.phoneNumber &&
                this.account.password &&
                this.account.protocolStore
            ) {
                try {
                    const configuration = getConfiguration(this.account.liveServer);
                    const accountManager = new libsignal.AccountManager(
                        this.account.phoneNumber,
                        this.account.password,
                        this.account.protocolStore,
                        configuration,
                    );
                    await accountManager.requestSMSVerification();
                    sendSuccess(node, "Signal client: registration code requested via sms.");
                } catch (err) {
                    sendError(node, `Signal client error: ${JSON.stringify(err)}`);
                }
            } else {
                sendError(node, "Signal client: please configure an account.");
            }
        });
    }
    RED.nodes.registerType("request-sms", RequestSMSNode);

    /**
     * Request a registration object via voice call
     * @param config Configuration object
     */
    function RequestVoiceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on("input", async function() {
            this.account = RED.nodes.getNode(config.account);
            if (
                this.account &&
                this.account.phoneNumber &&
                this.account.password &&
                this.account.protocolStore
            ) {
                try {
                    const configuration = getConfiguration(this.account.liveServer);
                    const accountManager = new libsignal.AccountManager(
                        this.account.phoneNumber,
                        this.account.password,
                        this.account.protocolStore,
                        configuration,
                    );
                    await accountManager.requestVoiceVerification();
                    sendSuccess(node, "Signal client: registration code requested via voice call.");
                } catch (err) {
                    sendError(node, `Signal client error: ${JSON.stringify(err)}`);
                }
            } else {
                sendError(node, "Signal client: please configure an account.");
            }
        });
    }
    RED.nodes.registerType("request-voice", RequestVoiceNode);

    /**
     * Register the client
     * @param config Configuration object
     */
    function RegisterNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on("input", async function() {
            this.account = RED.nodes.getNode(config.account);
            if (
                this.account &&
                this.account.phoneNumber &&
                this.account.password &&
                this.account.protocolStore &&
                config.registrationCode
            ) {
                try {
                    const configuration = getConfiguration(this.account.liveServer);
                    const accountManager = new libsignal.AccountManager(
                        this.account.phoneNumber,
                        this.account.password,
                        this.account.protocolStore,
                        configuration,
                    );
                    const registrationCode = config.registrationCode.replace("-", "");
                    await accountManager.registerSingleDevice(registrationCode);
                    sendSuccess(node, "Signal client: registration performed.");
                } catch (err) {
                    sendError(node, `Signal client error: ${JSON.stringify(err)}`);
                }
            } else {
                sendError(
                    node,
                    "Signal client: please configure an account and the registration code.",
                );
            }
        });
    }
    RED.nodes.registerType("register", RegisterNode);

    /**
     * Send a message
     *
     * Result on success:
     * {
     *     "successfulIdentifiers": ["+34634058xxx"],
     *     "failoverIdentifiers": [],
     *     "errors": [],
     *     "unidentifiedDeliveries": [],
     *     "dataMessage": {
     *         "type": "Buffer",
     *         "data": [10, 19, 72, 97, 108, 108, 111, ...]
     *     }
     * }
     *
     * Result on error:
     * {
     *     "successfulIdentifiers": [],
     *     "failoverIdentifiers": [],
     *     "errors": [{
     *             "name": "UnregisteredUserError",
     *             "identifier": "+4915902934xxx",
     *             "code": 404,
     *             "reason": "Failed to retrieve new device keys for number +4915902934xxx"
     *         }
     *     ],
     *     "unidentifiedDeliveries": [],
     *     "dataMessage": {
     *         "type": "Buffer",
     *         "data": [10, 19, 72, 97, 108, 108, 111, ...]
     *     }
     * }
     *
     * @param config Configuration object
     */
    function SendNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on("input", async function(msg) {
            this.account = RED.nodes.getNode(config.account);

            let receiverNumber = config.receiverNumber;
            if (msg.payload && msg.payload.receiverNumber) {
                receiverNumber = msg.payload.receiverNumber;
            }

            if (this.account && this.account.protocolStore && receiverNumber && msg.payload) {
                try {
                    const configuration = getConfiguration(this.account.liveServer);
                    const messageSender = new libsignal.MessageSender(
                        this.account.protocolStore,
                        configuration,
                    );
                    await messageSender.connect();

                    // Attachments
                    const attachments = [];
                    const attachmentPaths = [];
                    if (msg.payload.attachments) {
                        if (Array.isArray(msg.payload.attachments)) {
                            for (let attachment of msg.payload.attachments) {
                                let attachmentPath = attachment;
                                if (!path.isAbsolute(attachment)) {
                                    attachmentPath = path.join(RED.settings.userDir, attachment);
                                }
                                if (fs.existsSync(attachmentPath)) {
                                    const file = await libsignal.AttachmentHelper.loadFile(
                                        attachmentPath,
                                    );
                                    attachments.push(file);
                                    attachmentPaths.push(attachmentPath);
                                } else {
                                    sendError(
                                        node,
                                        `Signal client: invalid attachment file '${attachmentPath}'`,
                                    );
                                    return;
                                }
                            }
                        } else {
                            sendError(node, `Signal client: payload.attachment must be an array`);
                            return;
                        }
                    }

                    // Message
                    const message = {
                        number: receiverNumber,
                        body: msg.payload.content
                    };

                    if (attachments.length > 0) {
                        message.attachments = attachments;
                    }

                    if (msg.payload.expire) {
                        if (Number.isInteger(msg.payload.expire) && (msg.payload.expire > 0)) {
                            message.expireTimer = msg.payload.expire;
                        } else {
                            sendError(node, `Signal client: invalid payload.expire duration: '${msg.payload.expire}'`);
                            return;                            
                        }
                    }

                    // Send
                    const result = await messageSender.sendMessageToNumber(message);

                    if (config.verboseLogging) {
                        node.log(`Signal client message sent: ${JSON.stringify(result)}`);
                    }

                    const returnMessage = {
                        payload: {
                            receiverNumber: receiverNumber,
                            senderNumber: this.account.phoneNumber,
                            content: msg.payload.content,
                        },
                    };

                    if (attachmentPaths.length > 0) {
                        returnMessage.payload.attachments = attachmentPaths;
                    }

                    if (message.expireTimer) {
                        returnMessage.payload.expire = message.expireTimer;
                    }

                    node.send([returnMessage, null]);
                } catch (err) {
                    sendError(node, `Signal client error: ${JSON.stringify(err)}`);
                }
            } else {
                sendError(
                    node,
                    "Signal client: please configure an account and provide an payload with content in the message. The receiver number must be configured or a property in the payload.",
                );
            }
        });
    }
    RED.nodes.registerType("send", SendNode);

    /**
     * Receive a message
     *
     * Raw event data:
     * {
     *     "type": "message",
     *     "data": {
     *         "source": "+33752836xxx",
     *         "sourceUuid": "4ffb3c93-21c7-497c-a8f8-ca7499ad56e3",
     *         "sourceDevice": 1,
     *         "timestamp": 1610308571384,
     *         "message": {
     *             "body": "Hello MAG",
     *             "profileKey": "",
     *             "timestamp": "1610308571384"
     *         }
     *     }
     * }
     *
     * @param config Configuration object
     */
    function ReceiveNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on("close", async function() {
            if (messageReceivers[node.id]) {
                await messageReceivers[node.id].stopProcessing();
            }
            delete messageReceivers[node.id];
        });

        var account = RED.nodes.getNode(config.account);
        if (account && account.protocolStore) {
            const configuration = getConfiguration(account.liveServer);
            const serverTrustRoot = getServerTrustRoot(account.liveServer);
            const messageReceiver = new libsignal.MessageReceiver(
                account.protocolStore,
                null,
                {},
                configuration,
                serverTrustRoot,
            );

            messageReceivers[node.id] = messageReceiver;

            messageReceiver
                .connect()
                .then(function() {
                    messageReceiver.addEventListener("message", async function(event) {
                        if (config.verboseLogging) {
                            console.log(event);
                            const att = event.data.message.attachments;
                            delete event.data.message.attachments;
                            node.log(JSON.stringify(event));
                            event.data.message.attachments = att;
                        }

                        // Attachments
                        let attachmentPaths = [];
                        let downloadDirectory = config.downloadDirectory;
                        if (!path.isAbsolute(config.downloadDirectory)) {
                            downloadDirectory = path.join(
                                RED.settings.userDir,
                                config.downloadDirectory,
                            );
                        }
                        if (fs.existsSync(downloadDirectory)) {
                            const attachmentPromises = [];
                            event.data.message.attachments.map(attachment => {
                                const attachmentPromise = messageReceiver
                                .handleAttachment(attachment)
                                .then(attachmentPointer => {
                                    return libsignal.AttachmentHelper.saveFile(
                                        attachmentPointer,
                                        downloadDirectory,
                                    );
                                })
                                .catch((err) => {
                                    node.error(`Signal client error: ${err}`)
                                });
                                attachmentPromises.push(attachmentPromise); 
                            });

                            attachmentPaths = await Promise.all(attachmentPromises);
                        } else {
                            node.error(`Signal client error: invalid download directory: "${downloadDirectory}"`);
                        }

                        // Message
                        const message = {
                            payload: {
                                content: event.data.message.body,
                                senderNumber: event.data.source,
                                senderUuid: event.data.sourceUuid,
                                receiverNumber: account.phoneNumber,
                            },
                            originalMessage: event.data,
                        };

                        if (attachmentPaths.length > 0) {
                            message.payload.attachments = attachmentPaths;
                        }

                        if (event.data.message.expireTimer) {
                            message.payload.expire = event.data.message.expireTimer;
                        }

                        node.send(message);

                        event.confirm();
                    });

                    messageReceiver.addEventListener("configuration", ev => {
                        node.log("Received configuration sync: ", ev.configuration);
                        ev.confirm();
                    });

                    messageReceiver.addEventListener("group", ev => {
                        node.log("Received group details: ", ev.groupDetails);
                        ev.confirm();
                    });

                    messageReceiver.addEventListener("contact", ev => {
                        node.log(
                            `Received contact for ${ev.contactDetails.number} who has name ${ev.contactDetails.name}`,
                        );
                        ev.confirm();
                    });

                    messageReceiver.addEventListener("verified", ev => {
                        node.log("Received verification: ", ev.verified);
                        ev.confirm();
                    });

                    messageReceiver.addEventListener("sent", ev => {
                        node.log(
                            `Message successfully sent from device ${ev.data.deviceId} to ${ev.data.destination} at timestamp ${ev.data.timestamp}`,
                        );
                        ev.confirm();
                    });

                    messageReceiver.addEventListener("delivery", ev => {
                        node.log(
                            `Message successfully delivered to number ${ev.deliveryReceipt.source} and device ${ev.deliveryReceipt.sourceDevice} at timestamp ${ev.deliveryReceipt.timestamp}`,
                        );
                        ev.confirm();
                    });

                    messageReceiver.addEventListener("read", ev => {
                        node.log(
                            `Message read on ${ev.read.reader} at timestamp ${ev.read.timestamp}`,
                        );
                        ev.confirm();
                    });
                })
                .catch(function(err) {
                    sendError(node, `Signal client error: ${JSON.stringify(err)}`);
                });
        } else {
            sendError(node, "Signal client: please configure an acoount.");
        }
    }
    RED.nodes.registerType("receive", ReceiveNode);

    /**
     * Action route to trigger nodes. The actions are send by node buttons (see client code).
     */
    RED.httpAdmin.post("/signal-client/:id", RED.auth.needsPermission("inject.write"), function(
        req,
        res,
    ) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                node.receive();
                res.sendStatus(200);
            } catch (err) {
                node.error(
                    `Signal client: action for node '${req.params.id}' failed: ${err.toString()}`,
                );
                res.sendStatus(500);
            }
        } else {
            node.error(`Signal client: action received for an invalid node id '${req.params.id}'`);
            res.sendStatus(404);
        }
    });
};
