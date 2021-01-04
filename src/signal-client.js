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
     * @param production
     */
    function getConfiguration(production) {
        if (production) {
            return libsignal.config.product;
        }
        return libsignal.config.develop;
    }

    /**
     * Determine the trusted root for production or development purpose
     * @param production
     */
    function getServerTrustRoot(production) {
        if (production) {
            return libsignal.serverTrustRoot.product;
        }
        return libsignal.serverTrustRoot.develop;
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

        node.on("input", async msg => {
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
                    node.log("Signal client: registration code requested via sms.");
                } catch (err) {
                    node.error(err);
                }
            } else {
                node.error("Signal client: please configure an account.");
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

        node.on("input", async msg => {
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
                    node.log("Signal client: registration code requested via voice call.");
                } catch (err) {
                    node.error(err);
                }
            } else {
                node.error("Signal client: please configure an account.");
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
        node.on("input", async msg => {
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
                    node.log("Signal client: registration performed.");
                } catch (err) {
                    node.error(err);
                }
            } else {
                node.error("Signal client: please configure an account and the registration code.");
            }
        });
    }
    RED.nodes.registerType("register", RegisterNode);

    /**
     *  Send a message
     * @param config Configuration object
     */
    function SendNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on("input", async msg => {
            this.account = RED.nodes.getNode(config.account);
            if (this.account && this.account.protocolStore && config.receiverNumber && msg.payload) {
                try {
                    const configuration = getConfiguration(this.account.liveServer);
                    const messageSender = new libsignal.MessageSender(this.account.protocolStore, configuration);
                    await messageSender.connect();
                    const result = await messageSender.sendMessageToNumber({
                        number: config.receiverNumber,
                        body: msg.payload,
                    });

                    if (config.verboseLogging) {
                        node.log(`Signal client message sent: ${JSON.stringify(result)}`);
                    }
                } catch (err) {
                    node.error(JSON.stringify(err));
                }
            } else {
                node.error("Signal client: please configure an acoount, a receiver number and provide an payload in the message.");
            }
        });
    }
    RED.nodes.registerType("send", SendNode);

    /**
     *  Receive a message
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
                .then(() => {
                    messageReceiver.addEventListener("message", event => {
                        if (config.verboseLogging) {
                            node.log(`Signal client message received: ${JSON.stringify(event)}`);
                        }

                        const message = {
                            payload: event.data.message.body,
                        };
                        node.send(message);

                        event.confirm();
                    });
                })
                .catch(err => {
                    node.error(JSON.stringify(err));
                });
        } else {
            node.error("Signal client: please configure an acoount.");
        }
    }
    RED.nodes.registerType("receive", ReceiveNode);
};
