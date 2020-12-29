const libsignal = require("@gausma/libsignal-service-javascript");
const Storage = require("./LocalSignalProtocolStore.js");

function getConfiguration(production) {
    if (production) {
        return libsignal.config.product;
    }
    return libsignal.config.develop;
}

function getServerTrustRoot(production) {
    if (production) {
        return libsignal.serverTrustRoot.product;
    }
    return libsignal.serverTrustRoot.develop;
}

module.exports = function(RED) {
    /**
     * Account configuration node
     * @param config Configuration
     */
    function AccountNode(config) {
        RED.nodes.createNode(this, config);
        this.phoneNumber = config.phoneNumber;
        this.password = config.password;
        this.dataStorePath = config.dataStorePath;
        this.liveServer = config.liveServer;
        this.accountName = config.accountName;

        this.protocolStore = new libsignal.ProtocolStore(new Storage(this.dataStorePath));
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
                    node.log("Registration code requested via sms.");
                } catch (err) {
                    node.error(err);
                }
            } else {
                node.error("Please configure an account.");
            }
        });
    }
    RED.nodes.registerType("request-sms", RequestSMSNode);

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
                    node.log("Registration performed.");
                } catch (err) {
                    node.error(err);
                }
            } else {
                node.error("Please configure an account and the registration code.");
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
                    node.log(`Message sent: ${JSON.stringify(result)}`);
                } catch (err) {
                    node.error(JSON.stringify(err));
                }
            } else {
                node.error("Please configure an acoount, a receiver number and provide an payload in the message.");
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
        this.account = RED.nodes.getNode(config.account);
        if (this.account && this.account.protocolStore) {
            const configuration = getConfiguration(this.account.liveServer);
            const serverTrustRoot = getServerTrustRoot(this.account.liveServer);
            const messageReceiver = new libsignal.MessageReceiver(this.account.protocolStore, null, {}, configuration, serverTrustRoot);
            messageReceiver
                .connect()
                .then(() => {
                    messageReceiver.addEventListener("message", event => {
                        node.log("*** EVENT ***:" + JSON.stringify(event));
                        if (event.data.message.group) {
                            node.log(event.data.message.group);
                            node.log(`Received message in group ${event.data.message.group.id}: ${event.data.message.body}`);
                        } else {
                            node.log("Received message: " + event.data.message.body);
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
            node.error("Please configure an acoount.");
        }
    }
    RED.nodes.registerType("receive", ReceiveNode);
};
