/**
 * Created by Martin Gaus
 */

const libsignal = require("@gausma/libsignal-service-javascript");
const Storage = require("./LocalSignalProtocolStore.js");
const path = require("path");

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
            payload: message
        }
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
            payload: message
        }
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

        const dataStoreDirectory = path.join(RED.settings.userDir, signalDir, this.dataStoreDirectory);
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
            if (this.account && this.account.phoneNumber && this.account.password && this.account.protocolStore) {
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
                    sendError(node, `Signal client error: ${err.toString()}`);
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
            if (this.account && this.account.phoneNumber && this.account.password && this.account.protocolStore) {
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
                    sendError(node, `Signal client error: ${err.toString()}`);
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
                    sendError(node, `Signal client error: ${err.toString()}`);
                }
            } else {
                sendError(node, "Signal client: please configure an account and the registration code.");
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
            if (this.account && this.account.protocolStore && config.receiverNumber && msg.payload) {
                try {
                    const configuration = getConfiguration(this.account.liveServer);
                    const messageSender = new libsignal.MessageSender(this.account.protocolStore, configuration);
                    await messageSender.connect();
                    const result = await messageSender.sendMessageToNumber({
                        number: config.receiverNumber,
                        body: msg.payload.content,
                    });

                    if (config.verboseLogging) {
                        node.log(`Signal client message sent: ${JSON.stringify(result)}`);
                    }

                    const returnMessage = {
                        payload: {
                            receiverNumber: config.receiverNumber,
                            content: msg.payload.content,    
                        }
                    }
                    node.send([returnMessage, null]);
                } catch (err) {
                    node.error(`Signal client error: ${err.toString()}`);
                    node.send([null, err]);
                }
            } else {
                node.error("Signal client: please configure an acoount, a receiver number and provide an payload in the message.");
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

        this.account = RED.nodes.getNode(config.account);
        if (this.account && this.account.protocolStore) {
            const configuration = getConfiguration(this.account.liveServer);
            const serverTrustRoot = getServerTrustRoot(this.account.liveServer);
            const messageReceiver = new libsignal.MessageReceiver(this.account.protocolStore, null, {}, configuration, serverTrustRoot);

            messageReceivers[node.id] = messageReceiver;

            messageReceiver
                .connect()
                .then(function() {
                    messageReceiver.addEventListener("message", function(event) {
                        if (config.verboseLogging) {
                            node.log(`Signal client message received: ${JSON.stringify(event)}`);
                        }

                        const message = {
                            payload: {
                                content: event.data.message.body,
                                senderNumber: event.data.source,
                                senderUuid: event.data.sourceUuid,
                            },
                            originalMessage: event.data
                        };
                        node.send(message);

                        event.confirm();
                    });
                })
                .catch(function(err) {
                    node.error(`Signal client error: ${err.toString()}`);
                    node.send([null, err]);
                });
        } else {
            node.error("Signal client: please configure an acoount.");
        }
    }
    RED.nodes.registerType("receive", ReceiveNode);

    /**
     * Action route to trigger nodes. The actions are send by node buttons (see client code).
     */
    RED.httpAdmin.post("/signal-client/:id", RED.auth.needsPermission("inject.write"), function(req, res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                node.receive();
                res.sendStatus(200);
            } catch (err) {
                node.error(`Signal client: action for node '${req.params.id}' failed: ${err.toString()}`);
                res.sendStatus(500);
            }
        } else {
            node.error(`Signal client: action received for an invalid node id '${req.params.id}'`);
            res.sendStatus(404);
        }
    });    
};
